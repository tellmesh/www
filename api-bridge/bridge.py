"""
Taskinity API Bridge

Optional backend for the static www/ chat UI.

Run from repository root:

    pip install fastapi uvicorn
    python www/api-bridge/bridge.py

Then open:

    www/index.html

and set API URL to:

    http://localhost:8788

This bridge tries to call local CLI commands such as urish/hypervisor.
It is intentionally small and safe-by-default. Mutating commands should still
be guarded by policy/approval in the real backend.
"""

from __future__ import annotations

import json
import subprocess
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Taskinity API Bridge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UriCall(BaseModel):
    uri: str
    payload: dict[str, Any] = Field(default_factory=dict)
    approved: bool = False
    dry_run: bool = True
    policy: str = "dev"


class AskCall(BaseModel):
    prompt: str
    dry_run: bool = True
    llm: bool = False


def envelope(ok: bool, result_type: str, data: Any, **meta: Any) -> dict[str, Any]:
    return {
        "ok": ok,
        "workflow_status": "completed" if ok else "completed_with_service_error",
        "execution_status": "completed",
        "service_result_status": "succeeded" if ok else "failed",
        "result_type": result_type,
        "data": data,
        "meta": {
            "runtime": "taskinity-api-bridge",
            "transport": "http",
            **meta,
        },
    }


def run_cmd(args: list[str], timeout: int = 20) -> dict[str, Any]:
    try:
        proc = subprocess.run(
            args,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        parsed = None
        try:
            parsed = json.loads(proc.stdout)
        except Exception:
            parsed = None

        return {
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "json": parsed,
        }
    except Exception as exc:
        return {
            "returncode": 999,
            "stdout": "",
            "stderr": str(exc),
            "json": None,
        }


@app.get("/health")
def health() -> dict[str, Any]:
    return envelope(True, "health", {"status": "ok", "service": "taskinity-api-bridge"})


@app.post("/api/uri/call")
def call_uri(body: UriCall) -> dict[str, Any]:
    uri = body.uri

    if uri.startswith("health://agent/"):
        agent_id = uri.removeprefix("health://agent/")
        result = run_cmd(["hypervisor", "agent-status", agent_id])
        if result["json"]:
            return result["json"]
        return envelope(result["returncode"] == 0, "agent_status", result, target=uri)

    if uri.startswith("repair://agent/") and uri.endswith("/diagnose"):
        agent_id = uri.removeprefix("repair://agent/").removesuffix("/diagnose")
        result = run_cmd(["urish", "repair", "diagnose", agent_id, "--json"])
        if result["json"]:
            return result["json"]
        return envelope(result["returncode"] == 0, "diagnosis", result, target=uri)

    if uri.startswith("repair://agent/") and uri.endswith("/apply"):
        agent_id = uri.removeprefix("repair://agent/").removesuffix("/apply")
        result = run_cmd(["urish", "repair", "apply", agent_id, "--dry-run", "--json"])
        if result["json"]:
            return result["json"]
        return envelope(result["returncode"] == 0, "repair_result", result, target=uri)

    if uri.startswith("view://process/agent/"):
        agent_id = uri.removeprefix("view://process/agent/").removesuffix("/latest")
        result = run_cmd(["hypervisor", "agent-status", agent_id])
        return envelope(
            result["returncode"] == 0,
            "process_view",
            {
                "uri": uri,
                "agent_id": agent_id,
                "what_happened": "API bridge pobrał status agenta przez hypervisor.",
                "why_it_matters": "Widok procesu łączy runtime, health i akcje naprawcze.",
                "raw": result,
            },
            target=uri,
        )

    # Generic fallback through urish call when available.
    result = run_cmd(["urish", "call", uri, "--payload", json.dumps(body.payload), "--json"])
    if result["json"]:
        return result["json"]
    return envelope(result["returncode"] == 0, "uri_call", result, target=uri)


@app.post("/api/uri/preview")
def preview_uri(body: UriCall) -> dict[str, Any]:
    mutating = body.uri.startswith(("repair://", "hypervisor://", "docker://", "shell://"))
    return {
        "uri": body.uri,
        "readonly_allowed": not mutating,
        "dry_run_allowed": True,
        "execute_allowed_with_approval": True,
        "requires_approval": mutating,
        "policy": body.policy,
        "reason": "mutating URI requires approval" if mutating else None,
    }


@app.get("/api/agents")
def agents() -> dict[str, Any]:
    return {"agents": []}


@app.get("/api/events")
def events(limit: int = 20) -> dict[str, Any]:
    return {"events": [], "limit": limit}


@app.post("/api/ask")
@app.post("/api/nl/ask")
def ask(body: AskCall) -> dict[str, Any]:
    from hypervisor_dashboard_agent.chat_format import format_ask_markdown
    from urish.backends.ask import ask_prompt

    envelope = ask_prompt(body.prompt, dry_run=body.dry_run, use_llm=body.llm)
    data = envelope.get("data") or {}
    markdown = format_ask_markdown(data)
    result = envelope
    result["message_markdown"] = markdown
    result["ok"] = True
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8788)
