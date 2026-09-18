from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.users import User
from app.api.dependencies import get_current_user
from app.services.blockchain.wallet_service import wallet_service
from app.services.blockchain.rpc_service import rpc_service
from app.services.compliance.compliance_engine import SANCTIONED_WALLETS

router = APIRouter()

class ConnectWalletRequest(BaseModel):
    address: str

@router.post("/connect")
def connect_wallet(
    request: ConnectWalletRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save wallet address to user record in DB
    """
    if not request.address:
        raise HTTPException(status_code=400, detail="Address is required")

    if request.address.lower() in {w.lower() for w in SANCTIONED_WALLETS}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rejected: sanctioned wallet cannot be connected",
        )
        
    current_user.wallet_address = request.address
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return {"status": "success", "wallet_address": current_user.wallet_address}

@router.get("/balance/{address}")
def get_balance(
    address: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return ETH balance from RPC
    """
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")
        
    try:
        balance = wallet_service.get_wallet_balance(address)
        return {"address": address, "balance": balance}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/network-status")
def get_network_status():
    """
    Return health of both RPCs
    """
    base_health = rpc_service.check_rpc_health("base_sepolia")
    polygon_health = rpc_service.check_rpc_health("polygon_amoy")
    
    return {
        "networks": {
            "base_sepolia": "healthy" if base_health else "unhealthy",
            "polygon_amoy": "healthy" if polygon_health else "unhealthy"
        },
        "all_healthy": base_health and polygon_health
    }

class FaucetRequest(BaseModel):
    address: str
    token: str = "USDC"
    amount: float = 1000.0
    network: str = "polygon"

@router.post("/faucet")
def run_faucet(
    request: FaucetRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Mint mock tokens to the requester's wallet
    """
    try:
        # Switch network if needed
        if request.network.lower() == "polygon":
            wallet_service.switch_to_polygon_amoy()
        else:
            wallet_service.switch_to_base_sepolia()
            
        tx_hash = wallet_service.mint_tokens(
            request.address, 
            request.amount, 
            request.token
        )
        
        return {
            "status": "success", 
            "tx_hash": tx_hash, 
            "message": f"Minted {request.amount} {request.token} to {request.address} on {request.network}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
