"""Resilient Docker client interface and metrics calculation helpers."""
import docker
from docker.errors import DockerException, NotFound, APIError
from typing import Any, Dict, List, Optional, Tuple
import logging

logger = logging.getLogger("orbitdock.docker")

_client: Optional[docker.DockerClient] = None

def get_client() -> docker.DockerClient:
    global _client
    if _client is None:
        try:
            _client = docker.from_env()
        except DockerException as e:
            logger.error(f"Failed to connect to Docker daemon: {e}")
            raise
    return _client

def get_api_client() -> docker.APIClient:
    client = get_client()
    return client.api

def is_connected() -> bool:
    try:
        client = get_client()
        return client.ping() is True
    except Exception:
        return False

def calculate_cpu_percent(stats: Dict[str, Any]) -> float:
    """Calculate CPU percentage from docker stats payload."""
    try:
        cpu_stats = stats.get("cpu_stats", {})
        precpu_stats = stats.get("precpu_stats", {})
        
        cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
        system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
        
        if system_delta > 0 and cpu_delta > 0:
            online_cpus = cpu_stats.get("online_cpus") or len(cpu_stats.get("cpu_usage", {}).get("percpu_usage") or [1])
            cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0
            return round(cpu_percent, 2)
    except Exception:
        pass
    return 0.0

def calculate_mem_stats(stats: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate memory usage in bytes, limit, and percentage."""
    try:
        mem_stats = stats.get("memory_stats", {})
        usage = mem_stats.get("usage", 0)
        # On cgroups v1 cache may be included, v2 uses inactive_file
        stats_sub = mem_stats.get("stats", {})
        cache = stats_sub.get("inactive_file", stats_sub.get("cache", 0))
        used_memory = max(0, usage - cache)
        limit = mem_stats.get("limit", 0)
        percent = (used_memory / limit * 100.0) if limit > 0 else 0.0
        return {
            "used_bytes": used_memory,
            "limit_bytes": limit,
            "percent": round(percent, 2)
        }
    except Exception:
        return {"used_bytes": 0, "limit_bytes": 0, "percent": 0.0}

def calculate_network_stats(stats: Dict[str, Any]) -> Dict[str, int]:
    """Calculate aggregate RX and TX bytes."""
    rx_bytes = 0
    tx_bytes = 0
    try:
        networks = stats.get("networks", {})
        for _, net in networks.items():
            rx_bytes += net.get("rx_bytes", 0)
            tx_bytes += net.get("tx_bytes", 0)
    except Exception:
        pass
    return {"rx_bytes": rx_bytes, "tx_bytes": tx_bytes}

def format_container_summary(c: Any) -> Dict[str, Any]:
    """Extract clean summary fields for container listings and cards."""
    attrs = c.attrs if hasattr(c, "attrs") else {}
    state = attrs.get("State", {})
    config = attrs.get("Config", {})
    network_settings = attrs.get("NetworkSettings", {})
    host_config = attrs.get("HostConfig", {})
    
    # Extract clean ports mapping
    ports_map = []
    ports = network_settings.get("Ports") or {}
    for container_port, host_bindings in ports.items():
        if host_bindings:
            for b in host_bindings:
                ports_map.append({
                    "container_port": container_port,
                    "host_ip": b.get("HostIp", ""),
                    "host_port": b.get("HostPort", "")
                })
        else:
            ports_map.append({
                "container_port": container_port,
                "host_ip": None,
                "host_port": None
            })

    # Compose stack project label if available
    labels = config.get("Labels") or {}
    stack_name = labels.get("com.docker.compose.project")

    # Health status
    health_status = state.get("Health", {}).get("Status") if "Health" in state else None

    # Primary IP
    ip_address = network_settings.get("IPAddress", "")
    if not ip_address:
        networks = network_settings.get("Networks", {})
        for net in networks.values():
            if net.get("IPAddress"):
                ip_address = net.get("IPAddress")
                break

    name = c.name if hasattr(c, "name") else attrs.get("Name", "").lstrip("/")

    return {
        "id": c.id if hasattr(c, "id") else attrs.get("Id", "")[:12],
        "full_id": c.id if hasattr(c, "id") else attrs.get("Id", ""),
        "name": name,
        "image": config.get("Image", ""),
        "image_id": attrs.get("Image", "")[:19],
        "command": config.get("Cmd") or [],
        "created": attrs.get("Created", ""),
        "status": c.status if hasattr(c, "status") else state.get("Status", "unknown"),
        "state": {
            "status": state.get("Status", ""),
            "running": state.get("Running", False),
            "paused": state.get("Paused", False),
            "restarting": state.get("Restarting", False),
            "oom_killed": state.get("OOMKilled", False),
            "exit_code": state.get("ExitCode", 0),
            "error": state.get("Error", ""),
            "started_at": state.get("StartedAt", ""),
            "finished_at": state.get("FinishedAt", ""),
            "health": health_status
        },
        "ports": ports_map,
        "ip_address": ip_address,
        "stack": stack_name,
        "labels": labels,
        "restart_policy": host_config.get("RestartPolicy", {}).get("Name", "no")
    }
