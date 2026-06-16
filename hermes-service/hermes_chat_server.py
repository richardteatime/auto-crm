"""Minimal HTTP wrapper around the Hermes Agent `chat` CLI command.

This service is meant to run inside a Docker container next to the CRM. It
exposes a single POST /chat endpoint that runs `hermes chat -q ...` in a
subprocess, captures the final response from stdout and the session id from
stderr, and returns them as JSON.

The CRM (src/lib/hermes/client.ts) calls this endpoint when
HERMES_SERVICE_URL is configured, falling back to a local binary otherwise.
"""

import os
import re
import subprocess
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Hermes Chat Service", version="0.1.0")

HERMES_API_KEY = os.getenv("HERMES_API_KEY")
HERMES_TIMEOUT = int(os.getenv("HERMES_TIMEOUT", "120"))
HERMES_MAX_TURNS = int(os.getenv("HERMES_MAX_TURNS", "30"))


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    max_turns: Optional[int] = Field(default=None, ge=1, le=200)


class ChatResponse(BaseModel):
    reply: str
    session_id: Optional[str] = None


def _check_auth(authorization: Optional[str]) -> None:
    if not HERMES_API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
        )
    token = authorization[7:]
    if token != HERMES_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    authorization: Optional[str] = Header(None),
) -> ChatResponse:
    _check_auth(authorization)

    args = [
        "hermes",
        "chat",
        "-q",
        req.message,
        "-Q",
        "--source",
        "tool",
        "--max-turns",
        str(req.max_turns or HERMES_MAX_TURNS),
    ]
    if req.session_id:
        args.extend(["--resume", req.session_id])

    env = {**os.environ, "FORCE_COLOR": "0", "NO_COLOR": "1"}

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=HERMES_TIMEOUT,
            env=env,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Hermes chat timed out after {HERMES_TIMEOUT}s",
        ) from exc

    stdout = result.stdout or ""
    stderr = result.stderr or ""

    # In quiet mode Hermes prints `session_id: <id>` to stderr.
    sid_match = re.search(r"^session_id:\s*(.+)$", stderr, re.MULTILINE)
    session_id = sid_match.group(1).strip() if sid_match else None

    if result.returncode != 0:
        detail = (stderr or stdout or "Hermes exited with an error").strip()
        raise HTTPException(status_code=502, detail=detail[:2000])

    return ChatResponse(
        reply=stdout.strip(),
        session_id=session_id or req.session_id,
    )
