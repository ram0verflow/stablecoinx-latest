import httpx
from app.core.config import settings

def check_ollama_health() -> bool:
    try:
        url = f"{settings.OLLAMA_BASE_URL}/api/tags"
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url)
            return resp.status_code == 200
    except Exception:
        return False

def check_groq_health() -> bool:
    try:
        url = "https://api.groq.com/openai/v1/models"
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url, headers=headers)
            return resp.status_code == 200
    except Exception:
        return False

def get_active_ai_engine() -> str:
    if check_ollama_health():
        return "ollama"
    elif check_groq_health():
        return "groq"
    return "none"
