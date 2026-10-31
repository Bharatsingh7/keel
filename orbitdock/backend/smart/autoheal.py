"""Container Autoheal & Sentinel Watcher (Autoheal algorithm)."""
import asyncio
import time
from typing import Dict, Set
import logging
from orbitdock.backend.core.docker_engine import get_client
from orbitdock.backend.core.database import log_event

logger = logging.getLogger("orbitdock.autoheal")

# Track restart timestamps and counts per container for exponential backoff
_CONTAINER_RESTARTS: Dict[str, list] = {}
_RUNNING = False

async def autoheal_sentinel_loop(interval_seconds: int = 30):
    """Background monitoring loop for unhealthy containers."""
    global _RUNNING
    _RUNNING = True
    logger.info("OrbitDock Autoheal sentinel loop started.")

    while _RUNNING:
        try:
            client = get_client()
            containers = client.containers.list(all=False)
            now = time.time()

            for c in containers:
                attrs = c.attrs
                state = attrs.get("State", {})
                health = state.get("Health", {})
                status = health.get("Status")

                # If container has healthcheck and is reported 'unhealthy'
                if status == "unhealthy":
                    c_id = c.id
                    c_name = c.name

                    # Check backoff window (max 3 restarts in 10 minutes)
                    history = _CONTAINER_RESTARTS.get(c_id, [])
                    # Prune history older than 600 seconds
                    history = [t for t in history if now - t < 600]
                    _CONTAINER_RESTARTS[c_id] = history

                    if len(history) >= 3:
                        logger.warning(f"Autoheal backoff: Container {c_name} exceeded 3 restarts in 10m. Skipping to prevent storm.")
                        continue

                    logger.info(f"Autoheal: Container {c_name} is unhealthy. Triggering graceful restart...")
                    try:
                        c.restart(timeout=10)
                        history.append(now)
                        _CONTAINER_RESTARTS[c_id] = history

                        log_event(
                            event_type="autoheal_restart",
                            target_type="container",
                            target_id=c_id[:12],
                            target_name=c_name,
                            details={
                                "reason": "unhealthy_status",
                                "failing_streak": health.get("FailingStreak", 0),
                                "restart_count_recent": len(history)
                            }
                        )
                    except Exception as re:
                        logger.error(f"Autoheal restart failed for {c_name}: {re}")

        except Exception as e:
            logger.debug(f"Autoheal loop error: {e}")

        await asyncio.sleep(interval_seconds)

def stop_autoheal():
    global _RUNNING
    _RUNNING = False
