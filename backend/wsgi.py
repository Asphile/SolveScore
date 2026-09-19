"""WSGI entry point for hosts that only serve WSGI apps (e.g. PythonAnywhere's
free-tier web apps), which FastAPI (an ASGI app) cannot be plugged into directly.

On PythonAnywhere, point the "Web" tab's WSGI configuration file at this module
(`from wsgi import application`).

This is a small, self-contained ASGI-to-WSGI bridge rather than a dependency on
a library like a2wsgi, deliberately: a2wsgi (and similar bridges) run the ASGI
app on a persistent background thread with its own event loop, started once at
import time. PythonAnywhere's WSGI hosting forks worker processes, and a thread
started before a fork does not exist in the forked child -- so every request
hangs forever waiting on an event loop that never actually runs in that process.

Instead, each request here gets its own self-contained `asyncio.run()` call in
whatever thread/process is already handling it -- no persistent background
thread, so there's nothing that can fail to survive a fork. The tradeoff: the
full response is buffered in memory rather than streamed, and the ASGI lifespan
protocol (startup/shutdown events) never runs -- fine here, since schema setup
is handled by Alembic migrations, not the app's own startup hook.
"""

import asyncio
from http.client import responses as http_reason_phrases

from app.main import app as asgi_app


def _build_scope(environ: dict) -> dict:
    headers = []
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            name = key[5:].replace("_", "-").lower().encode("latin-1")
            headers.append((name, value.encode("latin-1")))
    if environ.get("CONTENT_TYPE"):
        headers.append((b"content-type", environ["CONTENT_TYPE"].encode("latin-1")))
    if environ.get("CONTENT_LENGTH"):
        headers.append((b"content-length", environ["CONTENT_LENGTH"].encode("latin-1")))

    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": environ.get("SERVER_PROTOCOL", "HTTP/1.1").rsplit("/", 1)[-1],
        "method": environ["REQUEST_METHOD"],
        "scheme": environ.get("wsgi.url_scheme", "http"),
        "path": environ.get("PATH_INFO", ""),
        "raw_path": environ.get("PATH_INFO", "").encode("utf-8"),
        "query_string": environ.get("QUERY_STRING", "").encode("latin-1"),
        "root_path": environ.get("SCRIPT_NAME", ""),
        "headers": headers,
        "server": (environ.get("SERVER_NAME", "localhost"), int(environ.get("SERVER_PORT") or 80)),
        "client": (environ.get("REMOTE_ADDR", "127.0.0.1"), 0),
    }


async def _run_asgi(environ: dict) -> dict:
    scope = _build_scope(environ)
    content_length = int(environ.get("CONTENT_LENGTH") or 0)
    body = environ["wsgi.input"].read(content_length) if content_length else b""

    already_received = False

    async def receive():
        nonlocal already_received
        if not already_received:
            already_received = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    result = {"status": 500, "headers": [], "body": bytearray()}

    async def send(message):
        if message["type"] == "http.response.start":
            result["status"] = message["status"]
            result["headers"] = message["headers"]
        elif message["type"] == "http.response.body":
            result["body"].extend(message.get("body", b""))

    await asgi_app(scope, receive, send)
    return result


def application(environ, start_response):
    result = asyncio.run(_run_asgi(environ))

    status = result["status"]
    reason = http_reason_phrases.get(status, "Unknown")
    headers = [(name.decode("latin-1"), value.decode("latin-1")) for name, value in result["headers"]]

    start_response(f"{status} {reason}", headers)
    return [bytes(result["body"])]
