"""WebSocket streaming endpoints for Live Logs, Multi-Logs, Real-time Stats, and Interactive Web Terminal."""
import asyncio
import json
import socket
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import List, Optional
import logging

from orbitdock.backend.core.docker_engine import (
    get_client, get_api_client, calculate_cpu_percent, calculate_mem_stats, calculate_network_stats
)
from orbitdock.backend.core.database import get_connection

router = APIRouter(prefix="/ws", tags=["streaming"])
logger = logging.getLogger("orbitdock.stream")

@router.websocket("/containers/{container_id}/logs")
async def container_logs_websocket(
    websocket: WebSocket,
    container_id: str,
    tail: int = Query(100),
    timestamps: bool = Query(True)
):
    """Real-time log streaming for a single container."""
    await websocket.accept()
    client = get_client()

    try:
        container = client.containers.get(container_id)
        # Stream logs in an async thread pool
        log_stream = container.logs(
            stream=True,
            follow=True,
            tail=tail,
            timestamps=timestamps
        )

        def get_next_chunk():
            try:
                return next(log_stream)
            except StopIteration:
                return None
            except Exception:
                return None

        while True:
            chunk = await asyncio.to_thread(get_next_chunk)
            if chunk is None:
                break
            line = chunk.decode("utf-8", errors="replace")
            await websocket.send_text(line)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"Log stream ended: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@router.websocket("/containers/{container_id}/stats")
async def container_stats_websocket(websocket: WebSocket, container_id: str):
    """Real-time streaming stats (CPU %, RAM, Net I/O)."""
    await websocket.accept()
    client = get_client()

    try:
        container = client.containers.get(container_id)
        if container.status != "running":
            await websocket.send_json({"status": container.status, "running": False})
            await websocket.close()
            return

        stats_stream = container.stats(stream=True, decode=True)

        def get_next_stat():
            try:
                return next(stats_stream)
            except Exception:
                return None

        while True:
            stat_obj = await asyncio.to_thread(get_next_stat)
            if stat_obj is None:
                break

            cpu_pct = calculate_cpu_percent(stat_obj)
            mem_data = calculate_mem_stats(stat_obj)
            net_data = calculate_network_stats(stat_obj)

            payload = {
                "container_id": container_id,
                "timestamp": stat_obj.get("read"),
                "cpu_percent": cpu_pct,
                "mem_used_mb": round(mem_data["used_bytes"] / (1024 * 1024), 2),
                "mem_limit_mb": round(mem_data["limit_bytes"] / (1024 * 1024), 2),
                "mem_percent": mem_data["percent"],
                "net_rx_kb": round(net_data["rx_bytes"] / 1024, 2),
                "net_tx_kb": round(net_data["tx_bytes"] / 1024, 2)
            }
            await websocket.send_json(payload)
            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"Stats stream ended: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@router.websocket("/containers/{container_id}/terminal")
async def container_terminal_websocket(
    websocket: WebSocket,
    container_id: str,
    shell: str = Query("/bin/sh")
):
    """
    Interactive Web Terminal: bridges WebSocket messages directly to Docker PTY exec stream.
    Supports terminal commands, cursor keys, nano, htop, and resize.
    """
    await websocket.accept()
    api = get_api_client()

    try:
        # Create exec instance with interactive TTY
        exec_instance = api.exec_create(
            container=container_id,
            cmd=shell,
            stdin=True,
            stdout=True,
            stderr=True,
            tty=True
        )
        exec_id = exec_instance["Id"]

        # Hijack raw socket
        sock = api.exec_start(exec_id, detach=False, tty=True, socket=True)
        raw_socket: socket.socket = sock._sock if hasattr(sock, "_sock") else sock

        raw_socket.setblocking(False)

        # Loop 1: Read from container socket and send to WebSocket
        async def from_docker_to_ws():
            loop = asyncio.get_running_loop()
            while True:
                try:
                    data = await loop.sock_recv(raw_socket, 4096)
                    if not data:
                        break
                    await websocket.send_bytes(data)
                except Exception:
                    break

        # Loop 2: Read from WebSocket and send to container socket
        async def from_ws_to_docker():
            loop = asyncio.get_running_loop()
            while True:
                try:
                    msg = await websocket.receive()
                    if "bytes" in msg and msg["bytes"]:
                        await loop.sock_sendall(raw_socket, msg["bytes"])
                    elif "text" in msg and msg["text"]:
                        # Check for resize event format {"type":"resize","cols":80,"rows":24}
                        text = msg["text"]
                        if text.startswith("{") and "resize" in text:
                            try:
                                data = json.loads(text)
                                if data.get("type") == "resize":
                                    api.exec_resize(exec_id, height=data.get("rows", 24), width=data.get("cols", 80))
                                    continue
                            except Exception:
                                pass
                        await loop.sock_sendall(raw_socket, text.encode("utf-8"))
                except WebSocketDisconnect:
                    break
                except Exception:
                    break

        await asyncio.gather(from_docker_to_ws(), from_ws_to_docker())

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"Terminal session ended: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@router.websocket("/multi-logs")
async def multi_container_logs_websocket(websocket: WebSocket, ids: str = Query(...)):
    """
    Dozzle-style multi-container log aggregation.
    Interleaves and streams logs from comma-separated container IDs.
    """
    await websocket.accept()
    client = get_client()
    container_ids = [c_id.strip() for c_id in ids.split(",") if c_id.strip()]

    queue = asyncio.Queue()

    async def stream_single(c_id: str):
        try:
            c = client.containers.get(c_id)
            c_name = c.name
            log_iter = c.logs(stream=True, follow=True, tail=30, timestamps=True)

            def get_chunk():
                try:
                    return next(log_iter)
                except Exception:
                    return None

            while True:
                raw = await asyncio.to_thread(get_chunk)
                if raw is None:
                    break
                text = raw.decode("utf-8", errors="replace")
                await queue.put({
                    "container_id": c_id[:12],
                    "container_name": c_name,
                    "log": text
                })
        except Exception:
            pass

    tasks = [asyncio.create_task(stream_single(cid)) for cid in container_ids]

    async def sender():
        while True:
            item = await queue.get()
            await websocket.send_json(item)

    sender_task = asyncio.create_task(sender())

    try:
        await asyncio.gather(*tasks)
    except WebSocketDisconnect:
        pass
    finally:
        sender_task.cancel()
        for t in tasks:
            t.cancel()
        try:
            await websocket.close()
        except Exception:
            pass
