from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

def check_user_balances(address):
    rpc_url = os.getenv("BASE_SEPOLIA_RPC_URL")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        print("Failed to connect to RPC")
        return

    checksum_address = Web3.to_checksum_address(address)
    eth_balance = w3.from_wei(w3.eth.get_balance(checksum_address), 'ether')
    print(f"ETH Balance: {eth_balance}")

    tokens = {
        "USDC": os.getenv("MOCK_USDC_ADDRESS"),
        "USDT": os.getenv("MOCK_USDT_ADDRESS")
    }

    abi = [{"constant": True, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function"}]

    for name, token_address in tokens.items():
        if token_address:
            try:
                contract = w3.eth.contract(address=Web3.to_checksum_address(token_address), abi=abi)
                balance = contract.functions.balanceOf(checksum_address).call()
                print(f"{name} Balance: {balance / 1e6}") # Assuming 6 decimals for USDC/USDT
            except Exception as e:
                print(f"Error checking {name}: {e}")

if __name__ == "__main__":
    check_user_balances("0xe5890ECE42A090d0B44b9f329E825dFD16Bf8341")
