"""Smart Crash-Loop and Container Failure Diagnostician."""
import re
from typing import Any, Dict, List, Optional

FAILURE_PATTERNS = [
    {
        "pattern": r"(bind: address already in use|port is already allocated|listen tcp .*: bind: address already in use)",
        "title": "Port Collision Detected",
        "root_cause": "The container tried to bind to a network port that is already in use by another container or host process.",
        "suggested_fix": "Change the host port mapping to an unused port in Edit & Recreate (e.g. map host port 8081 instead of 80).",
        "remediation_action": "change_port",
        "severity": "critical"
    },
    {
        "pattern": r"(POSTGRES_PASSWORD must be set|database .* requires a password|specify one of POSTGRES_PASSWORD|POSTGRES_EMPTY_PASSWORD)",
        "title": "Missing Required Database Password",
        "root_cause": "PostgreSQL container requires POSTGRES_PASSWORD or POSTGRES_HOST_AUTH_METHOD environment variable to initialize.",
        "suggested_fix": "Add environment variable 'POSTGRES_PASSWORD=your_secure_password' in Edit & Recreate.",
        "remediation_action": "edit_env",
        "severity": "critical"
    },
    {
        "pattern": r"(MYSQL_ROOT_PASSWORD.*is not set|No password option specified for new database)",
        "title": "Missing Required MySQL Password",
        "root_cause": "MySQL / MariaDB container requires MYSQL_ROOT_PASSWORD or MYSQL_ALLOW_EMPTY_PASSWORD to start.",
        "suggested_fix": "Add environment variable 'MYSQL_ROOT_PASSWORD=your_secure_password' in Edit & Recreate.",
        "remediation_action": "edit_env",
        "severity": "critical"
    },
    {
        "pattern": r"(JavaScript heap out of memory|fatal error: runtime: out of memory|fatal error: cannot allocate memory)",
        "title": "Application Heap Out of Memory",
        "root_cause": "The application runtime exceeded its internal memory heap limit.",
        "suggested_fix": "Increase container memory limit or configure runtime heap options (e.g. NODE_OPTIONS='--max-old-space-size=4096').",
        "remediation_action": "increase_memory",
        "severity": "critical"
    },
    {
        "pattern": r"(permission denied|EACCES|Operation not permitted)",
        "title": "File System Permission Denied",
        "root_cause": "The container process does not have permission to access the mounted host path or internal file.",
        "suggested_fix": "Verify permissions on the mounted host directory (e.g. chown -R 1000:1000 /path) or adjust the container user.",
        "remediation_action": "fix_permissions",
        "severity": "warning"
    },
    {
        "pattern": r"(connection refused|dial tcp.*connect: connection refused)",
        "title": "Upstream Dependency Unreachable",
        "root_cause": "Container is attempting to connect to a database or service that is not yet ready or on a different network.",
        "suggested_fix": "Verify that the dependent container is running, attached to the same Docker network, and healthy.",
        "remediation_action": "check_network",
        "severity": "warning"
    }
]

def analyze_container_failure(container_attrs: Dict[str, Any], recent_logs: str = "") -> Optional[Dict[str, Any]]:
    """Inspect container state and logs to determine root-cause of failure."""
    state = container_attrs.get("State", {})
    status = state.get("Status", "")
    exit_code = state.get("ExitCode", 0)
    oom_killed = state.get("OOMKilled", False)
    daemon_error = state.get("Error", "")
    
    # If container is healthy and running, no failure to diagnose
    if status == "running" and not oom_killed and not daemon_error:
        return None

    # Check 1: Kernel OOM Killed (Exit Code 137 + OOMKilled flag)
    if oom_killed or exit_code == 137:
        # Check if logs also contain heap messages
        is_heap = bool(re.search(r"heap out of memory|out of memory", recent_logs, re.IGNORECASE))
        return {
            "title": "Out of Memory (OOMKilled)",
            "severity": "critical",
            "exit_code": exit_code,
            "oom_killed": True,
            "root_cause": "The container was forcefully terminated by the Linux Kernel OOM killer because it exceeded its allocated memory limit.",
            "suggested_fix": "Increase container memory limit in Edit & Recreate (e.g. double from current limit) or optimize container process.",
            "remediation_action": "increase_memory",
            "evidence": recent_logs[-300:] if recent_logs else "Kernel OOM event recorded in container state."
        }

    # Check 2: Command not found (Exit Code 127)
    if exit_code == 127:
        cmd = container_attrs.get("Config", {}).get("Cmd")
        return {
            "title": "Executable Command Not Found (Exit 127)",
            "severity": "critical",
            "exit_code": 127,
            "oom_killed": False,
            "root_cause": f"The entrypoint or command '{cmd}' does not exist inside this image.",
            "suggested_fix": "Ensure the command exists in the container (e.g. Alpine images use '/bin/sh', not '/bin/bash').",
            "remediation_action": "fix_cmd",
            "evidence": recent_logs[-300:] if recent_logs else f"Cmd: {cmd}"
        }

    # Check 3: Command cannot be invoked / permission denied (Exit Code 126)
    if exit_code == 126:
        return {
            "title": "Command Cannot Be Executed (Exit 126)",
            "severity": "critical",
            "exit_code": 126,
            "oom_killed": False,
            "root_cause": "The container executable file was found but lacks executable permissions (+x).",
            "suggested_fix": "Ensure your entrypoint script has executable permissions (chmod +x entrypoint.sh) before building the image.",
            "remediation_action": "fix_permissions",
            "evidence": recent_logs[-300:] if recent_logs else "Exit code 126 returned."
        }

    # Check 4: Daemon start error (e.g. port conflict or missing mount on host)
    if daemon_error:
        for p in FAILURE_PATTERNS:
            if re.search(p["pattern"], daemon_error, re.IGNORECASE):
                return {
                    "title": p["title"],
                    "severity": p["severity"],
                    "exit_code": exit_code,
                    "oom_killed": False,
                    "root_cause": p["root_cause"],
                    "suggested_fix": p["suggested_fix"],
                    "remediation_action": p["remediation_action"],
                    "evidence": daemon_error
                }
        return {
            "title": "Docker Engine Start Error",
            "severity": "critical",
            "exit_code": exit_code,
            "oom_killed": False,
            "root_cause": daemon_error,
            "suggested_fix": "Inspect host mounts, network configuration, or runtime parameters.",
            "remediation_action": "inspect_config",
            "evidence": daemon_error
        }

    # Check 5: Log pattern scanning for Exit Code 1 or exited status
    if recent_logs:
        for p in FAILURE_PATTERNS:
            match = re.search(p["pattern"], recent_logs, re.IGNORECASE)
            if match:
                matched_line = match.group(0)
                return {
                    "title": p["title"],
                    "severity": p["severity"],
                    "exit_code": exit_code,
                    "oom_killed": False,
                    "root_cause": p["root_cause"],
                    "suggested_fix": p["suggested_fix"],
                    "remediation_action": p["remediation_action"],
                    "evidence": matched_line
                }

    # Fallback for unexpected exit code
    if exit_code != 0:
        return {
            "title": f"Process Exited with Code {exit_code}",
            "severity": "warning",
            "exit_code": exit_code,
            "oom_killed": False,
            "root_cause": f"Application terminated with non-zero exit code {exit_code}.",
            "suggested_fix": "Review container logs or launch an interactive terminal to inspect runtime environment.",
            "remediation_action": "view_logs",
            "evidence": recent_logs[-300:] if recent_logs else f"ExitCode: {exit_code}"
        }

    return None
