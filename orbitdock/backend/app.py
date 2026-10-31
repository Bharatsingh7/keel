"""FastAPI Application factory, routing, lifespan hooks, and static SPA serving."""
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import logging

from orbitdock.backend.core.database import init_db
from orbitdock.backend.core.config import AUTOHEAL_INTERVAL_SECONDS
from orbitdock.backend.smart.autoheal import autoheal_sentinel_loop, stop_autoheal
from orbitdock.backend.api.containers import router as containers_router
from orbitdock.backend.api.stream import router as stream_router
from orbitdock.backend.api.images import router as images_router
from orbitdock.backend.api.volumes import router as volumes_router
from orbitdock.backend.api.networks import router as networks_router
from orbitdock.backend.api.stacks import router as stacks_router
from orbitdock.backend.api.system import router as system_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("orbitdock")

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("OrbitDock starting up...")
    init_db()
    # Launch autoheal background task
    autoheal_task = asyncio.create_task(autoheal_sentinel_loop(interval_seconds=AUTOHEAL_INTERVAL_SECONDS))
    yield
    # Shutdown
    logger.info("OrbitDock shutting down...")
    stop_autoheal()
    autoheal_task.cancel()
    try:
        await autoheal_task
    except asyncio.CancelledError:
        pass

def create_app() -> FastAPI:
    app = FastAPI(
        title="OrbitDock",
        description="Next-Generation Intelligent Docker Container Platform",
        version="1.0.0",
        lifespan=lifespan
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include REST and WebSocket Routers
    app.include_router(containers_router)
    app.include_router(stream_router)
    app.include_router(images_router)
    app.include_router(volumes_router)
    app.include_router(networks_router)
    app.include_router(stacks_router)
    app.include_router(system_router)

    # Mount static assets
    if FRONTEND_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"name": "OrbitDock API", "status": "online"}

    return app

app = create_app()
