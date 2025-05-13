import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import Transact from './components/Transact'
import AppCalls from './components/AppCalls'
import TransactionList from './components/TransactionFeed'

const Home: React.FC = () => {
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const [openDemoModal, setOpenDemoModal] = useState(false)
  const [appCallsDemoModal, setAppCallsDemoModal] = useState(false)
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit')
  const { activeAddress } = useWallet()

  const toggleWalletModal = () => setOpenWalletModal(!openWalletModal)
  const toggleDemoModal = () => setOpenDemoModal(!openDemoModal)
  const toggleAppCallsModal = () => setAppCallsDemoModal(!appCallsDemoModal)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 bg-black bg-opacity-100 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <img src="/algorand-logo-light.svg" alt="Algorand Logo" className="h-8" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Personal Bank Demo
          </h1>
          <p className="text-gray-400 text-sm">Decentralised Banking</p>
        </div>
        <button className="btn btn-outline btn-sm text-white border-white" onClick={toggleWalletModal}>
          {activeAddress ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : 'Connect Wallet'}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row flex-1 p-4 gap-4 max-w-7xl mx-auto w-full">
  <div className="flex flex-col gap-4 lg:w-1/3">
    <div className="bg-white shadow rounded p-6 text-center"> {/* Smaller padding */}
      {activeAddress ? (
        <div className="flex flex-col gap-3">
          <button className="btn btn-primary" onClick={() => { setActionType('deposit'); toggleAppCallsModal(); }}>
            Deposit
          </button>
          <button className="btn btn-secondary" onClick={() => { setActionType('withdraw'); toggleAppCallsModal(); }}>
            Withdraw
          </button>
          <button className="btn btn-accent" onClick={toggleDemoModal}>
            Transactions Demo
          </button>
        </div>
      ) : (
        <p className="text-gray-700">Please connect your wallet to begin.</p>
      )}

      <div className="divider" />

      <a
        className="btn btn-outline"
        target="_blank"
        rel="noopener noreferrer"
        href="https://dev.algorand.co/"
      >
        Learn more
      </a>
    </div>

    <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
    <AppCalls openModal={appCallsDemoModal} setModalState={setAppCallsDemoModal} actionType={actionType} />
  </div>

  {activeAddress ? (
  <div className="lg:w-2/3">
    <div className="bg-white shadow rounded p-4 h-[400px] overflow-y-auto">
      <h2 className="text-xl font-semibold mb-2 text-gray-800">LIVE TRANSACTIONS</h2>
      <TransactionList address={activeAddress} />
    </div>
  </div>
) : (
  <p className="text-gray-700">Please connect your wallet to see transactions.</p>
)}
</div>

    </div>
  )
}

export default Home
