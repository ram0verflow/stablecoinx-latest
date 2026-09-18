import { http, createConfig } from 'wagmi'; // FIXED: M3
import { baseSepolia, polygonAmoy } from 'wagmi/chains'; // FIXED: M3
import { injected, walletConnect } from 'wagmi/connectors'; // FIXED: M3

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'placeholder';
if (!import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) {
  console.error('Missing env: VITE_WALLETCONNECT_PROJECT_ID');
}

const chainIdRaw = import.meta.env.VITE_CHAIN_ID || '80002';
const chainId = parseInt(chainIdRaw, 10);
const selectedChain = [baseSepolia, polygonAmoy].find((c) => c.id === chainId) || polygonAmoy;

if (!import.meta.env.VITE_CHAIN_ID) {
  console.error('Missing env: VITE_CHAIN_ID');
}
if (Number.isNaN(chainId)) {
  console.error('Invalid VITE_CHAIN_ID');
}

// RPC URLs: prefer explicit env; otherwise use chain defaults from wagmi (no hardcoded provider hosts).
const baseRpc =
  import.meta.env.VITE_BASE_SEPOLIA_RPC?.trim() || baseSepolia.rpcUrls.default.http[0];
const polygonRpc =
  import.meta.env.VITE_POLYGON_AMOY_RPC_URL?.trim() || polygonAmoy.rpcUrls.default.http[0];

const transports = {
  [baseSepolia.id]: http(baseRpc),
  [polygonAmoy.id]: http(polygonRpc),
};

export const config = createConfig({
  chains: [polygonAmoy, baseSepolia],
  connectors: [
    injected(),
    ...(walletConnectProjectId && !walletConnectProjectId.includes('placeholder') 
      ? [walletConnect({ projectId: walletConnectProjectId })] 
      : [])
  ],
  transports,
});
