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
    console.log("Loaded cached transactions:", cachedTransactions.length);
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
  const existingIndex = transactions.findIndex(t => t.txnId === transaction.txnId);

  if (existingIndex >= 0) {
    // Transaction already exists, update it if necessary
    const existingTxn = transactions[existingIndex];

    // Update with inner transactions if available
    if (transaction.innerTxns && transaction.innerTxns.length > 0) {
      console.log(`Updating transaction ${transaction.txnId} with ${transaction.innerTxns.length} inner transactions`);
      transactions[existingIndex] = {
        ...existingTxn,
        innerTxns: transaction.innerTxns
      };

      // Save updated transactions
      saveTransactions(transactions);
    } else {
      console.log(`Transaction ${transaction.txnId} already exists, no update needed`);
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

// Transform Algorand transaction to our format
const transformTransaction = (txn, ctx) => {
  // Get the confirmed round number from the context or the transaction
  const confirmedRound = ctx?.round || txn.confirmedRound || null;

  console.log(`Transforming transaction ${txn.id}, round: ${confirmedRound}`);

  // Basic transaction data
  const txnData = {
    txnId: txn.id,
    id: txn.id, // Keep both for backward compatibility
    sender: txn.sender,
    receiver: txn.paymentTransaction?.receiver || null,
    amount: txn.paymentTransaction?.amount?.toString() || '0',
    appId: txn.applicationTransaction?.applicationId?.toString() || null,
    type: txn.txType || 'unknown',
    round: confirmedRound ? confirmedRound.toString() : '0',
    fee: txn.fee?.toString() || '1000',
    timestamp: Math.floor(Date.now() / 1000), // Current timestamp
    innerTxns: []
  };

  // Process inner transactions if they exist
  if (txn.innerTransactions && txn.innerTransactions.length > 0) {
    console.log(`Processing ${txn.innerTransactions.length} inner transactions for ${txn.id}`);

    txnData.innerTxns = txn.innerTransactions.map((innerTxn, index) => {
      // Create a stable ID that doesn't include slashes
      const innerTxnId = innerTxn.id || `inner_${txn.id}_${index}`;

      console.log(`Processing inner transaction ${index} with ID: ${innerTxnId}`);
      return {
        txnId: innerTxnId,
        id: innerTxnId,
        sender: innerTxn.sender,
        receiver: innerTxn.paymentTransaction?.receiver || null,
        amount: innerTxn.paymentTransaction?.amount?.toString() || '0',
        appId: innerTxn.applicationTransaction?.applicationId?.toString() || null,
        type: innerTxn.txType || 'unknown',
        round: confirmedRound ? confirmedRound.toString() : '0',
        fee: innerTxn.fee?.toString() || '0',
        timestamp: Math.floor(Date.now() / 1000),
        isInner: true,
        parentTxnId: txn.id // Add reference to parent transaction
      };
    });
  }

  return txnData;
};

// Handle a transaction event
const handleTransaction = async (txn, ctx, algorand) => {
  try {
    console.log(`Processing transaction ${txn.id} from round ${ctx?.round}`);

    // Transform to our format
    const transformedTxn = transformTransaction(txn, ctx);

    // Log inner transactions if present
    if (transformedTxn.innerTxns && transformedTxn.innerTxns.length > 0) {
      console.log(`Transaction ${txn.id} has ${transformedTxn.innerTxns.length} inner transactions`);
      transformedTxn.innerTxns.forEach((inner, idx) => {
        console.log(`  [${idx}] ${inner.txnId} - Type: ${inner.type}, Amount: ${inner.amount}, Round: ${inner.round}`);
      });
    }

    // Add to storage
    const updatedTransactions = addTransaction(transformedTxn);

    // Broadcast to connected clients
    const updateMessage = JSON.stringify({
      type: 'update',
      transaction: transformedTxn,
    });

    sockets.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(updateMessage);
      }
    });
  } catch (error) {
    console.error('Error handling transaction:', error);
  }
};

// Initialize storage on startup
cachedTransactions = initializeTransactionsStorage();

// API endpoint to get latest transactions
app.get('/api/transactions', (req, res) => {
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
  try {
    const algorand = AlgorandClient.defaultLocalNet();

    // Configure the subscriber with proper options for inner transactions
    const subscriber = new AlgorandSubscriber(
      {
        // Main filter for our account transactions
        filters: [
          {
            name: 'account',
            filter: {
              address: ACCOUNT_ADDRESS,
              // Include both incoming and outgoing transactions
              includeIncomingTransactions: true,
              includeOutgoingTransactions: true,
              // Explicitly include inner transactions
              includeInnerTransactions: true
            }
          }
        ],
        watermarkPersistence: {
          get: async () => 0n,
          set: async () => {},
        },
        syncBehaviour: 'skip-sync-newest',
        waitForBlockWhenAtTip: true,
        // Enable detailed transaction data including inner txs
        maxRoundsToSync: 10000n, // Limited history sync to avoid overload
        onMaxRoundsSyncStart: () => console.log('Starting limited history sync...'),
        onMaxRoundsSyncComplete: () => console.log('Limited history sync complete'),
      },
      algorand.client.algod,
      algorand.client.indexer // Make sure indexer is used for complete transaction data
    );

    // Register event handler for account transactions
    subscriber.on('account', async (txn, ctx) => {
      console.log(`Received transaction ${txn.id} in round ${ctx?.round}`);

      // Only process transactions that involve our account
      if (txn.sender === ACCOUNT_ADDRESS ||
          txn.paymentTransaction?.receiver === ACCOUNT_ADDRESS) {
        await handleTransaction(txn, ctx, algorand);
      } else {
        // Check if our account is involved in inner transactions
        const hasRelevantInnerTxn = txn.innerTransactions?.some(inner =>
          inner.sender === ACCOUNT_ADDRESS ||
          inner.paymentTransaction?.receiver === ACCOUNT_ADDRESS
        );

        if (hasRelevantInnerTxn) {
          console.log(`Transaction ${txn.id} has inner transactions involving our account`);
          await handleTransaction(txn, ctx, algorand);
        }
      }
    });

    // Error handler
    subscriber.onError((error) => {
      console.error('Subscriber error:', error);
    });

    console.log('Starting transaction subscriber...');
    await subscriber.start();
    console.log('Transaction subscriber started successfully');
  } catch (error) {
    console.error('Failed to start transaction subscriber:', error);
  }
}

main().catch(console.error);

server.listen(3001, () => {
  console.log('Backend listening on http://localhost:3001');
});