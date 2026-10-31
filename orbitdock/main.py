"""OrbitDock main CLI runner."""
import sys
import argparse
import uvicorn
from orbitdock.backend.core.config import PORT, HOST

def main():
    parser = argparse.ArgumentParser(description="OrbitDock - Intelligent Docker Container Platform")
    parser.add_argument("--port", type=int, default=PORT, help=f"Port to bind server (default: {PORT})")
    parser.add_argument("--host", type=str, default=HOST, help=f"Host to bind server (default: {HOST})")
    parser.add_argument("--reload", action="store_true", help="Enable hot reloading (dev mode)")
    args = parser.parse_args()

    print(f"""
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                         ORBITDOCK                           ┃
    ┃        Next-Gen Intelligent Docker Container Platform       ┃
    ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
    ┃  ► Web Dashboard : http://localhost:{args.port:<5}                   ┃
    ┃  ► API Specs     : http://localhost:{args.port:<5}/docs              ┃
    ┃  ► Docker Socket : /var/run/docker.sock                     ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    """)

    uvicorn.run(
        "orbitdock.backend.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )

if __name__ == "__main__":
    main()
