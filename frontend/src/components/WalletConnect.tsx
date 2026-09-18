import React, { useEffect, useRef } from 'react'
import { useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { useWallet } from '../hooks/useWallet'
import { useAuthStore } from '../store/authStore'

export const WalletConnect: React.FC = () => {
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { address, isConnected, balance, isCorrectNetwork, networkName, switchToBaseSepolia, switchToPolygonAmoy } = useWallet()
  const { token, setWallet } = useAuthStore()
  const savedRef = useRef<string | null>(null)

  const truncateAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Notify backend & update local auth store when wallet connects
  useEffect(() => {
    const notifyBackend = async () => {
      if (!isConnected || !address) return
      if (savedRef.current === address) return // already saved this session
      savedRef.current = address

      // Update local zustand store so user.walletAddress is populated everywhere
      setWallet(address)

      try {
        const backendUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL
        if (!backendUrl) throw new Error('Missing VITE_API_BASE_URL (or VITE_BACKEND_URL)')
        const res = await fetch(`${backendUrl}/api/v1/wallet/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ address }),
        })
        if (!res.ok) {
          console.warn('Backend wallet save returned non-OK:', res.status)
        }
      } catch (error) {
        console.error('Failed to save wallet to backend', error)
      }
    }
    notifyBackend()
  }, [isConnected, address, token, setWallet])

  if (isConnected) {
    return (
      <div className="flex flex-col items-center sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
        {/* Wrong network alert */}
        {!isCorrectNetwork && (
          <div className="flex items-center gap-1.5">
            <span className="text-rose-400 text-[10px] font-black uppercase tracking-tighter mr-1">Wrong Network</span>
            <button
              onClick={switchToBaseSepolia}
              className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded text-[10px] font-bold transition-all border border-indigo-500/20"
            >
              Switch Base
            </button>
            <button
              onClick={switchToPolygonAmoy}
              className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-[10px] font-bold transition-all border border-purple-500/20"
            >
              Switch Polygon
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
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-300">{balance}</span>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono text-slate-300">{truncateAddress(address as string)}</span>
        </div>

        <button
          onClick={() => { disconnect(); savedRef.current = null; }}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          title="Disconnect Wallet"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="btn-secondary text-xs flex items-center gap-2 !py-1.5 !px-3"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      Connect Wallet
    </button>
  )
}
