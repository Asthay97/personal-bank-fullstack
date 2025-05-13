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

// Algorand logo component
const AlgoLogo = () => (
  <img
    src={algoLogo}
    alt="Algorand"
    className="inline-block h-4 w-4 ml-1"
  />
);

// Transaction card component (with inner transactions)
const TransactionCard = React.memo(({ txn }: { txn: Transaction }) => {
  // Get inner transactions
  const innerTxns = txn.innerTxns || [];

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
        <div className="text-xs text-gray-300 font-medium">
          <span className="text-gray-400 mr-1 uppercase text-xs font-bold">Round:</span>
          {txn.round}
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
                  : txn.type === 'pay' ? '0.001' : '0.001'
                }
              </span>
              <AlgoLogo />
            </div>
          </div>
        </div>
      </div>

      {/* Inner transactions */}
      {innerTxns.length > 0 && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
          <div className="text-gray-400 text-xs uppercase font-bold">Inner Transactions</div>
        </div>
      )}

      {innerTxns.map((innerTxn, idx) => (
        <div
          key={`inner-${txn.txnId || txn.id}-${idx}`}
          className="p-4 bg-gray-900 border-t border-gray-800 grid grid-cols-3 gap-4"
        >
          <div>
            <div className="mb-4">
              <div className="text-gray-400 text-xs uppercase font-bold mb-1">From</div>
              <div className="font-mono text-sm text-gray-200">
                {formatAddress(innerTxn.sender)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase font-bold mb-1">To</div>
              <div className="font-mono text-sm text-gray-200">
                {innerTxn.type === 'appl'
                  ? `App #${innerTxn.appId || '1290'}`
                  : formatAddress(innerTxn.receiver)
                }
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div>
              <div className="text-gray-400 text-xs uppercase font-bold text-center mb-2">Type</div>
              {innerTxn.type === 'pay' ? (
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
            <div className="mb-4">
              <div className="text-gray-400 text-xs uppercase font-bold mb-1">Amount</div>
              <div className="text-sm text-gray-200 flex items-center">
                <span className="font-medium">
                  {innerTxn.amount && parseFloat(formatAmount(innerTxn.amount)) > 0
                    ? formatAmount(innerTxn.amount)
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
                  {innerTxn.fee && parseFloat(formatAmount(innerTxn.fee)) > 0
                    ? formatAmount(innerTxn.fee)
                    : '0.000'
                  }
                </span>
                <AlgoLogo />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if txn ID changes - transactions never change once created
  return (prevProps.txn.id || prevProps.txn.txnId) === (nextProps.txn.id || nextProps.txn.txnId);
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

  // Fetch initial transactions
  useEffect(() => {
    if (dataLoaded.current) return;

    const fetchInitialData = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch transactions');

        const data = await response.json();
        if (isMounted.current) {
          setTxns(data);
          dataLoaded.current = true;
        }
      } catch (error) {
        console.error('Error fetching initial transactions:', error);
      }
    };

    fetchInitialData();

    return () => {
      dataLoaded.current = false;
    };
  }, []);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const socket = new WebSocket(WEBSOCKET_URL);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'init' && !dataLoaded.current) {
        setTxns(message.transactions || []);
        dataLoaded.current = true;
      }

      setTxns((prev) => {
        const newTxn = message?.transaction;
        if (!newTxn) return prev; // Skip if invalid

        const getTxnId = (txn: any) => txn.txnId || txn.id || '';

        const newTxnId = getTxnId(newTxn);
        if (!newTxnId) return prev; // Skip if still invalid

        const updated = [...prev];
        const index = updated.findIndex((t) => getTxnId(t) === newTxnId);

        if (index !== -1) {
          // Replace the existing txn
          updated[index] = newTxn;
        } else {
          // Insert new txn at the top
          updated.unshift(newTxn);
          if (updated.length > 10) updated.pop(); // Optional: limit history
        }

        return updated;
      });
    };

    return () => socket.close();
  }, []);

  return (
    <div className="h-full overflow-y-auto px-2">
      {txns.length === 0 ? (
        <div className="bg-gray-900 rounded-md p-6 text-center text-gray-300 shadow-lg my-4">
          <div className="text-lg font-medium mb-2">No Transactions</div>
          <div className="text-sm text-gray-400">Waiting for new transactions...</div>
        </div>
      ) : (
        <div className="py-3">
          {txns.map(txn => (
            <TransactionCard key={txn.id || txn.txnId} txn={txn} />
          ))}
        </div>
      )}
    </div>
  );
}