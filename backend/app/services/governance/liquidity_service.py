from app.models.payment_intents import PaymentIntent

def normalize_chain_name(chain: str) -> str:
    return chain.lower().replace(" ", "_")

def compute_best_route(payment: PaymentIntent) -> dict:
    src_chain = normalize_chain_name(payment.source_chain)
    dst_chain = normalize_chain_name(payment.destination_chain)
    amount = float(payment.amount)
    
    # Base Sepolia parameters
    base_gas = 0.50
    base_slippage_pct = 0.05
    
    # Polygon Amoy parameters
    amoy_gas = 0.02
    amoy_slippage_pct = 0.08
    
    routes = []
    
    # Option 1: Direct on Base Sepolia
    base_cost = base_gas + (amount * (base_slippage_pct / 100))
    routes.append({
        "name": "Direct Base Sepolia",
        "route": "base_sepolia -> base_sepolia",
        "cost_usd": base_cost,
        "slippage_percent": base_slippage_pct,
        "eta_minutes": 1,
        "bridge_fee_pct": 0.0
    })
    
    # Option 2: Direct on Polygon Amoy
    amoy_cost = amoy_gas + (amount * (amoy_slippage_pct / 100))
    routes.append({
        "name": "Direct Polygon Amoy",
        "route": "polygon_amoy -> polygon_amoy",
        "cost_usd": amoy_cost,
        "slippage_percent": amoy_slippage_pct,
        "eta_minutes": 2,
        "bridge_fee_pct": 0.0
    })
    
    # Option 3: Cross-chain Base -> Polygon
    bridge_fee_pct = 0.15
    cross_cost = base_gas + amoy_gas + (amount * (base_slippage_pct / 100)) + (amount * (bridge_fee_pct / 100))
    routes.append({
        "name": "Cross-chain Base to Polygon",
        "route": "base_sepolia -> polygon_amoy",
        "cost_usd": cross_cost,
        "slippage_percent": base_slippage_pct, # using source slippage as main
        "eta_minutes": 15,
        "bridge_fee_pct": bridge_fee_pct
    })
    
    # Option 4: Cross-chain Polygon -> Base
    cross_cost_2 = amoy_gas + base_gas + (amount * (amoy_slippage_pct / 100)) + (amount * (bridge_fee_pct / 100))
    routes.append({
        "name": "Cross-chain Polygon to Base",
        "route": "polygon_amoy -> base_sepolia",
        "cost_usd": cross_cost_2,
        "slippage_percent": amoy_slippage_pct,
        "eta_minutes": 15,
        "bridge_fee_pct": bridge_fee_pct
    })
    
    # Sort by cost
    routes.sort(key=lambda x: x["cost_usd"])
    
    best_route = routes[0]
    
    # If the user explicitly wants a specific source -> destination, we should probably prefer that if we aren't doing auto-routing.
    # The prompt says "Compute cost for each allowed chain ... Recommend cheapest route"
    
    return {
        "recommended_route": best_route["name"],
        "estimated_cost_usd": best_route["cost_usd"],
        "slippage_percent": best_route["slippage_percent"],
        "eta_minutes": best_route["eta_minutes"],
        "congestion_level": "low",
        "alternative_routes": routes[1:]
    }
