"""Container lifecycle, creation, recreation, and inspection REST endpoints."""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Any, Dict, List, Optional
import docker
from docker.errors import DockerException, NotFound, APIError
import logging

from orbitdock.backend.core.docker_engine import (
    get_client, get_api_client, format_container_summary, calculate_cpu_percent, calculate_mem_stats
)
from orbitdock.backend.core.database import log_event
from orbitdock.backend.smart.diagnostics import analyze_container_failure
from orbitdock.backend.smart.security import audit_container_security
from orbitdock.backend.smart.advisor import check_host_port_available, evaluate_resource_optimization
from orbitdock.backend.smart.composerize import container_to_docker_run

router = APIRouter(prefix="/api/containers", tags=["containers"])
logger = logging.getLogger("orbitdock.containers")

@router.get("")
def list_containers(all: bool = True):
    """List all containers with summarized metrics and status."""
    try:
        client = get_client()
        containers = client.containers.list(all=all)
        result = []
        for c in containers:
            summary = format_container_summary(c)
            result.append(summary)
        return {"containers": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Error listing containers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{container_id}")
def get_container_details(container_id: str):
    """Get comprehensive container inspection details, security audit, and diagnostics."""
    try:
        client = get_client()
        c = client.containers.get(container_id)
        attrs = c.attrs
        summary = format_container_summary(c)

        # Retrieve recent logs for diagnostic evaluation if stopped/unhealthy
        recent_logs = ""
        try:
            raw_logs = c.logs(tail=40, timestamps=True)
            recent_logs = raw_logs.decode("utf-8", errors="replace")
        except Exception:
            pass

        # Smart diagnostics & security audit
        diagnostics = analyze_container_failure(attrs, recent_logs)
        security_audit = audit_container_security(attrs)

        # Generate copyable docker run command
        docker_run_cmd = container_to_docker_run(attrs)

        return {
            "summary": summary,
            "attrs": attrs,
            "diagnostics": diagnostics,
            "security": security_audit,
            "docker_run_cmd": docker_run_cmd
        }
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_container(payload: Dict[str, Any] = Body(...)):
    """
    Create and optionally start a new container with full parameter specifications.
    Payload supports: name, image, command, ports, volumes, env, restart_policy, memory_limit_mb, cpus, network
    """
    client = get_client()
    image = payload.get("image")
    name = payload.get("name")
    if not image:
        raise HTTPException(status_code=400, detail="Image is required")

    # Pre-flight: Check image availability or pull
    try:
        try:
            client.images.get(image)
        except NotFound:
            logger.info(f"Image {image} not found locally, pulling...")
            client.images.pull(image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to obtain image {image}: {e}")

    # Build Port bindings
    ports_dict = {}
    port_mappings = payload.get("ports") or []
    for pm in port_mappings:
        c_port = pm.get("container_port")
        h_port = pm.get("host_port")
        if c_port and h_port:
            h_port_int = int(h_port)
            # Port collision check
            available, reason = check_host_port_available(h_port_int)
            if not available:
                raise HTTPException(status_code=409, detail=reason)
            ports_dict[f"{c_port}/tcp"] = h_port_int

    # Build Volumes / Binds
    volumes_dict = {}
    volume_mappings = payload.get("volumes") or []
    for vm in volume_mappings:
        h_path = vm.get("host_path")
        c_path = vm.get("container_path")
        mode = vm.get("mode", "rw")
        if h_path and c_path:
            volumes_dict[h_path] = {"bind": c_path, "mode": mode}

    # Build Env variables
    env_vars = payload.get("env") or {}
    if isinstance(env_vars, list):
        env_dict = {item.get("key"): item.get("value") for item in env_vars if item.get("key")}
    else:
        env_dict = env_vars

    # Restart Policy
    restart_policy_name = payload.get("restart_policy", "unless-stopped")
    restart_policy = {"Name": restart_policy_name}

    # Resource Limits
    mem_mb = payload.get("memory_limit_mb")
    mem_limit = f"{mem_mb}m" if mem_mb and int(mem_mb) > 0 else None

    cpus = payload.get("cpus")
    nano_cpus = int(float(cpus) * 1e9) if cpus and float(cpus) > 0 else None

    try:
        container = client.containers.create(
            image=image,
            name=name if name else None,
            command=payload.get("command") or None,
            ports=ports_dict,
            volumes=volumes_dict,
            environment=env_dict,
            restart_policy=restart_policy,
            mem_limit=mem_limit,
            nano_cpus=nano_cpus,
            network=payload.get("network") or None,
            privileged=payload.get("privileged", False)
        )

        auto_start = payload.get("start", True)
        if auto_start:
            container.start()

        log_event(
            event_type="container_create",
            target_type="container",
            target_id=container.id[:12],
            target_name=container.name,
            details={"image": image, "started": auto_start}
        )

        return {
            "success": True,
            "container_id": container.id[:12],
            "name": container.name,
            "status": "running" if auto_start else "created"
        }
    except Exception as e:
        logger.error(f"Container creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{container_id}/action")
def perform_container_action(container_id: str, action: str = Query(...)):
    """Execute lifecycle action: start, stop, restart, pause, unpause, kill, remove."""
    client = get_client()
    try:
        c = client.containers.get(container_id)
        name = c.name

        if action == "start":
            c.start()
        elif action == "stop":
            c.stop(timeout=10)
        elif action == "restart":
            c.restart(timeout=10)
        elif action == "pause":
            c.pause()
        elif action == "unpause":
            c.unpause()
        elif action == "kill":
            c.kill()
        elif action == "remove":
            c.remove(force=True)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")

        log_event(
            event_type=f"container_{action}",
            target_type="container",
            target_id=container_id[:12],
            target_name=name,
            details={"action": action}
        )

        return {"success": True, "action": action, "container_id": container_id}
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
        logger.error(f"Action '{action}' failed on container {container_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{container_id}/recreate")
def edit_and_recreate_container(container_id: str, payload: Dict[str, Any] = Body(...)):
    """
    Portainer's core feature: Edit & Recreate (Smart Clone/Upgrade).
    Clones configuration, applies modifications, stops & removes old container,
    and starts the updated container while preserving persistent volumes.
    """
    client = get_client()
    try:
        old_c = client.containers.get(container_id)
        old_name = old_c.name
        old_attrs = old_c.attrs

        # 1. Extract base configuration from existing container
        config = old_attrs.get("Config", {})
        host_config = old_attrs.get("HostConfig", {})
        net_settings = old_attrs.get("NetworkSettings", {})

        # 2. Determine new values (override from payload if provided)
        new_image = payload.get("image") or config.get("Image")
        new_name = payload.get("name") or old_name
        new_cmd = payload.get("command") or config.get("Cmd")
        new_privileged = payload.get("privileged", host_config.get("Privileged", False))

        # Preserve / update Environment
        existing_env_list = config.get("Env") or []
        env_dict = {}
        for e in existing_env_list:
            if "=" in e:
                k, v = e.split("=", 1)
                env_dict[k] = v
        if "env" in payload:
            override_env = payload["env"]
            if isinstance(override_env, list):
                for item in override_env:
                    if item.get("key"):
                        env_dict[item["key"]] = item.get("value", "")
            elif isinstance(override_env, dict):
                env_dict.update(override_env)

        # Preserve / update Ports
        ports_dict = {}
        if "ports" in payload:
            for pm in payload["ports"]:
                c_p = pm.get("container_port")
                h_p = pm.get("host_port")
                if c_p and h_p:
                    ports_dict[f"{c_p}/tcp"] = int(h_p)
        else:
            port_bindings = host_config.get("PortBindings") or {}
            for c_port, bindings in port_bindings.items():
                if bindings:
                    h_port = bindings[0].get("HostPort")
                    if h_port:
                        ports_dict[c_port] = int(h_port)

        # Preserve / update Volumes & Binds
        volumes_dict = {}
        if "volumes" in payload:
            for vm in payload["volumes"]:
                h_p = vm.get("host_path")
                c_p = vm.get("container_path")
                mode = vm.get("mode", "rw")
                if h_p and c_p:
                    volumes_dict[h_p] = {"bind": c_p, "mode": mode}
        else:
            binds = host_config.get("Binds") or []
            for b in binds:
                parts = b.split(":")
                if len(parts) >= 2:
                    mode = parts[2] if len(parts) > 2 else "rw"
                    volumes_dict[parts[0]] = {"bind": parts[1], "mode": mode}

        # Restart Policy
        restart_policy = host_config.get("RestartPolicy") or {"Name": "unless-stopped"}
        if "restart_policy" in payload:
            restart_policy = {"Name": payload["restart_policy"]}

        # Pull updated image if specified
        if payload.get("pull_image", False) or new_image != config.get("Image"):
            try:
                logger.info(f"Pulling updated image {new_image} for recreate...")
                client.images.pull(new_image)
            except Exception as pe:
                logger.warning(f"Could not pull {new_image}: {pe}")

        # 3. Stop and Remove old container
        logger.info(f"Stopping old container {old_name} for recreation...")
        try:
            old_c.stop(timeout=10)
        except Exception:
            pass
        old_c.remove(force=True)

        # 4. Launch new container with preserved & updated configuration
        new_c = client.containers.create(
            image=new_image,
            name=new_name,
            command=new_cmd,
            ports=ports_dict,
            volumes=volumes_dict,
            environment=env_dict,
            restart_policy=restart_policy,
            privileged=new_privileged
        )
        new_c.start()

        log_event(
            event_type="container_recreate",
            target_type="container",
            target_id=new_c.id[:12],
            target_name=new_name,
            details={"previous_id": container_id[:12], "image": new_image}
        )

        return {
            "success": True,
            "container_id": new_c.id[:12],
            "name": new_name,
            "status": "running"
        }
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
        logger.error(f"Recreate failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{container_id}/top")
def get_container_top(container_id: str):
    """Inspect live processes running inside container (LazyDocker top feature)."""
    try:
        client = get_client()
        c = client.containers.get(container_id)
        if c.status != "running":
            return {"processes": [], "titles": [], "message": "Container is not running"}
        top_data = c.top()
        return {
            "titles": top_data.get("Titles", []),
            "processes": top_data.get("Processes", [])
        }
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
