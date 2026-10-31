"""Remote Docker Registry Image Update Checker (Watchtower algorithm)."""
import httpx
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger("orbitdock.updates")

# Cache to prevent hitting Docker Hub rate limits
_UPDATE_CACHE: Dict[str, Dict[str, Any]] = {}

async def check_image_update(image_tag: str, local_repo_digests: List[str]) -> Dict[str, Any]:
    """
    Check if a remote Docker image tag has a newer manifest digest than local digest.
    Supports official Docker Hub images (e.g. 'redis:alpine', 'postgres:16', 'library/nginx').
    """
    if not image_tag or ":" not in image_tag:
        image_tag = f"{image_tag}:latest"

    # Normalize image name
    parts = image_tag.split(":", 1)
    repo, tag = parts[0], parts[1]

    # Handle official library images
    if "/" not in repo:
        repo = f"library/{repo}"

    cache_key = f"{repo}:{tag}"
    if cache_key in _UPDATE_CACHE:
        return _UPDATE_CACHE[cache_key]

    token_url = f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull"
    manifest_url = f"https://registry-1.docker.io/v2/{repo}/manifests/{tag}"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            # 1. Fetch anonymous auth token from Docker Hub auth service
            token_resp = await client.get(token_url)
            if token_resp.status_code != 200:
                result = {"checked": False, "has_update": False, "reason": "Auth failure"}
                _UPDATE_CACHE[cache_key] = result
                return result

            token = token_resp.json().get("token")
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json"
            }

            # 2. Query manifest header for Docker-Content-Digest
            head_resp = await client.head(manifest_url, headers=headers)
            remote_digest = head_resp.headers.get("Docker-Content-Digest")

            if not remote_digest:
                result = {"checked": False, "has_update": False, "reason": "No digest header returned"}
                _UPDATE_CACHE[cache_key] = result
                return result

            # Compare with local repo digests
            has_update = True
            for local_d in local_repo_digests:
                if remote_digest in local_d:
                    has_update = False
                    break

            result = {
                "checked": True,
                "has_update": has_update,
                "remote_digest": remote_digest[:19] + "...",
                "image": image_tag
            }
            _UPDATE_CACHE[cache_key] = result
            return result
    except Exception as e:
        logger.debug(f"Update check skipped for {image_tag}: {e}")
        return {"checked": False, "has_update": False, "reason": str(e)}
