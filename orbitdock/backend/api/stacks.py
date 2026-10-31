"""Docker Compose & Native Stacks Management (Dockge file-based algorithm)."""
import subprocess
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List, Optional
import yaml
import logging

from orbitdock.backend.core.config import STACKS_DIR
from orbitdock.backend.core.docker_engine import get_client
from orbitdock.backend.core.database import log_event, get_connection
from orbitdock.backend.smart.composerize import docker_run_to_compose

router = APIRouter(prefix="/api/stacks", tags=["stacks"])
logger = logging.getLogger("orbitdock.stacks")

@router.get("")
def list_stacks():
    """List all compose stacks (both local files and active projects on Docker daemon)."""
    client = get_client()
    containers = client.containers.list(all=True)

    # 1. Discover projects from running container labels
    active_projects = {}
    for c in containers:
        labels = c.attrs.get("Config", {}).get("Labels") or {}
        project = labels.get("com.docker.compose.project")
        if project:
            active_projects.setdefault(project, []).append({
                "container_id": c.id[:12],
                "name": c.name,
                "service": labels.get("com.docker.compose.service", ""),
                "status": c.status
            })

    # 2. Discover file-based stacks in STACKS_DIR
    stacks_list = []
    seen = set()

    if STACKS_DIR.exists():
        for stack_folder in STACKS_DIR.iterdir():
            if stack_folder.is_dir():
                compose_file = stack_folder / "compose.yaml"
                if not compose_file.exists():
                    compose_file = stack_folder / "docker-compose.yml"

                name = stack_folder.name
                seen.add(name)
                services = active_projects.get(name, [])
                is_running = any(s["status"] == "running" for s in services)

                stacks_list.append({
                    "name": name,
                    "type": "file_based",
                    "path": str(compose_file) if compose_file.exists() else str(stack_folder),
                    "services_count": len(services),
                    "status": "running" if is_running else ("partial" if services else "stopped"),
                    "containers": services
                })

    # 3. Add any Docker daemon detected stacks that are not in STACKS_DIR
    for proj_name, services in active_projects.items():
        if proj_name not in seen:
            is_running = any(s["status"] == "running" for s in services)
            stacks_list.append({
                "name": proj_name,
                "type": "external",
                "path": "Docker Host",
                "services_count": len(services),
                "status": "running" if is_running else "stopped",
                "containers": services
            })

    return {"stacks": stacks_list, "total": len(stacks_list)}

@router.get("/{name}")
def get_stack(name: str):
    """Retrieve compose.yaml and status for a specific stack."""
    stack_folder = STACKS_DIR / name
    compose_file = stack_folder / "compose.yaml"
    if not compose_file.exists():
        compose_file = stack_folder / "docker-compose.yml"

    content = ""
    env_content = ""
    if compose_file.exists():
        content = compose_file.read_text(encoding="utf-8")

    env_file = stack_folder / ".env"
    if env_file.exists():
        env_content = env_file.read_text(encoding="utf-8")

    # Get active containers
    client = get_client()
    containers = client.containers.list(all=True, filters={"label": f"com.docker.compose.project={name}"})
    services = []
    for c in containers:
        services.append({
            "id": c.id[:12],
            "name": c.name,
            "status": c.status,
            "image": c.attrs.get("Config", {}).get("Image", "")
        })

    return {
        "name": name,
        "compose_yaml": content,
        "env_content": env_content,
        "services": services
    }

@router.post("/deploy")
def deploy_stack(payload: Dict[str, Any] = Body(...)):
    """Deploy or update a stack using docker compose up -d."""
    name = payload.get("name")
    compose_yaml = payload.get("compose_yaml")
    env_content = payload.get("env_content", "")

    if not name or not compose_yaml:
        raise HTTPException(status_code=400, detail="Stack name and compose_yaml are required")

    # Validate YAML syntax
    try:
        yaml.safe_load(compose_yaml)
    except Exception as ye:
        raise HTTPException(status_code=400, detail=f"Invalid YAML syntax: {ye}")

    # Write to standard native directory
    stack_folder = STACKS_DIR / name
    stack_folder.mkdir(parents=True, exist_ok=True)
    compose_path = stack_folder / "compose.yaml"
    compose_path.write_text(compose_yaml, encoding="utf-8")

    if env_content:
        (stack_folder / ".env").write_text(env_content, encoding="utf-8")

    # Run docker compose up -d
    cmd = ["docker", "compose", "-f", str(compose_path), "up", "-d", "--remove-orphans"]
    try:
        res = subprocess.run(
            cmd,
            cwd=str(stack_folder),
            capture_output=True,
            text=True,
            timeout=120
        )
        if res.returncode != 0:
            error_msg = res.stderr or res.stdout
            logger.error(f"Compose up failed: {error_msg}")
            raise HTTPException(status_code=500, detail=f"Deploy error: {error_msg}")

        log_event(
            event_type="stack_deploy",
            target_type="stack",
            target_id=name,
            target_name=name,
            details={"output": res.stdout}
        )

        return {"success": True, "name": name, "output": res.stdout or res.stderr}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Docker compose deployment timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/down")
def down_stack(name: str):
    """Stop and destroy stack services using docker compose down."""
    stack_folder = STACKS_DIR / name
    compose_file = stack_folder / "compose.yaml"
    if not compose_file.exists():
        compose_file = stack_folder / "docker-compose.yml"

    if not compose_file.exists():
        # Fallback to docker compose project name
        cmd = ["docker", "compose", "-p", name, "down"]
        cwd = None
    else:
        cmd = ["docker", "compose", "-f", str(compose_file), "down"]
        cwd = str(stack_folder)

    try:
        res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=60)
        log_event(
            event_type="stack_down",
            target_type="stack",
            target_id=name,
            target_name=name,
            details={"output": res.stdout}
        )
        return {"success": True, "output": res.stdout or res.stderr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/composerize")
def composerize_command(payload: Dict[str, str] = Body(...)):
    """Convert any docker run command to Compose YAML."""
    cmd = payload.get("command")
    if not cmd:
        raise HTTPException(status_code=400, detail="Command string is required")

    try:
        result = docker_run_to_compose(cmd)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse docker run command: {e}")
