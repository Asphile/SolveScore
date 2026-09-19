"""WSGI entry point for hosts that only serve WSGI apps (e.g. PythonAnywhere's
free-tier web apps), which FastAPI (an ASGI app) cannot be plugged into directly.

On PythonAnywhere, point the "Web" tab's WSGI configuration file at this module,
or copy its two lines into the WSGI file PythonAnywhere generates for you.

This bridge runs requests synchronously rather than through an ASGI event loop,
so there's no concurrency benefit from `async def` routes here -- fine for a
small competition site's traffic, not a general substitute for running behind
real uvicorn (which is what `uvicorn app.main:app` on a VPS still does).
"""

from a2wsgi import ASGIMiddleware

from app.main import app as _asgi_app

application = ASGIMiddleware(_asgi_app)
