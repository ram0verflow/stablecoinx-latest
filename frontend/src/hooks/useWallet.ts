import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { baseSepolia, polygonAmoy } from 'wagmi/chains'

export function useWallet() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: balanceData } = useBalance({ address })
  const { switchChain } = useSwitchChain()

  const balance = balanceData ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}` : '0 ETH'

  const switchToBaseSepolia = () => {
    switchChain({ chainId: baseSepolia.id })
  }
  
  const switchToPolygonAmoy = () => {
    switchChain({ chainId: polygonAmoy.id })
  }

  const isCorrectNetwork = chainId === baseSepolia.id || chainId === polygonAmoy.id
  
  const networkName = chainId === baseSepolia.id ? 'Base Sepolia' : 
                      chainId === polygonAmoy.id ? 'Polygon Amoy' : 'Wrong Network'

  return {
    address,
    isConnected,
    chainId,
    balance,
    isCorrectNetwork,
    networkName,
    switchToBaseSepolia,
    switchToPolygonAmoy
  }
}
