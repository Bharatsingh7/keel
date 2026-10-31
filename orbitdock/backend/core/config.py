"""Configuration settings for OrbitDock."""
import os
from pathlib import Path

# Base Paths
USER_HOME = Path.home()
ORBITDOCK_DIR = USER_HOME / ".orbitdock"
ORBITDOCK_DIR.mkdir(parents=True, exist_ok=True)

STACKS_DIR = ORBITDOCK_DIR / "stacks"
STACKS_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = ORBITDOCK_DIR / "orbitdock.db"

# Server configuration
PORT = int(os.getenv("ORBITDOCK_PORT", "9090"))
HOST = os.getenv("ORBITDOCK_HOST", "0.0.0.0")

# Docker configuration
DOCKER_HOST = os.getenv("DOCKER_HOST", "unix:///var/run/docker.sock")
AUTOHEAL_INTERVAL_SECONDS = int(os.getenv("ORBITDOCK_AUTOHEAL_INTERVAL", "30"))
UPDATE_CHECK_INTERVAL_SECONDS = int(os.getenv("ORBITDOCK_UPDATE_INTERVAL", "3600"))
