from app.services.blockchain.wallet_service import wallet_service

class FaucetChecker:
    def check_balance_sufficient(self, address: str, required_amount_ether: float = 0.01) -> bool:
        """
        Checks if the address has sufficient balance.
        Prints warning if balance below 0.01 ETH.
        """
        balance = wallet_service.get_wallet_balance(address)
        ether_balance = balance.get("ether", 0)
        
        if ether_balance < required_amount_ether:
            print(f"WARNING: Wallet {address} balance is low: {ether_balance} ETH. Expected at least {required_amount_ether} ETH.")
            return False
            
        return True

faucet_checker = FaucetChecker()
