import json
import httpx
import time
import logging
from typing import Dict, Any, Tuple
from app.core.config import settings
from app.models.payment_intents import PaymentIntent

logger = logging.getLogger(__name__)


class OllamaModelNotLoadedError(Exception):
    pass


class AITimeoutError(Exception):
    pass

VALID_DECISIONS = [
    "direct_transfer", "alternate_chain", "alternate_token",
    "delay_transfer", "split_payment", "manual_review", "block"
]
EXTERNAL_DECISION_ALIASES = {
    "approve": "direct_transfer",
    "approve_with_conditions": "manual_review",
    "escalate": "manual_review",
    "monitor": "manual_review",
    "reject": "block",
}

def get_safe_default(reason: str, payment: PaymentIntent = None) -> dict:
    return {
        "decision": "manual_review",
        "confidence": 0.0,
        "recommended_chain": payment.source_chain if payment else "base_sepolia",
        "recommended_token": payment.token if payment else "USDC",
        "reasoning": f"AI engine returned invalid response. Defaulting to manual review. Reason: {reason}",
        "risk_summary": "Unable to compute — manual review required",
        "flags": ["ai_parse_failure"],
        "alternative_options": [],
        "meta": {"engine": "fallback", "latency_ms": 0, "tokens": 0}
    }

def redact_pii(text: str) -> str:
    # A simple regex or replace approach to redact 0x... addresses
    import re
    def replacer(match):
        addr = match.group(0)
        logger.info(f"Redacting wallet address: {addr[:6]}...")
        return f"WALLET_{addr[:6]}...REDACTED"
    
    redacted_text = re.sub(r'0x[a-fA-F0-9]{40}', replacer, text)
    return redacted_text

def build_prompt(payment: PaymentIntent, results: Dict[str, Any], simplified: bool = False) -> str:
    system_prompt = (
        "You are a compliance-aware stablecoin settlement AI for an enterprise treasury system.\n"
        "You analyze payment risk data and make routing decisions.\n"
        "You must respond ONLY with valid JSON. No explanation outside JSON.\n"
        "Your response must follow this exact schema:\n"
        "{\n"
        "  \"decision\": one of [direct_transfer, alternate_chain, alternate_token, delay_transfer, split_payment, manual_review, block],\n"
        "  \"confidence\": float between 0.0 and 1.0,\n"
        "  \"recommended_chain\": string,\n"
        "  \"recommended_token\": string,\n"
        "  \"reasoning\": string of max 300 words explaining why,\n"
        "  \"risk_summary\": string of max 100 words,\n"
        "  \"flags\": list of strings describing key risk flags,\n"
        "  \"alternative_options\": list of up to 3 alternative decisions with brief explanation\n"
        "}"
    )
    
    if simplified:
        system_prompt += "\nIMPORTANT: YOUR PREVIOUS OUTPUT WAS INVALID JSON. PLEASE FIX IT AND RETURN ONLY PROPERLY FORMATTED JSON WITHOUT MARKDOWN OR TEXT."

    user_prompt = f"""Analyze this payment and make a routing decision:

PAYMENT DETAILS:
Sender: {payment.sender_company}
Receiver: {payment.receiver_company}
Corridor: {payment.source_country} -> {payment.destination_country}
Amount: {payment.amount} {payment.token}
Purpose: {payment.purpose}
Urgency: {payment.urgency}

COUNTRY POLICY: {json.dumps(results.get('country_policy', {}))}
TREASURY CONTROLS: {json.dumps(results.get('treasury_controls', {}))}
COMPLIANCE: {json.dumps(results.get('compliance', {}))}
WALLET RISK: {json.dumps(results.get('wallet_graph', {}))}
ISSUER RISK: {json.dumps(results.get('issuer_risk', {}))}
CHAIN GOVERNANCE: {json.dumps(results.get('chain_governance', {}))}
LIQUIDITY: {json.dumps(results.get('liquidity', {}))}

Based on all the above, provide your routing decision in the required JSON format.
"""
    return system_prompt + "\n\n" + user_prompt

def call_ollama(prompt: str) -> Tuple[str, Dict[str, Any]]:
    start_time = time.time()
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as exc:
        raise AITimeoutError("Ollama timed out (>30s)") from exc
    except httpx.HTTPStatusError as exc:
        body = exc.response.text.lower()
        if "model" in body and ("not found" in body or "not loaded" in body):
            raise OllamaModelNotLoadedError(
                f"Ollama model '{settings.OLLAMA_MODEL}' is not loaded. Falling back to Groq."
            ) from exc
        raise
        
    latency = int((time.time() - start_time) * 1000)
    tokens = data.get("eval_count", 0) + data.get("prompt_eval_count", 0)
    
    return data["response"], {"engine": "ollama", "latency_ms": latency, "tokens": tokens}

def call_groq(prompt: str) -> Tuple[str, Dict[str, Any]]:
    start_time = time.time()
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Split prompt logically if using chat format
    parts = prompt.split("\n\nAnalyze this payment")
    sys_prompt = parts[0]
    usr_prompt = "Analyze this payment" + parts[1] if len(parts) > 1 else prompt
    
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": usr_prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        
    latency = int((time.time() - start_time) * 1000)
    tokens = data.get("usage", {}).get("total_tokens", 0)
    content = data["choices"][0]["message"]["content"]
    
    return content, {"engine": "groq", "latency_ms": latency, "tokens": tokens}

def parse_ai_response(raw: str) -> dict:
    # Strip markdown fences if present
    clean = raw.strip()
    if clean.startswith("```"):
        try:
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        except IndexError:
            pass
    clean = clean.strip()
    
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        # Try to extract JSON from mixed text
        import re
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except Exception as e:
                logger.error(f"AI parse error: {e}")
                raise ValueError("JSON parse failed after retry")
        else:
            raise ValueError("No JSON found in response")
    
    decision = str(parsed.get("decision", "")).strip().lower()
    if decision in EXTERNAL_DECISION_ALIASES:
        logger.warning(f"AI returned external decision '{decision}', mapping safely")
        decision = EXTERNAL_DECISION_ALIASES[decision]
    if decision not in VALID_DECISIONS:
        logger.warning(
            f"Unexpected AI decision '{parsed.get('decision')}', defaulting to manual_review"
        )
        decision = "manual_review"
    parsed["decision"] = decision
    
    confidence = parsed.get("confidence", 0.5)
    if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
        parsed["confidence"] = 0.5
    
    if not parsed.get("reasoning"):
        parsed["reasoning"] = "No reasoning provided by AI engine"
    
    return parsed

def validate_decision(data: dict) -> bool:
    # Legacy, replaced by parse_ai_response exceptions
    return data.get("decision") in VALID_DECISIONS

def get_ai_decision(payment: PaymentIntent, results: Dict[str, Any], preferred_engine: str = "ollama") -> Dict[str, Any]:
    raw_prompt = build_prompt(payment, results)
    redacted_prompt = redact_pii(raw_prompt)
    
    engines = ["ollama", "groq"]
    if preferred_engine == "groq":
        engines = ["groq", "ollama"]
        
    for engine in engines:
        for attempt in range(2):
            try:
                if engine == "ollama":
                    response_text, meta = call_ollama(redacted_prompt if attempt == 0 else redact_pii(build_prompt(payment, results, simplified=True)))
                else:
                    response_text, meta = call_groq(redacted_prompt if attempt == 0 else redact_pii(build_prompt(payment, results, simplified=True)))
                
                parsed = parse_ai_response(response_text)
                parsed["meta"] = meta
                return parsed

            except (AITimeoutError, OllamaModelNotLoadedError) as e:
                logger.warning(str(e))
                if engine == "ollama":
                    break
            except Exception as e:
                logger.error(f"{engine} call failed on attempt {attempt+1}: {e}")
                
    return get_safe_default("All engines failed", payment)
