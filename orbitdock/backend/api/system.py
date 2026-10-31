"""Host system specs, Docker disk usage breakdown, and global cleanup REST endpoints."""
import platform
import psutil
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List
import logging

from orbitdock.backend.core.docker_engine import get_client, get_api_client
from orbitdock.backend.core.database import get_recent_audit_logs, log_event
from orbitdock.backend.smart.presets import get_presets

router = APIRouter(prefix="/api/system", tags=["system"])
logger = logging.getLogger("orbitdock.system")

@router.get("/info")
def get_system_info():
    """Get host system specifications and Docker daemon version info."""
    client = get_client()
    try:
        docker_info = client.info()
        docker_version = client.version()

        # Host resource metrics via psutil
        vm = psutil.virtual_memory()
        cpu_count = psutil.cpu_count(logical=True)
        cpu_percent = psutil.cpu_percent(interval=None)
        disk = psutil.disk_usage("/")

        return {
            "host": {
                "hostname": platform.node(),
                "os": f"{platform.system()} {platform.release()}",
                "architecture": platform.machine(),
                "cpu_cores": cpu_count,
                "cpu_percent": cpu_percent,
                "ram_total_gb": round(vm.total / (1024**3), 2),
                "ram_used_gb": round(vm.used / (1024**3), 2),
                "ram_percent": vm.percent,
                "disk_total_gb": round(disk.total / (1024**3), 2),
                "disk_used_gb": round(disk.used / (1024**3), 2),
                "disk_percent": disk.percent
            },
            "docker": {
                "version": docker_version.get("Version", ""),
                "api_version": docker_version.get("ApiVersion", ""),
                "os": docker_info.get("OperatingSystem", ""),
                "kernel": docker_info.get("KernelVersion", ""),
                "containers_total": docker_info.get("Containers", 0),
                "containers_running": docker_info.get("ContainersRunning", 0),
                "containers_paused": docker_info.get("ContainersPaused", 0),
                "containers_stopped": docker_info.get("ContainersStopped", 0),
                "images_total": docker_info.get("Images", 0),
                "server_version": docker_info.get("ServerVersion", "")
            }
        }
    except Exception as e:
        logger.error(f"Error fetching system info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disk-usage")
def get_disk_usage():
    """Get detailed Docker storage usage and reclaimable space breakdown (docker system df)."""
    api = get_api_client()
    try:
        df = api.df()
        
        # Images space
        images_size = sum(img.get("Size", 0) for img in df.get("Images") or [])
        images_reclaimable = sum(
            img.get("Size", 0) for img in df.get("Images") or []
            if img.get("Containers", 0) == 0
        )

        # Containers space
        containers_size = sum(c.get("SizeRw", 0) for c in df.get("Containers") or [])

        # Volumes space
        volumes_size = sum(v.get("UsageData", {}).get("Size", 0) for v in df.get("Volumes") or [])
        volumes_reclaimable = sum(
            v.get("UsageData", {}).get("Size", 0) for v in df.get("Volumes") or []
            if v.get("UsageData", {}).get("RefCount", 0) == 0
        )

        # Build cache
        build_cache_size = sum(bc.get("Size", 0) for bc in df.get("BuildCache") or [])
        build_cache_reclaimable = sum(
            bc.get("Size", 0) for bc in df.get("BuildCache") or []
            if not bc.get("InUse", False)
        )

        total_reclaimable = images_reclaimable + volumes_reclaimable + build_cache_reclaimable

        return {
            "total_size_mb": round((images_size + containers_size + volumes_size + build_cache_size) / (1024 * 1024), 2),
            "total_reclaimable_mb": round(total_reclaimable / (1024 * 1024), 2),
            "images": {
                "count": len(df.get("Images") or []),
                "size_mb": round(images_size / (1024 * 1024), 2),
                "reclaimable_mb": round(images_reclaimable / (1024 * 1024), 2)
            },
            "containers": {
                "count": len(df.get("Containers") or []),
                "size_mb": round(containers_size / (1024 * 1024), 2)
            },
            "volumes": {
                "count": len(df.get("Volumes") or []),
                "size_mb": round(volumes_size / (1024 * 1024), 2),
                "reclaimable_mb": round(volumes_reclaimable / (1024 * 1024), 2)
            },
            "build_cache": {
                "count": len(df.get("BuildCache") or []),
                "size_mb": round(build_cache_size / (1024 * 1024), 2),
                "reclaimable_mb": round(build_cache_reclaimable / (1024 * 1024), 2)
            }
        }
    except Exception as e:
        logger.error(f"Error reading disk usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prune")
def global_system_prune(all_images: bool = Query(False), volumes: bool = Query(False)):
    """1-Click Smart System Prune (LazyDocker style): removes stopped containers, unused networks, and dangling images."""
    client = get_client()
    try:
        # 1. Containers prune
        c_res = client.containers.prune()
        containers_deleted = c_res.get("ContainersDeleted") or []
        space_containers = c_res.get("SpaceReclaimed", 0)

        # 2. Networks prune
        net_res = client.networks.prune()
        nets_deleted = net_res.get("NetworksDeleted") or []

        # 3. Images prune
        img_filters = None if all_images else {"dangling": True}
        img_res = client.images.prune(filters=img_filters)
        images_deleted = img_res.get("ImagesDeleted") or []
        space_images = img_res.get("SpaceReclaimed", 0)

        # 4. Volumes prune if requested
        space_volumes = 0
        vols_deleted = []
        if volumes:
            vol_res = client.volumes.prune()
            vols_deleted = vol_res.get("VolumesDeleted") or []
            space_volumes = vol_res.get("SpaceReclaimed", 0)

        total_reclaimed = space_containers + space_images + space_volumes

        log_event(
            event_type="system_prune",
            target_type="system",
            target_id="host",
            target_name="Docker Host",
            details={
                "reclaimed_mb": round(total_reclaimed / (1024 * 1024), 2),
                "containers_pruned": len(containers_deleted),
                "images_pruned": len(images_deleted)
            }
        )

        return {
            "success": True,
            "total_reclaimed_mb": round(total_reclaimed / (1024 * 1024), 2),
            "containers_pruned": len(containers_deleted),
            "images_pruned": len(images_deleted),
            "networks_pruned": len(nets_deleted),
            "volumes_pruned": len(vols_deleted)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/presets")
def list_presets():
    """Retrieve 1-click launch templates for popular applications."""
    return {"presets": get_presets()}

@router.get("/audit-logs")
def list_audit_logs(limit: int = Query(50)):
    """Retrieve persistent audit event log entries."""
    return {"logs": get_recent_audit_logs(limit=limit)}
