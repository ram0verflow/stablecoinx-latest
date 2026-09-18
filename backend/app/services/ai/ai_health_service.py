import httpx
import time
from app.core.config import settings

def check_ollama_health() -> tuple[bool, int]:
    start = time.time()
    try:
        url = f"{settings.OLLAMA_BASE_URL}/api/tags"
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url)
            return resp.status_code == 200, int((time.time() - start) * 1000)
    except Exception:
        return False, 0

def check_groq_health() -> tuple[bool, int]:
    start = time.time()
    try:
        url = "https://api.groq.com/openai/v1/models"
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url, headers=headers)
            return resp.status_code == 200, int((time.time() - start) * 1000)
    except Exception:
        return False, 0

def get_active_ai_engine() -> str:
    ollama_ok, _ = check_ollama_health()
    groq_ok, _ = check_groq_health()
    if ollama_ok:
        return "ollama"
    elif groq_ok:
        return "groq"
    return "none"
