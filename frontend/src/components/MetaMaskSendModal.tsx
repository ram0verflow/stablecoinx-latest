import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { parseEther, isAddress } from 'viem';
import {
  ExternalLink,
  Loader2,
  Send,
  ShieldCheck,
  Wallet,
  X,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  payment: {
    id: string;
    senderCompany: string;
    receiverCompany: string;
    amount: number;
    token: string;
    corridor: string;
    receiver_wallet?: string;
  };
}

export const MetaMaskSendModal: React.FC<Props> = ({ onClose, payment }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [toAddress, setToAddress] = useState(payment.receiver_wallet || '');
  const [amountEth, setAmountEth] = useState('0.001'); // user sets MATIC amount
  const [txError, setTxError] = useState<string | null>(null);

  const isOnPolygonAmoy = chainId === polygonAmoy.id;

  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
    error: sendError,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (sendError) {
      setTxError(sendError.message?.split('\n')[0] || 'Transaction rejected');
    }
  }, [sendError]);

  const handleSwitchNetwork = () => {
    switchChain({ chainId: polygonAmoy.id });
  };

  const handleSend = () => {
    setTxError(null);
    if (!isAddress(toAddress)) {
      setTxError('Invalid receiver wallet address');
      return;
    }
    const parsed = parseFloat(amountEth);
    if (isNaN(parsed) || parsed <= 0) {
      setTxError('Amount must be a positive number');
      return;
    }
    try {
      sendTransaction({
        to: toAddress as `0x${string}`,
        value: parseEther(amountEth),
        chainId: polygonAmoy.id,
      });
    } catch (e: any) {
      setTxError(e?.message || 'Failed to send');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md p-6 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Send className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Send on Polygon Amoy</h2>
            <p className="text-xs text-slate-500">Real MetaMask transaction — no backend signing</p>
          </div>
        </div>

        {/* Not connected */}
        {!isConnected && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Connect your MetaMask wallet first (top-right button)</span>
          </div>
        )}

        {/* Payment context */}
        <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 space-y-1 mb-4">
          <div className="flex justify-between">
            <span>Payment</span>
            <span className="text-slate-300 font-mono">{payment.id.slice(0, 12)}...</span>
          </div>
          <div className="flex justify-between">
            <span>Corridor</span>
            <span className="text-slate-300">{payment.corridor}</span>
          </div>
          <div className="flex justify-between">
            <span>Compliance token</span>
            <span className="text-slate-300">{payment.token}</span>
          </div>
        </div>

        {/* From */}
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1">From (your MetaMask wallet)</label>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg">
            <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs text-slate-300 break-all">
              {isConnected ? address : 'Not connected'}
            </span>
          </div>
        </div>

        {/* To */}
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1">
            To (receiver wallet)
          </label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => { setToAddress(e.target.value); setTxError(null); }}
            placeholder="0x..."
            className="input-field font-mono text-xs"
            disabled={!!isConfirmed}
          />
          {payment.receiver_wallet && (
            <p className="text-[10px] text-slate-600 mt-1">
              Pre-filled from payment record: {payment.receiver_wallet}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1">
            Amount (MATIC on Polygon Amoy)
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.001"
              value={amountEth}
              onChange={(e) => { setAmountEth(e.target.value); setTxError(null); }}
              placeholder="0.001"
              className="input-field pr-16"
              disabled={!!isConfirmed}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">MATIC</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            Reference amount from payment: ${payment.amount.toLocaleString()} {payment.token}
          </p>
        </div>

        {/* Network warning */}
        {isConnected && !isOnPolygonAmoy && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Switch to Polygon Amoy to send</span>
            </div>
            <button
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
              className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-200 text-xs transition-colors flex items-center gap-1"
            >
              {isSwitching && <Loader2 className="w-3 h-3 animate-spin" />}
              Switch Network
            </button>
          </div>
        )}

        {/* Error */}
        {txError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-words">{txError}</span>
          </div>
        )}

        {/* TX Success */}
        {txHash && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isConfirming ? 'Waiting for confirmation...' : isConfirmed ? 'Transaction Confirmed!' : 'Transaction Submitted'}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-300 truncate">{txHash}</span>
              <a
                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-indigo-400 hover:text-indigo-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {isConfirming && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Waiting for block confirmation on Polygon Amoy...</span>
              </div>
            )}
            {isConfirmed && (
              <a
                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                View on PolygonScan Amoy
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary text-sm flex-1">
            {isConfirmed ? 'Close' : 'Cancel'}
          </button>
          {!isConfirmed && (
            <button
              onClick={isConnected && isOnPolygonAmoy ? handleSend : handleSwitchNetwork}
              disabled={!isConnected || isSending || isConfirming || isSwitching}
              className="btn-primary text-sm flex-1 flex items-center justify-center gap-2"
            >
              {(isSending || isConfirming) && <Loader2 className="w-4 h-4 animate-spin" />}
              {!isConnected
                ? 'Connect Wallet First'
                : !isOnPolygonAmoy
                ? 'Switch to Polygon Amoy'
                : isSending
                ? 'Confirm in MetaMask...'
                : isConfirming
                ? 'Confirming...'
                : 'Send via MetaMask'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
