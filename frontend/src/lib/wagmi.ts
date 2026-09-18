import { http, createConfig } from 'wagmi'
import { baseSepolia, polygonAmoy } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Use VITE_ALCHEMY_API_KEY for custom RPC URL or rely on public ones if not set
const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY;

export const config = createConfig({
  chains: [baseSepolia, polygonAmoy],
  connectors: [
    injected(),
    // We provide a fallback WalletConnect project ID, though it should ideally come from env
    walletConnect({ projectId: '1234567890abcdef1234567890abcdef' }),
  ],
  transports: {
    [baseSepolia.id]: http(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`),
    [polygonAmoy.id]: http(`https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`),
  },
})
