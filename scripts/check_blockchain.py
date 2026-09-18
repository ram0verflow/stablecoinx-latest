import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

def check_contract_abis():
    """Match ContractService: prefer forge out/, else committed contracts/abis/."""
    print("--- Contract ABI artifacts ---")
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    names = [
        "PaymentAuthorization",
        "SettlementProofRegistry",
        "PolicyRegistry",
        "MockStablecoinERC20",
    ]
    abi_dir = os.path.join(root, "contracts", "abis")
    out_dir = os.path.join(root, "contracts", "out")
    all_ok = True
    for name in names:
        forge_file = os.path.join(out_dir, f"{name}.sol", f"{name}.json")
        committed = os.path.join(abi_dir, f"{name}.json")
        if os.path.isfile(forge_file):
            print(f"[OK] {name}: forge output")
        elif os.path.isfile(committed):
            print(f"[OK] {name}: contracts/abis (fallback)")
        else:
            print(f"[ERR] {name}: no ABI (run forge build in contracts/)")
            all_ok = False
    return all_ok

def check_blockchain():
    print("--- Blockchain Connectivity Audit ---")
    
    rpc_url = os.getenv("BASE_SEPOLIA_RPC_URL")
    wallet_address = os.getenv("BACKEND_WALLET_ADDRESS")
    
    if not rpc_url:
        print("[ERR] Base Sepolia RPC URL missing")
        return

    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if w3.is_connected():
            print(f"[OK] RPC: Connected to {rpc_url}")
            if wallet_address:
                balance = w3.eth.get_balance(wallet_address)
                print(f"[OK] Wallet: {wallet_address}")
                print(f"[INFO] Balance: {w3.from_wei(balance, 'ether')} ETH")
            else:
                print("[WARN] Wallet address missing")
        else:
            print(f"[ERR] RPC: Could not connect to {rpc_url}")
    except Exception as e:
        print(f"[ERR] RPC: Connection failed - {e}")

if __name__ == "__main__":
    check_contract_abis()
    check_blockchain()
