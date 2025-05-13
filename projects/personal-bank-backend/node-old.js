import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { AlgorandSubscriber } from '@algorandfoundation/algokit-subscriber';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';

const ACCOUNT_ADDRESS = 'ULIRVCYB4333UGGBZGWOMPUT2PXFDV6ILGMAVDRVEXSZOX7ZHZSCFVAVSU';
const TRANSACTIONS_FILE = path.join(process.cwd(), 'latest-transactions.json');
const MAX_STORED_TRANSACTIONS = 10;

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

let sockets = new Set();
// Keep a memory copy of transactions to avoid constant file I/O
let cachedTransactions = [];

// Initialize transactions storage
const initializeTransactionsStorage = () => {
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([]), 'utf8');
    console.log('Created empty transactions storage file');
    return [];
  }

  try {
    const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
    cachedTransactions = JSON.parse(data);
    return cachedTransactions;
  } catch (error) {
    console.error('Error reading transactions file:', error);
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([]), 'utf8');
    return [];
  }
};

// Save transactions to file
const saveTransactions = (transactions) => {
  try {
    // Update the cached version
    cachedTransactions = [...transactions];
    // Write to disk asynchronously to avoid blocking
    fs.writeFile(
      TRANSACTIONS_FILE,
      JSON.stringify(transactions, null, 2),
      'utf8',
      (err) => {
        if (err) {
          console.error('Error saving transactions:', err);
        }
      }
    );
  } catch (error) {
    console.error('Error preparing transactions for save:', error);
  }
};

// Add a new transaction to storage
const addTransaction = (transaction) => {
  // Use cached transactions instead of reading from file every time
  const transactions = [...cachedTransactions];

  // Check if transaction with this ID already exists
  const existingIndex = transactions.findIndex(t => t.id === transaction.id);

  if (existingIndex >= 0) {
    // Transaction already exists, update it if necessary
    // This is important for adding inner transactions that come later
    const existingTxn = transactions[existingIndex];

    // If the existing transaction doesn't have innerTxns but the new one does,
    // or if the new one has more innerTxns, update it
    if (
      (transaction.innerTxns && transaction.innerTxns.length > 0) &&
      (!existingTxn.innerTxns || existingTxn.innerTxns.length < transaction.innerTxns.length)
    ) {
      console.log("Updating transaction ${transaction.id} with inner transactions");
      transactions[existingIndex] = {
        ...existingTxn,
        innerTxns: transaction.innerTxns
      };

      // Save updated transactions
      saveTransactions(transactions);
    } else {
      console.log("Transaction ${transaction.id} already exists, no update needed");
    }

    return transactions;
  }

  // Add new transaction at the beginning
  transactions.unshift(transaction);

  // Keep only the latest MAX_STORED_TRANSACTIONS
  const updatedTransactions = transactions.slice(0, MAX_STORED_TRANSACTIONS);

  // Save updated transactions
  saveTransactions(updatedTransactions);

  return updatedTransactions;
};

// Process inner transactions for app calls
const processInnerTransactions = (txn) => {
  // Clone the transaction to avoid modifying the original
  const processedTxn = { ...txn };

  // Initialize innerTxns array if not present
  if (!processedTxn.innerTxns) {
    processedTxn.innerTxns = [];
  }

  // Extract and process inner transactions if they exist
  if (txn.innerTransactions && txn.innerTransactions.length > 0) {
    // Map inner transactions to the same format as main transactions
    processedTxn.innerTxns = txn.innerTransactions.map(innerTxn => ({
      ...innerTxn,
      isInner: true,
    }));
  }

  return processedTxn;
};

// Extract inner transactions from application transaction results
const extractInnerTransactions = async (txn) => {
  // If not an application call, no inner transactions to process
  if (txn.txType !== 'appl') {
    return txn;
  }

  const txnId = txn.id;

  // For application calls, we need to query the algod indexer to get inner transactions
  try {
    // If txn already has inner transactions field from the subscriber, process them
    if (txn.innerTransactions && txn.innerTransactions.length > 0) {
      return processInnerTransactions(txn);
    }

    return processInnerTransactions(txn);
  } catch (error) {
    console.error('Error fetching inner transactions:', error);
    return txn;
  }
};

// Initialize storage on startup
cachedTransactions = initializeTransactionsStorage();

// API endpoint to get latest transactions
app.get('/api/transactions', (req, res) => {
  // Return cached transactions directly instead of reading from file
  res.json(cachedTransactions);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Frontend connected via WebSocket');

  // Send current transactions when client connects
  ws.send(JSON.stringify({
    type: 'init',
    transactions: cachedTransactions
  }));

  sockets.add(ws);

  ws.on('close', () => {
    sockets.delete(ws);
  });
});

async function main() {
  const algorand = AlgorandClient.defaultLocalNet();

  const subscriber = new AlgorandSubscriber(
    {
      filters: [{ name: 'accountTxns', filter: { sender: ACCOUNT_ADDRESS } }],
      watermarkPersistence: {
        get: async () => 0n,
        set: async (newWatermark) => {},
      },
      syncBehaviour: 'skip-sync-newest', // Prevents overload at startup
      waitForBlockWhenAtTip: true,
    },
    algorand.client.algod
  );

  subscriber.on('accountTxns', async (txn) => {
    console.log('Transaction received:', txn.id, 'Round:', txn.confirmedRound?.toString());

    const transactionData = {
      id: txn.id,
      txnId: txn.id,
      sender: txn.sender,
      receiver: txn.paymentTransaction?.receiver || null,
      amount: txn.paymentTransaction?.amount?.toString() || '0',
      appId: txn.applicationTransaction?.applicationId?.toString() || null,
      type: txn.txType,
      round: txn.confirmedRound?.toString() || '0',
      fee: txn.fee?.toString() || '1000',
      timestamp: Math.floor(Date.now() / 1000), // Current timestamp in seconds
      innerTransactions: txn.innerTransactions || []
    };

    // First, process the transaction to extract inner transactions if they exist
    const processedTxn = await extractInnerTransactions(transactionData);

    // Add to storage
    const updatedTransactions = addTransaction(processedTxn);

    // Send the new transaction to clients
    const updateMessage = JSON.stringify({
      type: 'update',
      transaction: processedTxn,
    });

    sockets.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(updateMessage);
      }
    });
  });

  // Special listener for account-involved transactions (might capture inner transactions)
  subscriber.on('accountTransactionsInvolved', async (txn) => {
    // This might catch transactions where our account is involved but not the sender
    // This is useful for inner transactions where our account is the receiver
    console.log('Transaction involved:', txn.id);

    // Process this transaction if it's not already processed as a main transaction
    // This is a simplified approach - in a real app you might need more logic
    const existingIndex = cachedTransactions.findIndex(t => t.id === txn.id);
    if (existingIndex === -1) {
      // This is a new transaction, process it
      // However, for inner transactions, we typically want to attach them to their parent
      // So we need additional logic to determine the parent transaction
    }
  });

  subscriber.onError((e) => {
    console.error('Subscriber error:', e);
  });

  subscriber.start();
}

main().catch(console.error);

server.listen(3001, () => {
  console.log('Backend listening on http://localhost:3001');
});