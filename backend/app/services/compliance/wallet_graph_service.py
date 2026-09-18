import json
import time
import redis
from neo4j import GraphDatabase
from app.core.config import settings

try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
except Exception as e:
    redis_client = None
    print(f"Failed to connect to Redis: {e}")

# Cache Neo4j availability to avoid repeated timeout attempts
_neo4j_available: bool | None = None  # None = not yet tested
_neo4j_last_check: float = 0.0
_NEO4J_RETRY_INTERVAL = 60.0  # only retry connection every 60 seconds


def get_neo4j_driver():
    """
    Get Neo4j driver with a hard 5s timeout.
    Caches unavailability for 60s to prevent thread pool exhaustion.
    """
    global _neo4j_available, _neo4j_last_check
    import concurrent.futures

    now = time.monotonic()

    # If we know it's unavailable and haven't waited long enough, skip
    if _neo4j_available is False and (now - _neo4j_last_check) < _NEO4J_RETRY_INTERVAL:
        return None

    def _create_driver():
        return GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
        )

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_create_driver)
            driver = future.result(timeout=5)
        _neo4j_available = True
        _neo4j_last_check = now
        return driver
    except Exception:
        _neo4j_available = False
        _neo4j_last_check = now
        return None

def analyze_wallet(wallet_address: str) -> dict:
    if redis_client:
        try:
            cached = redis_client.get(f"wallet_risk_{wallet_address}")
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Redis get error: {e}")
            
    risk_score = 0.05
    mixer_adjacent = False
    laundering_cluster = False
    suspicious_links = []
    neo4j_degraded = False
    
    driver = get_neo4j_driver()
    if driver:
        try:
            # Use a short connection timeout to avoid hanging
            with driver.session(database="neo4j") as session:
                # Direct check
                direct_res = session.run(
                    "MATCH (w:Wallet {address: $address}) RETURN w",
                    address=wallet_address,
                    timeout=5,
                ).single()
                if direct_res:
                    node = direct_res["w"]
                    if node.get("mixer_adjacent"):
                        mixer_adjacent = True
                        risk_score += 0.4
                    if node.get("laundering_cluster"):
                        laundering_cluster = True
                        risk_score += 0.5
                        
                # 3-hop check for suspicious wallets
                hop_res = session.run(
                    "MATCH (w:Wallet {address: $address})-[:TRANSACTED_WITH*1..3]-(s:Wallet {suspicious: true}) RETURN s.address AS sus_addr",
                    address=wallet_address,
                    timeout=5,
                )
                
                for record in hop_res:
                    suspicious_links.append(record["sus_addr"])
                    risk_score += 0.2
                    
        except Exception as e:
            print(f"Neo4j query error: {e}")
            neo4j_degraded = True
        finally:
            try:
                driver.close()
            except Exception:
                pass
    else:
        neo4j_degraded = True
            
    risk_score = min(1.0, risk_score)
    overall = "critical" if risk_score > 0.8 else "high" if risk_score > 0.5 else "medium" if risk_score > 0.2 else "low"
    
    result = {
        "risk_score": risk_score,
        "mixer_adjacent": mixer_adjacent,
        "laundering_cluster": laundering_cluster,
        "exchange_hop_behavior": False,
        "suspicious_links": list(set(suspicious_links)),
        "overall_risk": "medium" if neo4j_degraded else overall,
        "neo4j_degraded": neo4j_degraded,
    }
    
    if redis_client:
        try:
            redis_client.set(f"wallet_risk_{wallet_address}", json.dumps(result), ex=600)  # 10 mins TTL
        except Exception as e:
            print(f"Redis set error: {e}")
        
    return result

def seed_neo4j():
    driver = get_neo4j_driver()
    if not driver:
        print("Neo4j driver not available for seeding")
        return
        
    try:
        with driver.session() as session:
            # Create 5 suspicious wallets
            for i in range(1, 6):
                session.run(f"MERGE (w:Wallet {{address: '0xSUS{i}00000000000000000000000000000000000'}}) SET w.suspicious = true, w.mixer_adjacent = true")
                
            # Create 3 laundering cluster wallets
            for i in range(1, 4):
                session.run(f"MERGE (w:Wallet {{address: '0xLAUNDER{i}0000000000000000000000000000000'}}) SET w.suspicious = true, w.laundering_cluster = true")
            
            # Connect laundering cluster
            session.run("MATCH (a:Wallet {address: '0xLAUNDER10000000000000000000000000000000'}), (b:Wallet {address: '0xLAUNDER20000000000000000000000000000000'}) MERGE (a)-[:TRANSACTED_WITH]->(b)")
            session.run("MATCH (a:Wallet {address: '0xLAUNDER20000000000000000000000000000000'}), (b:Wallet {address: '0xLAUNDER30000000000000000000000000000000'}) MERGE (a)-[:TRANSACTED_WITH]->(b)")
            session.run("MATCH (a:Wallet {address: '0xLAUNDER30000000000000000000000000000000'}), (b:Wallet {address: '0xLAUNDER10000000000000000000000000000000'}) MERGE (a)-[:TRANSACTED_WITH]->(b)")
            
            # Create 10 normal wallets
            for i in range(1, 11):
                session.run(f"MERGE (w:Wallet {{address: '0xNORMAL{i}00000000000000000000000000000000'}}) SET w.suspicious = false")
                
            # Create some relationships
            session.run("MATCH (a:Wallet {address: '0xNORMAL100000000000000000000000000000000'}), (b:Wallet {address: '0xSUS1000000000000000000000000000000000'}) MERGE (a)-[:TRANSACTED_WITH]->(b)")
            session.run("MATCH (a:Wallet {address: '0xNORMAL200000000000000000000000000000000'}), (b:Wallet {address: '0xNORMAL100000000000000000000000000000000'}) MERGE (a)-[:TRANSACTED_WITH]->(b)")
            
            print("Neo4j seeded successfully")
    except Exception as e:
        print(f"Failed to seed Neo4j: {e}")
