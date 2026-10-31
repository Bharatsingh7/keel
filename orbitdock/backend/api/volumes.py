"""Docker Volumes management REST endpoints."""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List
from docker.errors import NotFound
import logging

from orbitdock.backend.core.docker_engine import get_client
from orbitdock.backend.core.database import log_event

router = APIRouter(prefix="/api/volumes", tags=["volumes"])
logger = logging.getLogger("orbitdock.volumes")

@router.get("")
def list_volumes():
    """List all Docker volumes and attached containers."""
    try:
        client = get_client()
        vols = client.volumes.list()
        containers = client.containers.list(all=True)

        # Map volume names to containers using them
        vol_usage_map = {}
        for c in containers:
            mounts = c.attrs.get("Mounts") or []
            for m in mounts:
                v_name = m.get("Name")
                if v_name:
                    vol_usage_map.setdefault(v_name, []).append({
                        "container_id": c.id[:12],
                        "container_name": c.name,
                        "destination": m.get("Destination")
                    })

        result = []
        for v in vols:
            attrs = v.attrs
            name = attrs.get("Name", "")
            attached = vol_usage_map.get(name, [])
            result.append({
                "name": name,
                "driver": attrs.get("Driver", "local"),
                "scope": attrs.get("Scope", "local"),
                "mountpoint": attrs.get("Mountpoint", ""),
                "created_at": attrs.get("CreatedAt", ""),
                "in_use": len(attached) > 0,
                "attached_containers": attached
            })

        return {"volumes": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Error listing volumes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_volume(payload: Dict[str, Any] = Body(...)):
    """Create a new Docker volume."""
    name = payload.get("name")
    driver = payload.get("driver", "local")
    driver_opts = payload.get("driver_opts")
    labels = payload.get("labels")

    if not name:
        raise HTTPException(status_code=400, detail="Volume name is required")

    client = get_client()
    try:
        vol = client.volumes.create(
            name=name,
            driver=driver,
            driver_opts=driver_opts,
            labels=labels
        )
        log_event(
            event_type="volume_create",
            target_type="volume",
            target_id=name,
            target_name=name,
            details={"driver": driver}
        )
        return {"success": True, "name": vol.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{name}")
def delete_volume(name: str, force: bool = Query(False)):
    """Remove a Docker volume."""
    client = get_client()
    try:
        vol = client.volumes.get(name)
        vol.remove(force=force)
        log_event(
            event_type="volume_delete",
            target_type="volume",
            target_id=name,
            target_name=name,
            details={"force": force}
        )
        return {"success": True, "name": name}
    except NotFound:
        raise HTTPException(status_code=404, detail="Volume not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/prune")
def prune_volumes():
    """Remove all unused local volumes."""
    client = get_client()
    try:
        res = client.volumes.prune()
        reclaimed = res.get("SpaceReclaimed", 0)
        vols_deleted = res.get("VolumesDeleted") or []
        return {
            "success": True,
            "space_reclaimed_mb": round(reclaimed / (1024 * 1024), 2),
            "volumes_deleted_count": len(vols_deleted)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
