"""Docker Images management REST endpoints and layer inspection."""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List, Optional
from docker.errors import NotFound, APIError
import logging

from orbitdock.backend.core.docker_engine import get_client, get_api_client
from orbitdock.backend.core.database import log_event
from orbitdock.backend.smart.layer_analyzer import analyze_image_layers
from orbitdock.backend.smart.update_checker import check_image_update

router = APIRouter(prefix="/api/images", tags=["images"])
logger = logging.getLogger("orbitdock.images")

@router.get("")
def list_images():
    """List all Docker images with sizes, tags, and usage status."""
    try:
        client = get_client()
        images = client.images.list()
        containers = client.containers.list(all=True)

        # Collect image IDs actively in use by containers
        used_image_ids = set()
        for c in containers:
            img_id = c.attrs.get("Image")
            if img_id:
                used_image_ids.add(img_id)

        result = []
        for img in images:
            attrs = img.attrs
            size_bytes = attrs.get("Size", 0)
            img_id = img.id.replace("sha256:", "")[:12]
            tags = img.tags or ["<none>:<none>"]

            result.append({
                "id": img_id,
                "full_id": img.id,
                "tags": tags,
                "created": attrs.get("Created", ""),
                "size_bytes": size_bytes,
                "size_mb": round(size_bytes / (1024 * 1024), 2),
                "in_use": img.id in used_image_ids or any(c.image.id == img.id for c in containers if hasattr(c, "image")),
                "repo_digests": attrs.get("RepoDigests") or []
            })

        return {"images": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Error listing images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{image_id}/layers")
def get_image_layers(image_id: str):
    """Analyze image layers and compute Dive-style efficiency score."""
    analysis = analyze_image_layers(image_id)
    if "error" in analysis:
        raise HTTPException(status_code=404, detail=analysis["error"])
    return analysis

@router.post("/pull")
def pull_image(payload: Dict[str, str] = Body(...)):
    """Pull an image from Docker Hub or registry."""
    image_name = payload.get("image")
    if not image_name:
        raise HTTPException(status_code=400, detail="Image name is required")

    client = get_client()
    try:
        logger.info(f"Pulling image: {image_name}")
        img = client.images.pull(image_name)
        log_event(
            event_type="image_pull",
            target_type="image",
            target_id=img.id[:12],
            target_name=image_name,
            details={"tags": img.tags}
        )
        return {"success": True, "image_id": img.id[:12], "tags": img.tags}
    except Exception as e:
        logger.error(f"Pull failed for {image_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{image_id}")
def delete_image(image_id: str, force: bool = Query(False)):
    """Delete image by ID or tag."""
    client = get_client()
    try:
        client.images.remove(image=image_id, force=force)
        log_event(
            event_type="image_delete",
            target_type="image",
            target_id=image_id[:12],
            target_name=image_id,
            details={"force": force}
        )
        return {"success": True, "image_id": image_id}
    except NotFound:
        raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/prune")
def prune_images(dangling_only: bool = Query(True)):
    """Prune unused or dangling images."""
    client = get_client()
    try:
        filters = {"dangling": True} if dangling_only else None
        res = client.images.prune(filters=filters)
        space_reclaimed = res.get("SpaceReclaimed", 0)
        images_deleted = res.get("ImagesDeleted") or []
        return {
            "success": True,
            "space_reclaimed_mb": round(space_reclaimed / (1024 * 1024), 2),
            "images_deleted_count": len(images_deleted)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
