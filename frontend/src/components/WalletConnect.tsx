import React, { useEffect } from 'react'
import { useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { useWallet } from '../hooks/useWallet'

export const WalletConnect: React.FC = () => {
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { 
    address, 
    isConnected, 
    balance, 
    isCorrectNetwork, 
    networkName,
    switchToBaseSepolia
  } = useWallet()

  // Function to truncate address
  const truncateAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Effect to notify backend when connected
  useEffect(() => {
    const notifyBackend = async () => {
      if (isConnected && address) {
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
          await fetch(`${backendUrl}/api/v1/wallet/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Add auth token here if needed based on the current user session
              // 'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ address })
          })
        } catch (error) {
          console.error('Failed to notify backend about wallet connection', error)
        }
      }
    }
    notifyBackend()
  }, [isConnected, address])

  if (isConnected) {
    return (
      <div className="flex flex-col items-center sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
        {/* Wrong network alert */}
        {!isCorrectNetwork && (
          <div className="text-rose-400 text-xs font-semibold flex items-center space-x-2">
            <span>Wrong Network</span>
            <button 
              onClick={switchToBaseSepolia}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-2 py-1 rounded text-xs transition-colors border border-rose-500/30"
            >
              Switch Base Sepolia
            </button>
          </div>
        )}
        
        {/* Network Badge */}
        {isCorrectNetwork && (
          <div className="bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-md text-[10px] font-medium border border-indigo-500/30">
            {networkName}
          </div>
        )}

        {/* Balance & Address */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-300">{balance}</span>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono text-slate-300">{truncateAddress(address as string)}</span>
        </div>
        
        <button
          onClick={() => disconnect()}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          title="Disconnect Wallet"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="btn-secondary text-xs flex items-center gap-2 !py-1.5 !px-3"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
      Connect Wallet
    </button>
  )
}
