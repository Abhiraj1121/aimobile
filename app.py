import os
import json
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS

# Load environment variables from .env
load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

# Config (set in your .env)
AI_API_URL = os.getenv("AI_API_URL")  # e.g. https://openrouter.ai/api/v1/chat/completions
AI_API_KEY = os.getenv("AI_API_KEY")  # your API key for the AI service

# Local Q&A file
LOCAL_QA_PATH = os.path.join(os.path.dirname(__file__), "data", "school_data.txt")
local_qa = {}
if os.path.exists(LOCAL_QA_PATH):
    with open(LOCAL_QA_PATH, "r", encoding="utf-8") as f:
        content = f.read().strip()
        if content:
            # Entries separated by a blank line
            entries = content.split("\n\n")
            for entry in entries:
                lines = [l.strip() for l in entry.splitlines() if l.strip()]
                if len(lines) >= 2:
                    q = lines[0].lower()
                    a = " ".join(lines[1:])
                    local_qa[q] = a


def local_lookup(query):
    """Return local answer if exact match found (case-insensitive)."""
    if not query:
        return None
    return local_qa.get(query.lower().strip())


def _extract_text_from_choice(choice):
    """Helper: Extract generated text from a choice dict (OpenRouter-style)."""
    if not choice or not isinstance(choice, dict):
        return None
    # Newer style: choice["message"]["content"]
    message = choice.get("message")
    if isinstance(message, dict) and "content" in message:
        return message["content"].strip()
    # Older style: choice["text"]
    text = choice.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()
    return None


def _call_model(body, headers, timeout=30):
    """Call the AI API and return (status_code, response_json_or_text)."""
    try:
        resp = requests.post(AI_API_URL, headers=headers, json=body, timeout=timeout)
        # Try to parse JSON if possible
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, resp.text
    except requests.exceptions.ReadTimeout:
        return None, "timeout"
    except Exception as e:
        return None, str(e)


def ai_query(user_input, history=None, system_note=None):
    """
    Query primary model; if it fails (non-200 or unexpected), try fallback model.
    Returns a string reply (or friendly error message).
    """
    if not AI_API_URL or not AI_API_KEY:
        return "Swastik: AI backend not configured. Please set AI_API_URL and AI_API_KEY environment variables."

    # Build system prompt
    system_note = system_note or (
        "You are Swastik, an intelligent AI assistant designed to communicate in a friendly, natural, and helpful manner."
        "Your goals are:"
        "- Understand user input clearly."
        "- Respond accurately and confidently."
        "- Keep answers concise unless the user asks for more detail."
        "- Maintain a conversational, polite tone."
        "- Avoid giving unnecessary information or assumptions."
        "- Support both simple and complex queries across general knowledge, reasoning, coding, explanations, and tasks."
        "If a question is unclear, ask politely for clarification."
        "Do not invent facts; rely on reasoning and safe, reliable information."

    )

    # Build conversational messages
    messages = [{"role": "system", "content": system_note}]
    if history and isinstance(history, list):
        # add up to last 12 messages (user/assistant)
        for m in history[-12:]:
            if m.get("role") in ("user", "assistant") and "content" in m:
                messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_input})

    headers = {
        "Authorization": f"Bearer {AI_API_KEY}",
        "Content-Type": "application/json"
    }

    # Primary model (first attempt)
    primary_body = {
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "messages": messages,
        "max_tokens": 800,
        "temperature": 0.2
    }

    # Fallback model (used if primary fails or is rate-limited)
    fallback_body = {
        "model": "openai/gpt-oss-20b:free",
        "messages": messages,
        "max_tokens": 600,
        "temperature": 0.2
    }

    # --- Attempt primary ---
    status, result = _call_model(primary_body, headers)
    # status == None means network/exception happened
    if status is None:
        # Try fallback
        status2, result2 = _call_model(fallback_body, headers)
        if status2 == 200:
            # parse choices
            if isinstance(result2, dict) and "choices" in result2 and len(result2["choices"]) > 0:
                text = _extract_text_from_choice(result2["choices"][0])
                if text:
                    return text
            if isinstance(result2, dict) and "text" in result2:
                return str(result2["text"]).strip()
            return "Swastik: Backup AI responded in an unexpected format."
        if status2 is None and result2 == "timeout":
            return "Swastik: Sorry, the AI server took too long to respond. Please try again shortly."
        return f"Swastik: Backup AI error: {result2}"

    # Handle HTTP status codes for primary
    if status == 200 and isinstance(result, dict):
        # parse choices
        if "choices" in result and len(result["choices"]) > 0:
            text = _extract_text_from_choice(result["choices"][0])
            if text:
                return text
        if "text" in result:
            return str(result["text"]).strip()
        # Unexpected format from primary — try fallback
        status2, result2 = _call_model(fallback_body, headers)
        if status2 == 200 and isinstance(result2, dict):
            if "choices" in result2 and len(result2["choices"]) > 0:
                text = _extract_text_from_choice(result2["choices"][0])
                if text:
                    return text
            if "text" in result2:
                return str(result2["text"]).strip()
            return "Swastik: Backup AI responded in an unexpected format."
        if status2 is None and result2 == "timeout":
            return "Swastik: Sorry, the AI server took too long to respond. Please try again shortly."
        return f"Swastik: Backup AI error {status2}: {result2}"

    # If primary returned 429 (rate limit) try fallback before telling user to wait
    if status == 429:
        status2, result2 = _call_model(fallback_body, headers)
        if status2 == 200 and isinstance(result2, dict):
            if "choices" in result2 and len(result2["choices"]) > 0:
                text = _extract_text_from_choice(result2["choices"][0])
                if text:
                    return text
            if "text" in result2:
                return str(result2["text"]).strip()
            return "Swastik: Backup AI responded in an unexpected format."
        # If fallback also rate-limited or fails, inform the user
        if status2 == 429:
            return "Swastik: Too many requests to the AI services right now. Please wait a few moments and try again."
        if status2 is None and result2 == "timeout":
            return "Swastik: Sorry, the AI server took too long to respond. Please try again shortly."
        return f"Swastik: AI rate-limited (primary). Backup AI error {status2}: {result2}"

    # If primary returned another 4xx/5xx error, try fallback
    if 400 <= status < 600:
        status2, result2 = _call_model(fallback_body, headers)
        if status2 == 200 and isinstance(result2, dict):
            if "choices" in result2 and len(result2["choices"]) > 0:
                text = _extract_text_from_choice(result2["choices"][0])
                if text:
                    return text
            if "text" in result2:
                return str(result2["text"]).strip()
            return "Swastik: Backup AI responded in an unexpected format."
        if status2 is None and result2 == "timeout":
            return "Swastik: Sorry, the AI server took too long to respond. Please try again shortly."
        return f"Swastik: AI error {status}: {result}"

    # Fallback generic
    return "Swastik: Unexpected AI error. Please try again later."


@app.route("/")
def index():
    return render_template("index.html", bot_name="Swastik")


@app.route("/api/chat", methods=["POST"])
def chat():
    payload = request.json or {}
    msg = payload.get("message", "").strip()
    history = payload.get("history", [])

    if not msg:
        return jsonify({
            "reply": "Swastik: It seems like your message is empty. How can I assist you today?",
            "source": "system"
        })

    # Check local Q&A first
    local = local_lookup(msg)
    if local:
        return jsonify({"reply": local, "source": "local"})

    # Query AI
    reply = ai_query(msg, history=history)
    return jsonify({"reply": reply, "source": "ai"})


if __name__ == "__main__":
    # default port is 5000; override with PORT env var
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
