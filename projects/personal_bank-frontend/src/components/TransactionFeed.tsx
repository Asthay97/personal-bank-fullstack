import React from 'react';
import { useEffect, useState, useRef } from 'react';
import algoLogo from "../assets/algo-logo-white.png";
const WEBSOCKET_URL = 'ws://localhost:3001';
const API_URL = 'http://localhost:3001/api/transactions';

type Transaction = {
  txnId: string;      // Transaction ID
  id?: string;        // Alternative transaction ID field
  round: string;      // Round number
  sender: string;     // Sender address
  receiver: string;   // Receiver address
  type: string;       // Transaction type (pay or appl)
  amount: string;     // Amount in micro-algorithm (µALGO)
  fee: string;        // Fee for the transaction
  timestamp?: number; // Timestamp when the transaction was processed
  appId?: string;     // Application ID for application calls
  innerTxns?: Transaction[]; // Inner transactions
  isInner?: boolean;  // Flag to indicate if this is an inner transaction
  parentTxnId?: string; // Reference to parent transaction ID (for inner transactions)
  groupId?: string;   // Group ID for grouped transactions
};

// Format amount from microAlgos to ALGOs
const formatAmount = (amount: string) => {
  const amountInNumber = parseInt(amount, 10);
  if (isNaN(amountInNumber)) return '0.000';
  return (amountInNumber / 1_000_000).toFixed(3);
};

// Format addresses to be shorter
const formatAddress = (address: string) => {
  if (!address) return '-';
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
};

// Format transaction ID to be shorter
const formatTxnId = (txnId: string) => {
  if (!txnId) return '-';
  return `${txnId.substring(0, 8)}...`;
};

// // Format timestamp to human-readable date
// const formatTimestamp = (timestamp?: number) => {
//   if (!timestamp) return '';
//   const date = new Date(timestamp * 1000);
//   return date.toLocaleString('en-US', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//     hour: '2-digit',
//     minute: '2-digit',
//     second: '2-digit',
//     hour12: false
//   });
// };

// Algorand logo component
const AlgoLogo = () => (
  <img
    src={algoLogo}
    alt="Algorand"
    className="inline-block h-4 w-4 ml-1"
  />
);

// Inner transaction component
const InnerTransactionCard = React.memo(({ txn }: { txn: Transaction }) => {
  return (
    <div className="p-3 border-t border-gray-800 grid grid-cols-3 gap-4 bg-gray-900 bg-opacity-60">
      <div>
        <div className="mb-3">
          <div className="text-gray-400 text-xs uppercase font-bold mb-1">From</div>
          <div className="font-mono text-sm text-gray-200">
            {formatAddress(txn.sender)}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase font-bold mb-1">To</div>
          <div className="font-mono text-sm text-gray-200">
            {txn.type === 'appl'
              ? `App #${txn.appId || '1290'}`
              : formatAddress(txn.receiver)
            }
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div>
          <div className="text-gray-400 text-xs uppercase font-bold text-center mb-2">Type</div>
          {txn.type === 'pay' ? (
            <div className="bg-green-900 text-green-300 text-sm font-medium py-1 px-3 rounded-full text-center">
              Payment
            </div>
          ) : (
            <div className="bg-blue-900 text-blue-300 text-sm font-medium py-1 px-3 rounded-full text-center">
              Application Call
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="mb-3">
          <div className="text-gray-400 text-xs uppercase font-bold mb-1">Amount</div>
          <div className="text-sm text-gray-200 flex items-center">
            <span className="font-medium">
              {txn.amount && parseFloat(formatAmount(txn.amount)) > 0
                ? formatAmount(txn.amount)
                : '0.000'
              }
            </span>
            <AlgoLogo />
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase font-bold mb-1">Fee</div>
          <div className="text-sm text-gray-200 flex items-center">
            <span className="font-medium">
              {txn.fee && parseFloat(formatAmount(txn.fee)) > 0
                ? formatAmount(txn.fee)
                : '0.000'
              }
            </span>
            <AlgoLogo />
          </div>
        </div>
      </div>
    </div>
  );
});

// Transaction card component (with inner transactions)
const TransactionCard = React.memo(({ txn }: { txn: Transaction }) => {
  // Get inner transactions
  const innerTxns = txn.innerTxns || [];
  const hasInnerTxns = innerTxns.length > 0;

  // Determine border color based on transaction type
  const getBorderColor = () => {
    return txn.type === 'pay' ? 'border-l-green-500' : 'border-l-blue-500';
  };

  return (
    <div className={`mb-5 rounded-md overflow-hidden border-l-4 ${getBorderColor()} bg-gray-900 shadow-lg`}>
      {/* Header with Transaction ID and Round/Timestamp */}
      <div className="px-4 py-3 bg-gray-800 flex justify-between items-center">
        <div className="font-mono text-sm text-gray-200 font-medium">
          <span className="text-gray-400 mr-2 uppercase text-xs font-bold">Txn ID:</span>
          {formatTxnId(txn.txnId || txn.id || '')}
        </div>
        <div className="text-xs text-gray-300 font-medium flex items-center">
          <div className="mr-3">
            <span className="text-gray-400 mr-1 uppercase text-xs font-bold">Round:</span>
            {txn.round}
          </div>
          {/* <div>
            <span className="text-gray-400 mr-1 uppercase text-xs font-bold">Time:</span>
            {formatTimestamp(txn.timestamp)}
          </div> */}
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 grid grid-cols-3 gap-4">
        {/* Left column: From/To */}
        <div>
          <div className="mb-4">
            <div className="text-gray-400 text-xs uppercase font-bold mb-1">From</div>
            <div className="font-mono text-sm text-gray-200">
              {formatAddress(txn.sender)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs uppercase font-bold mb-1">To</div>
            <div className="font-mono text-sm text-gray-200">
              {txn.type === 'appl'
                ? `App #${txn.appId || '1290'}`
                : formatAddress(txn.receiver)
              }
            </div>
          </div>
        </div>

        {/* Middle column: Type */}
        <div className="flex items-center justify-center">
          <div>
            <div className="text-gray-400 text-xs uppercase font-bold text-center mb-2">Type</div>
            {txn.type === 'pay' ? (
              <div className="bg-green-900 text-green-300 text-sm font-medium py-1 px-3 rounded-full text-center">
                Payment
              </div>
            ) : (
              <div className="bg-blue-900 text-blue-300 text-sm font-medium py-1 px-3 rounded-full text-center">
                Application Call
              </div>
            )}
          </div>
        </div>

        {/* Right column: Amount/Fee */}
        <div>
          <div className="mb-4">
            <div className="text-gray-400 text-xs uppercase font-bold mb-1">Amount</div>
            <div className="text-sm text-gray-200 flex items-center">
              <span className="font-medium">
                {txn.amount && parseFloat(formatAmount(txn.amount)) > 0
                  ? formatAmount(txn.amount)
                  : '0.000'
                }
              </span>
              <AlgoLogo />
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs uppercase font-bold mb-1">Fee</div>
            <div className="text-sm text-gray-200 flex items-center">
              <span className="font-medium">
                {txn.fee && parseFloat(formatAmount(txn.fee)) > 0
                  ? formatAmount(txn.fee)
                  : txn.type === 'pay' ? '0.001' : (hasInnerTxns ? '0.002' : '0.001')
                }
              </span>
              <AlgoLogo />
            </div>
          </div>
        </div>
      </div>

      {/* Inner transactions */}
      {hasInnerTxns && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
          <div className="text-gray-400 text-xs uppercase font-bold">Inner Transactions</div>
        </div>
      )}

      {innerTxns.map((innerTxn, idx) => (
        <InnerTransactionCard key={`inner-${idx}-${innerTxn.txnId || innerTxn.id}`} txn={innerTxn} />
      ))}
    </div>
  );
});

// Transaction group component (handles order of transactions within a group)
const TransactionGroup = React.memo(({ transactions }: { transactions: Transaction[] }) => {
  // Sort transactions by type within the group
  const sortedTransactions = [...transactions].sort((a, b) => {
    // Application call first, payment second
    if (a.type === 'appl' && b.type === 'pay') return -1;
    if (a.type === 'pay' && b.type === 'appl') return 1;
    return 0;
  });

  return (
    <>
      {sortedTransactions.map(txn => (
        <TransactionCard key={txn.id || txn.txnId} txn={txn} />
      ))}
    </>
  );
});

export default function TransactionList({ address }: { address: string }) {
  // State for transactions
  const [txns, setTxns] = useState<Transaction[]>([]);
  // Track if initial data has been loaded
  const dataLoaded = useRef(false);
  // Track if component is mounted
  const isMounted = useRef(true);
  // Reference to websocket connection
  const socketRef = useRef<WebSocket | null>(null);

  // Helper function to get consistent transaction IDs
  const getTxnId = (txn: any) => txn.txnId || txn.id || '';

  // Group transactions by round and group ID
  const groupTransactions = (transactions: Transaction[]): Record<string, Transaction[]> => {
    const groups: Record<string, Transaction[]> = {};

    transactions.forEach(txn => {
      const roundKey = txn.round || '0';
      const groupKey = txn.groupId || '';
      const key = `${roundKey}-${groupKey}`;

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(txn);
    });

    return groups;
  };

  // Process transactions to ensure inner transactions are grouped with their parents
  const processTransactions = (transactions: Transaction[]): Transaction[] => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    try {
      // Make a copy of the transactions
      const processed = [...transactions];

      // Filter out standalone inner transactions
      const innerTxnIds = new Set<string>();
      processed.forEach(txn => {
        if (txn.isInner && txn.parentTxnId) {
          innerTxnIds.add(getTxnId(txn));
        }
      });

      // Keep only non-inner transactions
      const mainTxns = processed.filter(txn => !innerTxnIds.has(getTxnId(txn)));

      // Group transactions by round and groupId
      const groupedTxns = groupTransactions(mainTxns);

      // Attach inner transactions to their parents and prepare final list
      const finalTxns: Transaction[] = [];

      // For each group, make sure Application Call comes before Payment
      Object.values(groupedTxns).forEach(group => {
        // Sort group - application calls first, then payments
        const sortedGroup = [...group].sort((a, b) => {
          if (a.type === 'appl' && b.type === 'pay') return -1;
          if (a.type === 'pay' && b.type === 'appl') return 1;
          return 0;
        });

        // Find inner transactions for this group
        sortedGroup.forEach(txn => {
          const txnId = getTxnId(txn);
          // Set inner transactions in app call transactions
          if (txn.type === 'appl') {
            txn.innerTxns = processed.filter(
              t => t.isInner && t.parentTxnId === txnId
            );
          }
        });

        // Add transactions to final list
        finalTxns.push(...sortedGroup);
      });

      // Sort all transactions by round (descending)
      finalTxns.sort((a, b) => {
        const roundA = parseInt(a.round || '0', 10);
        const roundB = parseInt(b.round || '0', 10);
        return roundB - roundA;
      });

      return finalTxns;
    } catch (error) {
      console.error("Error processing transactions:", error);
      return transactions; // Return original if processing fails
    }
  };

  // Fetch initial transactions
  useEffect(() => {
    if (dataLoaded.current) return;

    const fetchInitialData = async () => {
      try {
        console.log("Fetching initial transactions from API");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch transactions');

        const data = await response.json();
        console.log("Received initial transaction data:", data?.length || 0);

        if (isMounted.current) {
          const processedData = processTransactions(data);
          console.log("Setting initial transactions:", processedData.length);
          setTxns(processedData);
          dataLoaded.current = true;
        }
      } catch (error) {
        console.error('Error fetching initial transactions:', error);
      }
    };

    fetchInitialData();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    console.log("Connecting to WebSocket:", WEBSOCKET_URL);
    let socket: WebSocket | null = null;

    // Function to create and set up WebSocket
    const setupWebSocket = () => {
      socket = new WebSocket(WEBSOCKET_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connection established!");
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason);

        // Try to reconnect after a short delay
        setTimeout(() => {
          if (isMounted.current) {
            console.log("Attempting to reconnect WebSocket...");
            setupWebSocket();
          }
        }, 3000);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message.type);

          if (message.type === 'init' && !dataLoaded.current) {
            console.log("Received initialization data via WebSocket");
            const processedData = processTransactions(message.transactions || []);
            console.log("Setting transactions from WebSocket init:", processedData.length);
            setTxns(processedData);
            dataLoaded.current = true;
          }

          if (message.type === 'update') {
            console.log("Received transaction update:", message.transaction?.txnId);

            setTxns((prev) => {
              const newTxn = message?.transaction;
              if (!newTxn) return prev;

              const newTxnId = getTxnId(newTxn);
              if (!newTxnId) return prev;

              console.log(`Processing update for transaction: ${newTxnId}, type: ${newTxn.type}`);

              // Make a copy of current transactions
              let updatedTxns = [...prev];

              // Handle inner transactions
              if (newTxn.isInner && newTxn.parentTxnId) {
                console.log(`Processing inner transaction with parent: ${newTxn.parentTxnId}`);

                // Find the parent transaction
                const parentIndex = updatedTxns.findIndex(t => getTxnId(t) === newTxn.parentTxnId);

                if (parentIndex >= 0) {
                  console.log(`Found parent at index ${parentIndex}`);

                  // Ensure parent has innerTxns array
                  if (!updatedTxns[parentIndex].innerTxns) {
                    updatedTxns[parentIndex].innerTxns = [];
                  }

                  // Add or update inner transaction
                  const innerTxnIndex = updatedTxns[parentIndex].innerTxns.findIndex(
                    t => getTxnId(t) === newTxnId
                  );

                  if (innerTxnIndex >= 0) {
                    updatedTxns[parentIndex].innerTxns[innerTxnIndex] = newTxn;
                  } else {
                    updatedTxns[parentIndex].innerTxns.push(newTxn);
                  }

                  console.log(`Updated parent transaction with inner transaction`);
                } else {
                  console.log(`Parent transaction ${newTxn.parentTxnId} not found, storing inner for later`);
                  // Store inner transaction for later
                  updatedTxns.push(newTxn);
                }
              } else {
                // Handle normal transactions
                console.log(`Processing normal transaction: ${newTxnId}`);

                const existingIndex = updatedTxns.findIndex(t => getTxnId(t) === newTxnId);

                if (existingIndex >= 0) {
                  console.log(`Updating existing transaction at index ${existingIndex}`);

                  // Update existing transaction but preserve inner transactions
                  const existingInnerTxns = updatedTxns[existingIndex].innerTxns || [];
                  updatedTxns[existingIndex] = {
                    ...newTxn,
                    innerTxns: newTxn.innerTxns || existingInnerTxns
                  };
                } else {
                  console.log(`Adding new transaction: ${newTxnId}`);

                  // Check if this is a parent for any waiting inner transactions
                  const pendingInners = updatedTxns.filter(
                    t => t.isInner && t.parentTxnId === newTxnId
                  );

                  if (pendingInners.length > 0) {
                    console.log(`Found ${pendingInners.length} pending inner transactions for this parent`);

                    // Attach pending inners to this new transaction
                    newTxn.innerTxns = pendingInners;

                    // Add new transaction and remove the inner transactions that are now attached
                    updatedTxns = [
                      newTxn,
                      ...updatedTxns.filter(t => !(t.isInner && t.parentTxnId === newTxnId))
                    ];
                  } else {
                    // Add the new transaction at the beginning
                    updatedTxns.unshift(newTxn);
                  }
                }
              }

              // Process the updated transactions list
              const processedTxns = processTransactions(updatedTxns);
              console.log(`Processed ${processedTxns.length} transactions after update`);

              return processedTxns;
            });
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
    };

    // Initial WebSocket setup
    setupWebSocket();

    // Clean up on unmount
    return () => {
      console.log("Cleaning up WebSocket connection");
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  // Get transaction groups for display
  const getTransactionGroups = () => {
    // Group transactions by round and groupId
    const groups: Record<string, Transaction[]> = {};

    txns.forEach(txn => {
      const roundKey = txn.round || '0';
      const groupKey = txn.groupId || '';
      const key = `${roundKey}-${groupKey}`;

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(txn);
    });

    // Convert to array of groups and sort by round
    return Object.entries(groups)
      .sort(([keyA], [keyB]) => {
        const roundA = parseInt(keyA.split('-')[0], 10);
        const roundB = parseInt(keyB.split('-')[0], 10);
        return roundB - roundA; // Higher rounds first
      })
      .map(([_, transactions]) => transactions);
  };

  // Get transaction groups
  const transactionGroups = getTransactionGroups();

  return (
    <div className="h-full overflow-y-auto">
      {txns.length === 0 ? (
        <div className="bg-gray-900 rounded-md p-6 text-center text-gray-300 shadow-lg my-4 h-64 flex items-center justify-center">
          <div>
            <div className="text-lg font-medium mb-2">No Transactions</div>
            <div className="text-sm text-gray-400">Waiting for new transactions...</div>
          </div>
        </div>
      ) : (
        <div className="py-3 overflow-hidden">
          {transactionGroups.map((group, idx) => (
            <TransactionGroup key={`group-${idx}`} transactions={group} />
          ))}
        </div>
      )}
    </div>
  );
}