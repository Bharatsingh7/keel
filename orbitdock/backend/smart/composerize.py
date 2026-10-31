"""Bi-directional converter: docker run command <-> Docker Compose YAML (Dockge / Composerize algorithm)."""
import shlex
import yaml
from typing import Any, Dict, List, Optional, Tuple

def docker_run_to_compose(cmd: str) -> Dict[str, Any]:
    """Parse a `docker run ...` command string into a valid Docker Compose dictionary."""
    # Clean string and tokenize
    raw = cmd.strip()
    if raw.startswith("$"):
        raw = raw[1:].strip()
    # Normalize multiline backslashes
    raw = raw.replace("\\\n", " ").replace("\\\r\n", " ")
    
    tokens = shlex.split(raw)
    
    # Strip leading 'docker' and 'run'
    if tokens and tokens[0] == "docker":
        tokens = tokens[1:]
    if tokens and tokens[0] == "run":
        tokens = tokens[1:]
        
    service: Dict[str, Any] = {}
    ports: List[str] = []
    volumes: List[str] = []
    environment: Dict[str, str] = {}
    labels: Dict[str, str] = {}
    extra_hosts: List[str] = []
    cmd_args: List[str] = []
    service_name = "app"
    image_name = None
    
    i = 0
    n = len(tokens)
    while i < n:
        token = tokens[i]

        # If image has already been determined, all subsequent tokens are command arguments
        if image_name is not None:
            cmd_args.append(token)
            i += 1
            continue
        
        # Check flags with arguments
        if token in ("-p", "--publish"):
            if i + 1 < n:
                ports.append(tokens[i + 1])
                i += 2
                continue
        elif token.startswith("-p=") or token.startswith("--publish="):
            ports.append(token.split("=", 1)[1])
            i += 1
            continue
            
        elif token in ("-v", "--volume"):
            if i + 1 < n:
                volumes.append(tokens[i + 1])
                i += 2
                continue
        elif token.startswith("-v=") or token.startswith("--volume="):
            volumes.append(token.split("=", 1)[1])
            i += 1
            continue
            
        elif token in ("-e", "--env"):
            if i + 1 < n:
                env_str = tokens[i + 1]
                if "=" in env_str:
                    k, v = env_str.split("=", 1)
                    environment[k] = v
                else:
                    environment[env_str] = ""
                i += 2
                continue
        elif token.startswith("-e=") or token.startswith("--env="):
            env_str = token.split("=", 1)[1]
            if "=" in env_str:
                k, v = env_str.split("=", 1)
                environment[k] = v
            else:
                environment[env_str] = ""
            i += 1
            continue
            
        elif token in ("--name",):
            if i + 1 < n:
                name_val = tokens[i + 1]
                service["container_name"] = name_val
                # Clean service key
                service_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name_val)
                i += 2
                continue
        elif token.startswith("--name="):
            name_val = token.split("=", 1)[1]
            service["container_name"] = name_val
            service_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name_val)
            i += 1
            continue
            
        elif token in ("--restart",):
            if i + 1 < n:
                service["restart"] = tokens[i + 1]
                i += 2
                continue
        elif token.startswith("--restart="):
            service["restart"] = token.split("=", 1)[1]
            i += 1
            continue

        elif token in ("--network", "--net"):
            if i + 1 < n:
                service["network_mode"] = tokens[i + 1]
                i += 2
                continue
        elif token.startswith("--network=") or token.startswith("--net="):
            service["network_mode"] = token.split("=", 1)[1]
            i += 1
            continue

        elif token in ("-m", "--memory"):
            if i + 1 < n:
                service.setdefault("deploy", {}).setdefault("resources", {}).setdefault("limits", {})["memory"] = tokens[i + 1]
                i += 2
                continue

        elif token in ("--cpus",):
            if i + 1 < n:
                service.setdefault("deploy", {}).setdefault("resources", {}).setdefault("limits", {})["cpus"] = tokens[i + 1]
                i += 2
                continue

        elif token in ("--privileged",):
            service["privileged"] = True
            i += 1
            continue

        elif token in ("-u", "--user"):
            if i + 1 < n:
                service["user"] = tokens[i + 1]
                i += 2
                continue

        elif token in ("-w", "--workdir"):
            if i + 1 < n:
                service["working_dir"] = tokens[i + 1]
                i += 2
                continue

        elif token in ("--entrypoint",):
            if i + 1 < n:
                service["entrypoint"] = tokens[i + 1]
                i += 2
                continue

        elif token in ("-l", "--label"):
            if i + 1 < n:
                lbl = tokens[i + 1]
                if "=" in lbl:
                    k, v = lbl.split("=", 1)
                    labels[k] = v
                else:
                    labels[lbl] = ""
                i += 2
                continue

        # Skip standalone flags that aren't needed in compose
        elif token in ("-d", "--detach", "--rm", "-it", "-i", "-t"):
            i += 1
            continue

        elif token.startswith("-"):
            # Unknown flag with or without arg, skip safely
            i += 1
            continue

        else:
            # Positional arguments: first is image, rest are command args
            if image_name is None:
                image_name = token
            else:
                cmd_args.append(token)
            i += 1

    if not image_name:
        raise ValueError("Could not parse image name from docker run command.")

    service["image"] = image_name

    if ports:
        service["ports"] = ports
    if volumes:
        service["volumes"] = volumes
    if environment:
        service["environment"] = environment
    if labels:
        service["labels"] = labels
    if cmd_args:
        service["command"] = " ".join(cmd_args)

    compose_dict = {
        "services": {
            service_name: service
        }
    }

    yaml_str = yaml.dump(compose_dict, sort_keys=False, default_flow_style=False)
    return {
        "service_name": service_name,
        "image": image_name,
        "service": service,
        "compose_dict": compose_dict,
        "compose_yaml": yaml_str
    }

def container_to_docker_run(container_attrs: Dict[str, Any]) -> str:
    """Generate a clean `docker run` command string from container inspect attributes."""
    config = container_attrs.get("Config", {})
    host_config = container_attrs.get("HostConfig", {})
    net_settings = container_attrs.get("NetworkSettings", {})
    name = container_attrs.get("Name", "").lstrip("/")

    parts = ["docker", "run", "-d"]

    if name:
        parts.extend(["--name", name])

    # Restart policy
    restart_policy = host_config.get("RestartPolicy", {}).get("Name")
    if restart_policy and restart_policy != "no":
        max_retry = host_config.get("RestartPolicy", {}).get("MaximumRetryCount", 0)
        if max_retry > 0 and restart_policy == "on-failure":
            parts.extend(["--restart", f"on-failure:{max_retry}"])
        else:
            parts.extend(["--restart", restart_policy])

    # Ports
    port_bindings = host_config.get("PortBindings") or {}
    for c_port, bindings in port_bindings.items():
        if bindings:
            for b in bindings:
                h_ip = b.get("HostIp")
                h_port = b.get("HostPort")
                if h_ip and h_ip != "0.0.0.0":
                    parts.extend(["-p", f"{h_ip}:{h_port}:{c_port}"])
                elif h_port:
                    parts.extend(["-p", f"{h_port}:{c_port}"])
                else:
                    parts.extend(["-p", c_port])

    # Binds & Volumes
    binds = host_config.get("Binds") or []
    for b in binds:
        parts.extend(["-v", b])

    # Env vars
    env_list = config.get("Env") or []
    for e in env_list:
        # Filter internal PATH or standard docker defaults
        if not e.startswith("PATH="):
            parts.extend(["-e", e])

    # Network mode
    net_mode = host_config.get("NetworkMode")
    if net_mode and net_mode not in ("default", "bridge"):
        parts.extend(["--network", net_mode])

    # Privileged
    if host_config.get("Privileged"):
        parts.append("--privileged")

    # Image
    image = config.get("Image", "")
    parts.append(image)

    # Command override
    cmd = config.get("Cmd")
    if cmd:
        parts.extend(cmd)

    return " ".join(shlex.quote(p) if " " in p or "=" in p or ":" in p else p for p in parts)
