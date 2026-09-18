import json
import logging

from neo4j import GraphDatabase

from app.core.config import settings
from app.db.redis_client import get_redis
from app.services.compliance import beeceptor_provider

logger = logging.getLogger(__name__)


class WalletGraphService:
    def __init__(self):
        self._driver = None
        self._init_driver()

    def _init_driver(self):
        try:
            self._driver = GraphDatabase.driver(  # FIXED: L4
                settings.NEO4J_URI,  # FIXED: L4
                auth=(settings.NEO4J_USER or settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),  # FIXED: L4
            )  # FIXED: L4
            self._driver.verify_connectivity()
            logger.info("Neo4j driver initialized and connected")
        except Exception as e:
            logger.warning(f"Neo4j unavailable: {e}")
            self._driver = None

    @property
    def driver(self):
        return self._driver

    @staticmethod
    def _default_result(identifier: str, reason: str) -> dict:
        # A required intelligence source being unavailable must never look
        # like a clean, trusted "low risk" result — that's exactly the
        # fail-open gap the plan doc calls out. An entity simply not being
        # present in an otherwise-working graph is a different, milder case
        # and stays "low".
        unavailable = reason == "neo4j_unavailable"
        return {
            "risk_score": 0.1,
            "mixer_adjacent": False,
            "laundering_cluster": False,
            "exchange_hop_behavior": False,
            "suspicious_links": [],
            "overall_risk": "medium" if unavailable else "low",
            "neo4j_degraded": unavailable,
            "note": f"Entity '{identifier[:20]}' not found in graph ({reason})",
        }

    def analyze_wallet(self, identifier: str) -> dict:
        if (settings.COMPLIANCE_PROVIDER or "local").strip().lower() == "beeceptor":
            return beeceptor_provider.check_wallet_risk(identifier)

        redis_client = get_redis()
        if redis_client:
            try:
                cached = redis_client.get(f"wallet_risk_{identifier}")
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        driver = get_neo4j_driver()
        if not driver:
            return self._default_result(identifier, "neo4j_unavailable")

        with driver.session(database="neo4j") as session:
            if identifier.startswith("0x") or identifier.startswith("0X"):
                result = session.run(
                    "MATCH (w:Wallet {address: $id}) RETURN w",
                    id=identifier,
                ).single()
            else:
                result = session.run(
                    "MATCH (w:Wallet) WHERE w.company = $id OR w.name = $id OR w.address = $id RETURN w",
                    id=identifier,
                ).single()

            if not result:
                return self._default_result(identifier, "not_found")

            node = result["w"]
            risk_score = 0.1
            mixer_adjacent = bool(node.get("mixer_adjacent"))
            laundering_cluster = bool(node.get("laundering_cluster"))
            if mixer_adjacent:
                risk_score += 0.4
            if laundering_cluster:
                risk_score += 0.5

            suspicious_links = []
            hop_res = session.run(
                "MATCH (w:Wallet)-[:TRANSACTED_WITH*1..3]-(s:Wallet {suspicious: true}) "
                "WHERE w.address = $id OR w.company = $id OR w.name = $id "
                "RETURN s.address AS sus_addr",
                id=identifier,
            )
            for record in hop_res:
                suspicious_links.append(record["sus_addr"])
                risk_score += 0.2

            risk_score = min(1.0, risk_score)
            overall = (
                "critical" if risk_score > 0.8 else
                "high" if risk_score > 0.5 else
                "medium" if risk_score > 0.2 else
                "low"
            )
            out = {
                "risk_score": risk_score,
                "mixer_adjacent": mixer_adjacent,
                "laundering_cluster": laundering_cluster,
                "exchange_hop_behavior": False,
                "suspicious_links": list(set(suspicious_links)),
                "overall_risk": overall,
                "neo4j_degraded": False,
            }
            if redis_client:
                try:
                    redis_client.set(f"wallet_risk_{identifier}", json.dumps(out), ex=600)
                except Exception:
                    pass
            return out


wallet_graph_service = WalletGraphService()


def get_neo4j_driver():
    return wallet_graph_service.driver


def analyze_wallet(identifier: str) -> dict:
    return wallet_graph_service.analyze_wallet(identifier)


def seed_neo4j():  # FIXED: L4
    """Backward-compatible seed hook used at startup."""  # FIXED: L4
    driver = get_neo4j_driver()  # FIXED: L4
    if driver is None:  # FIXED: L4
        logger.warning(  # FIXED: L4
            "Neo4j wallet graph seed skipped — NEO4J_URI not configured or unreachable"  # FIXED: L4
        )  # FIXED: L4
        return {"status": "skipped", "reason": "no_driver"}  # FIXED: L4
    logger.info("Neo4j driver available — wallet graph seed hook complete")  # FIXED: L4
    return {"status": "ok", "reason": "driver_ready"}  # FIXED: L4
