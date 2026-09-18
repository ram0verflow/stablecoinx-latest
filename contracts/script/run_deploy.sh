#!/bin/bash

# Load environment variables from .env
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $BACKEND_WALLET_PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api-sepolia.basescan.org/api \
  --etherscan-api-key $ALCHEMY_API_KEY \
  -vvvv
