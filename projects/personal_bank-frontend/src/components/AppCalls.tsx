import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { PersonalBankFactory } from '../contracts/PersonalBank'
import { OnSchemaBreak, OnUpdate } from '@algorandfoundation/algokit-utils/types/app'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'

interface AppCallsInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
  actionType: 'deposit' | 'withdraw'
}

const AppCalls = ({ openModal, setModalState, actionType }: AppCallsInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [contractInput, setContractInput] = useState<string>('')
  const { enqueueSnackbar } = useSnackbar()
  const { transactionSigner, activeAddress } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
  algorand.setDefaultSigner(transactionSigner)

  // Helper function to convert microAlgos to Algos for display
  const microAlgosToAlgos = (microAlgos: number | bigint): string => {
    const algos = Number(microAlgos) / 1_000_000;
    return algos.toFixed(6);
  }

  const sendAppCall = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setLoading(true)

    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet.', { variant: 'warning' })
      setLoading(false)
      return
    }

    try {
      const factory = new PersonalBankFactory({
        defaultSender: activeAddress,
        algorand,
      })

      const deployResult = await factory.deploy({
        onSchemaBreak: OnSchemaBreak.AppendApp,
        onUpdate: OnUpdate.AppendApp,
      })

      const { appClient } = deployResult

      // For deposits, validate input and create payTxn
      if (actionType === 'deposit') {
        if (!contractInput) {
          enqueueSnackbar('Please provide an amount.', { variant: 'warning' })
          setLoading(false)
          return
        }

        const amount = parseFloat(contractInput)
        if (isNaN(amount) || amount <= 0) {
          enqueueSnackbar('Enter a valid positive amount.', { variant: 'error' })
          setLoading(false)
          return
        }

        const payTxn = await algorand.createTransaction.payment({
          sender: activeAddress,
          receiver: appClient.appAddress,
          amount: AlgoAmount.Algos(amount),
        })

        const response = await appClient.send.deposit({
          args: { payTxn },
          populateAppCallResources: true,
        })

        // Convert microAlgos to Algos for display
        const depositedAlgos = microAlgosToAlgos(response.return);

        console.log(`Deposit called: ${response.return} microAlgos (${depositedAlgos} Algos)`)
        enqueueSnackbar(`Deposited: ${depositedAlgos} Algos`, { variant: 'success' })
      }

      if (actionType === 'withdraw') {
        const response = await appClient.send.withdraw({
          args: {},
          coverAppCallInnerTransactionFees: true,
          maxFee: AlgoAmount.MicroAlgo(3000),
        })

        // Convert microAlgos to Algos for display
        const withdrawnAlgos = microAlgosToAlgos(response.return);

        console.log(`Withdraw amount called: ${response.return} microAlgos (${withdrawnAlgos} Algos):::: ${response.txIds}`)
        enqueueSnackbar(`Withdrawn: ${withdrawnAlgos} Algos`, { variant: 'success' })
      }
    } catch (e: any) {
      enqueueSnackbar(`Error during ${actionType}: ${e.message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog id="appcalls_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
  <form method="dialog" className="modal-box">
    <h3 className="font-bold text-lg capitalize">
      {actionType} to your Algorand Personal Bank
    </h3>
    <br />

    {actionType === 'deposit' && (
      <input
        type="text"
        placeholder="Provide amount"
        className="input input-bordered w-full"
        value={contractInput}
        onChange={(e) => setContractInput(e.target.value)}
      />
    )}

    {actionType === 'withdraw' && (
      <p className="py-4 text-center">
        Do you want to withdraw all of your balance?
      </p>
    )}

    <div className="modal-action">
      <button type="button" className="btn" onClick={() => setModalState(false)}>
        Close
      </button>
      <button
        type="submit"
        className={`btn ${actionType === 'withdraw' ? 'btn-error' : 'btn-primary'}`}
        onClick={sendAppCall}
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner" />
        ) : (
          actionType === 'withdraw' ? 'Confirm Withdraw All' : `Send ${actionType}`
        )}
      </button>
    </div>
  </form>
</dialog>

  )
}

export default AppCalls