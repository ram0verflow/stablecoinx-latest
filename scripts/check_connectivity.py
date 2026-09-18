import requests
import redis
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

def check_services():
    print("--- System Connectivity Audit ---")
    
    # Check Ollama
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        resp = requests.get(f"{ollama_url}/api/tags", timeout=2)
        if resp.status_code == 200:
            print(f"[OK] Ollama: Reachable at {ollama_url}")
        else:
            print(f"[ERR] Ollama: Status {resp.status_code}")
    except Exception as e:
        print(f"[ERR] Ollama: Connection failed - {e}")

    # Check Redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        r = redis.from_url(redis_url)
        r.ping()
        print(f"[OK] Redis: Reachable at {redis_url}")
    except Exception as e:
        print(f"[ERR] Redis: Connection failed - {e}")

    # Check Neo4j
    neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_pass = os.getenv("NEO4J_PASSWORD", "")
    try:
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass))
        with driver.session() as session:
            session.run("RETURN 1")
        print(f"[OK] Neo4j: Reachable at {neo4j_uri}")
        driver.close()
    except Exception as e:
        print(f"[ERR] Neo4j: Connection failed - {e}")

if __name__ == "__main__":
    check_services()
