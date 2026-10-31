"""Docker Networks management REST endpoints."""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List
from docker.errors import NotFound
import logging

from orbitdock.backend.core.docker_engine import get_client
from orbitdock.backend.core.database import log_event

router = APIRouter(prefix="/api/networks", tags=["networks"])
logger = logging.getLogger("orbitdock.networks")

@router.get("")
def list_networks():
    """List all Docker networks and connected containers."""
    try:
        client = get_client()
        networks = client.networks.list()
        result = []
        for net in networks:
            attrs = net.attrs
            containers = attrs.get("Containers") or {}
            connected = []
            for c_id, c_data in containers.items():
                connected.append({
                    "container_id": c_id[:12],
                    "container_name": c_data.get("Name", ""),
                    "ipv4_address": c_data.get("IPv4Address", ""),
                    "mac_address": c_data.get("MacAddress", "")
                })

            ipam_configs = attrs.get("IPAM", {}).get("Config") or []
            subnet = ipam_configs[0].get("Subnet") if ipam_configs else ""
            gateway = ipam_configs[0].get("Gateway") if ipam_configs else ""

            result.append({
                "id": net.id[:12],
                "full_id": net.id,
                "name": net.name,
                "driver": attrs.get("Driver", "bridge"),
                "scope": attrs.get("Scope", "local"),
                "subnet": subnet,
                "gateway": gateway,
                "internal": attrs.get("Internal", False),
                "connected_count": len(connected),
                "connected_containers": connected
            })

        return {"networks": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Error listing networks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_network(payload: Dict[str, Any] = Body(...)):
    """Create a new Docker network (bridge, macvlan, overlay, etc.)."""
    name = payload.get("name")
    driver = payload.get("driver", "bridge")
    subnet = payload.get("subnet")
    gateway = payload.get("gateway")
    internal = payload.get("internal", False)

    if not name:
        raise HTTPException(status_code=400, detail="Network name is required")

    client = get_client()
    ipam_pool = None
    ipam_config = None
    if subnet:
        import docker.types
        ipam_pool = docker.types.IPAMPool(subnet=subnet, gateway=gateway if gateway else None)
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])

    try:
        net = client.networks.create(
            name=name,
            driver=driver,
            internal=internal,
            ipam=ipam_config
        )
        log_event(
            event_type="network_create",
            target_type="network",
            target_id=net.id[:12],
            target_name=name,
            details={"driver": driver, "subnet": subnet}
        )
        return {"success": True, "id": net.id[:12], "name": net.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{network_id}/connect")
def connect_container(network_id: str, payload: Dict[str, str] = Body(...)):
    """Connect a container to this network."""
    container_id = payload.get("container_id")
    if not container_id:
        raise HTTPException(status_code=400, detail="container_id is required")

    client = get_client()
    try:
        net = client.networks.get(network_id)
        net.connect(container=container_id)
        return {"success": True, "network_id": network_id, "container_id": container_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{network_id}/disconnect")
def disconnect_container(network_id: str, payload: Dict[str, str] = Body(...)):
    """Disconnect a container from this network."""
    container_id = payload.get("container_id")
    if not container_id:
        raise HTTPException(status_code=400, detail="container_id is required")

    client = get_client()
    try:
        net = client.networks.get(network_id)
        net.disconnect(container=container_id)
        return {"success": True, "network_id": network_id, "container_id": container_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{network_id}")
def delete_network(network_id: str):
    """Delete a Docker network."""
    client = get_client()
    try:
        net = client.networks.get(network_id)
        net.remove()
        log_event(
            event_type="network_delete",
            target_type="network",
            target_id=network_id[:12],
            target_name=net.name,
            details={}
        )
        return {"success": True, "id": network_id}
    except NotFound:
        raise HTTPException(status_code=404, detail="Network not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/prune")
def prune_networks():
    """Remove all unused networks."""
    client = get_client()
    try:
        res = client.networks.prune()
        nets_deleted = res.get("NetworksDeleted") or []
        return {"success": True, "networks_deleted_count": len(nets_deleted)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
