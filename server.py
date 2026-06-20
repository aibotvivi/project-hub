#!/usr/bin/env python3
"""Project Hub server — static files + /api/chats + /api/chat (Claude Code proxy)."""

import json, os, subprocess, threading, time, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ALLOWED_MODELS = {
    "claude-sonnet-4-6",
    "claude-opus-4-8",
    "claude-haiku-4-5-20251001",
}

ROOT       = os.path.dirname(os.path.abspath(__file__))
CHATS_FILE   = os.path.join(ROOT, "chats.json")
STATE_FILE   = os.path.join(ROOT, "state.json")
REVIEWS_FILE = os.path.join(ROOT, "reviews.json")
BUILDS_DIR   = os.path.join(ROOT, "builds")
CLAUDE_BIN = os.path.expanduser("~/.local/bin/claude")
lock       = threading.Lock()
# Only one Claude call at a time — concurrent calls throttle each other badly
# (a ~10s call degrades to ~35s under contention). Serializing keeps each fast.
claude_sem = threading.Semaphore(1)


def _safe_id(s):
    """Keep only filename-safe chars from an id."""
    return "".join(c for c in (s or "") if c.isalnum() or c in "-_")[:40] or "build"


class _NoKey(Exception):
    pass


def _post_json(url, payload, headers, timeout=60):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _call_openai(prompt):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise _NoKey("No OpenAI key. Set OPENAI_API_KEY before starting the server.")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")
    out = _post_json(
        "https://api.openai.com/v1/chat/completions",
        {"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 800},
        {"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    return out["choices"][0]["message"]["content"].strip()


def _call_gemini(prompt):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise _NoKey("No Gemini key. Set GEMINI_API_KEY before starting the server.")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    out = _post_json(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + model + ":generateContent?key=" + key,
        {"contents": [{"parts": [{"text": prompt}]}]},
        {"Content-Type": "application/json"},
    )
    return out["candidates"][0]["content"]["parts"][0]["text"].strip()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ── CORS preflight ────────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────
    def do_GET(self):
        if self.path == "/api/chats":
            with lock:
                data = {}
                if os.path.exists(CHATS_FILE):
                    with open(CHATS_FILE) as f:
                        data = json.load(f)
            self._json(data)
        elif self.path == "/api/state":
            with lock:
                data = {}
                if os.path.exists(STATE_FILE):
                    with open(STATE_FILE) as f:
                        data = json.load(f)
            self._json(data)
        elif self.path == "/api/reviews":
            with lock:
                data = {}
                if os.path.exists(REVIEWS_FILE):
                    with open(REVIEWS_FILE) as f:
                        data = json.load(f)
            self._json(data)
        elif self.path == "/api/models":
            self._json({
                "openai": bool(os.environ.get("OPENAI_API_KEY")),
                "gemini": bool(os.environ.get("GEMINI_API_KEY")),
            })
        else:
            super().do_GET()

    # ── POST ──────────────────────────────────────────────────────────────
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length)

        if self.path == "/api/chats":
            with lock:
                with open(CHATS_FILE, "w") as f:
                    f.write(body.decode())
            self._json({"ok": True})

        elif self.path == "/api/state":
            with lock:
                with open(STATE_FILE, "w") as f:
                    f.write(body.decode())
            self._json({"ok": True})

        elif self.path == "/api/reviews":
            with lock:
                with open(REVIEWS_FILE, "w") as f:
                    f.write(body.decode())
            self._json({"ok": True})

        elif self.path == "/api/publish":
            self._handle_publish(body)

        elif self.path == "/api/review":
            self._handle_review(body)

        elif self.path == "/api/chat":
            self._handle_chat(body)

        else:
            self.send_response(404)
            self.end_headers()

    # ── Publish a generated app to a real URL ─────────────────────────────
    def _handle_publish(self, body):
        try:
            data = json.loads(body)
        except Exception:
            self._json({"error": "Invalid JSON"})
            return
        code = data.get("code", "")
        if not code.strip():
            self._json({"error": "No code provided"})
            return
        bid  = _safe_id(data.get("id")) + "-" + str(abs(hash(code)) % 100000)
        with lock:
            os.makedirs(BUILDS_DIR, exist_ok=True)
            with open(os.path.join(BUILDS_DIR, bid + ".html"), "w") as f:
                f.write(code)
        # Return a relative path; client builds the full URL from its own origin
        self._json({"id": bid, "path": "/builds/" + bid + ".html"})

    # ── Cross-model review (OpenAI / Gemini) ──────────────────────────────
    def _handle_review(self, body):
        try:
            data = json.loads(body)
        except Exception:
            self._json({"error": "Invalid JSON"})
            return
        model   = data.get("model", "openai")
        content = data.get("content", "")
        context = data.get("context", "")
        if not content.strip():
            self._json({"error": "Nothing to review."})
            return

        prompt = (
            "You are a senior reviewer giving a second opinion on work produced by another AI model. "
            + (context + "\n\n" if context else "")
            + "Review the following. Be specific and constructive: call out bugs, risks, and concrete "
            "improvements. Keep it to 4-8 short bullet points. If it's solid, say so and note the 1-2 things "
            "that would make it better.\n\n--- WORK TO REVIEW ---\n" + content
        )

        try:
            if model == "gemini":
                text = _call_gemini(prompt)
            else:
                text = _call_openai(prompt)
            self._json({"text": text, "model": model})
        except _NoKey as e:
            self._json({"error": str(e), "needsKey": True, "model": model})
        except Exception as e:
            self._json({"error": "Review failed: " + str(e), "model": model})

    # ── Claude Code proxy ─────────────────────────────────────────────────
    def _handle_chat(self, body):
        data          = json.loads(body)
        system_prompt = data.get("systemPrompt", "")
        messages      = data.get("messages", [])
        is_background = bool(data.get("background", False))

        # Last message is the user's new input; prior messages become history
        if not messages:
            self._json({"text": "No message provided."})
            return

        # Serialize Claude calls. Background updates yield: if Claude is busy,
        # they skip rather than queue, so interactive chat never waits behind them.
        if is_background:
            if not claude_sem.acquire(blocking=False):
                self._json({"text": "", "skipped": True})
                return
        else:
            claude_sem.acquire()

        user_msg      = messages[-1]["content"]
        history_parts = []
        for m in messages[:-1]:
            role = "Human" if m["role"] == "user" else "Assistant"
            history_parts.append(f"{role}: {m['content']}")

        full_system = system_prompt
        if history_parts:
            full_system += "\n\nConversation so far:\n" + "\n\n".join(history_parts)

        # Model is chosen client-side (Settings); validate against an allowlist.
        model = data.get("model") or "claude-sonnet-4-6"
        if model not in ALLOWED_MODELS:
            model = "claude-sonnet-4-6"

        # Stream tokens as they generate — no hard timeout wall, and the client
        # shows the reply (and code) building live. --tools/--setting-sources ""
        # skip agent overhead for plain text generation.
        cmd = [
            CLAUDE_BIN,
            "-p", user_msg,
            "--system-prompt", full_system,
            "--tools", "",
            "--setting-sources", "",
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--model", model,
        ]

        # Streaming NDJSON response: each line is {"d": "<delta>"} | {"done":1} | {"err": "..."}
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self._cors()
        self.end_headers()

        proc = None
        def _emit(obj):
            self.wfile.write((json.dumps(obj) + "\n").encode())
            self.wfile.flush()

        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
            # Safety net: kill a stuck process after 10 minutes of no completion.
            killer = threading.Timer(600, proc.kill)
            killer.start()
            got_any = False
            fail_reason = None     # captured from the stream so we can explain *why*
            while True:
                # readline() yields each line as soon as it's newline-terminated —
                # avoids the read-ahead batching of `for line in proc.stdout`.
                line = proc.stdout.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                t = obj.get("type")
                if t == "stream_event":
                    ev = obj.get("event", {})
                    if ev.get("type") == "content_block_delta":
                        delta = ev.get("delta", {})
                        if delta.get("type") == "text_delta" and delta.get("text"):
                            got_any = True
                            _emit({"d": delta["text"]})
                elif t == "rate_limit_event":
                    info = obj.get("rate_limit_info", {})
                    if info.get("status") and info["status"] != "allowed":
                        resets = info.get("resetsAt")
                        when = ""
                        if resets:
                            mins = max(0, int((resets - time.time()) / 60))
                            when = f" Resets in about {mins} min." if mins else " Resets shortly."
                        fail_reason = (f"You've hit your Claude usage limit ({info.get('rateLimitType','limit')})."
                                       + when + " Wait for the reset, switch to a smaller model in Settings, or use an API key.")
                elif t == "result":
                    if obj.get("is_error") or obj.get("subtype") not in (None, "success"):
                        api_err = obj.get("api_error_status") or obj.get("subtype") or "unknown error"
                        fail_reason = fail_reason or f"Claude returned an error: {api_err}."
                    if not got_any:
                        res = (obj.get("result") or "").strip()
                        if res:
                            _emit({"d": res})
            proc.wait()
            killer.cancel()
            if not got_any:
                if fail_reason is None:
                    stderr = (proc.stderr.read() or "").strip()
                    if proc.returncode not in (0, None):
                        fail_reason = (stderr[:400] or f"Claude Code exited with code {proc.returncode}.")
                    else:
                        fail_reason = "Claude returned an empty response — try rephrasing, or a different model in Settings."
                _emit({"err": "⚠️ " + fail_reason})
            _emit({"done": 1})
        except (BrokenPipeError, ConnectionResetError):
            pass  # client navigated away mid-stream
        except Exception as e:
            try: _emit({"err": f"⚠️ Error calling Claude Code: {e}"})
            except Exception: pass
        finally:
            if proc and proc.poll() is None:
                proc.kill()
            claude_sem.release()

    # ── Helpers ───────────────────────────────────────────────────────────
    def _json(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    os.chdir(ROOT)
    # Threaded so background auto-updates don't block the founder's chat requests.
    httpd = ThreadingHTTPServer(("0.0.0.0", 8082), Handler)
    print("Project Hub → http://0.0.0.0:8082")
    httpd.serve_forever()
