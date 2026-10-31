"""CIS-aligned Container Security Posture Auditor."""
from typing import Any, Dict, List

def audit_container_security(container_attrs: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate a 100-point security posture score and actionable findings."""
    config = container_attrs.get("Config", {})
    host_config = container_attrs.get("HostConfig", {})
    
    score = 100
    findings: List[Dict[str, Any]] = []

    # 1. Privileged Mode check (CIS 5.4)
    if host_config.get("Privileged", False):
        score -= 35
        findings.append({
            "id": "cis_privileged",
            "severity": "critical",
            "title": "Privileged Container Mode Enabled",
            "description": "Container runs with full root capabilities to the host kernel, bypassing container isolation boundaries.",
            "remediation": "Disable privileged mode unless absolutely required for low-level kernel driver access."
        })

    # 2. Root User check (CIS 4.1)
    user = config.get("User", "")
    if not user or user == "0" or user == "root":
        score -= 20
        findings.append({
            "id": "cis_root_user",
            "severity": "high",
            "title": "Running as Root User",
            "description": "Container executes as UID 0 (root), increasing impact if container process is compromised.",
            "remediation": "Specify a non-root user via 'user: 1000:1000' in Compose or '--user' flag."
        })

    # 3. Sensitive Host Socket / Directory Mounts (CIS 5.12)
    binds = host_config.get("Binds") or []
    has_docker_sock = any("/docker.sock" in b for b in binds)
    has_root_mount = any(b.startswith("/:") or b.startswith("/etc:") or b.startswith("/proc:") for b in binds)
    
    if has_docker_sock:
        score -= 25
        findings.append({
            "id": "cis_docker_sock",
            "severity": "critical",
            "title": "Docker Socket Mounted Inside Container",
            "description": "/var/run/docker.sock mount provides direct API access to control the host Docker daemon.",
            "remediation": "Avoid mounting docker.sock into untrusted or public-facing containers, or use an API proxy."
        })
    if has_root_mount:
        score -= 20
        findings.append({
            "id": "cis_root_mount",
            "severity": "critical",
            "title": "Sensitive Host Filesystem Mount",
            "description": "Host root, /etc, or /proc is mounted directly into the container.",
            "remediation": "Restrict volume mounts strictly to dedicated data subdirectories."
        })

    # 4. Host Network Mode (CIS 5.9)
    net_mode = host_config.get("NetworkMode", "")
    if net_mode == "host":
        score -= 15
        findings.append({
            "id": "cis_host_net",
            "severity": "medium",
            "title": "Host Network Sharing Active",
            "description": "Container shares the host network stack, bypassing network namespace isolation.",
            "remediation": "Use Docker bridge or user-defined overlay networks instead of host network mode."
        })

    # 5. Dangerous Linux Capabilities (CIS 5.3)
    cap_add = host_config.get("CapAdd") or []
    if "ALL" in cap_add or "SYS_ADMIN" in cap_add:
        score -= 20
        findings.append({
            "id": "cis_cap_add",
            "severity": "high",
            "title": "Dangerous Linux Capabilities Added",
            "description": f"Container requested elevated kernel capabilities: {', '.join(cap_add)}.",
            "remediation": "Remove unnecessary capabilities or drop all and add only explicitly required ones."
        })

    # 6. Read-Only Root Filesystem (CIS 5.14)
    read_only_root = host_config.get("ReadonlyRootfs", False)
    if not read_only_root:
        # Minor deduction for mutable rootfs
        score -= 5
        findings.append({
            "id": "cis_writable_root",
            "severity": "low",
            "title": "Root Filesystem is Writable",
            "description": "Container root filesystem is writable, allowing attackers to overwrite binaries or persist malware.",
            "remediation": "Mount root filesystem as read-only ('read_only: true') and use temporary tmpfs for scratch files."
        })

    # Clamp score 0 - 100
    score = max(0, min(100, score))

    if score >= 85:
        grade = "A"
        badge_color = "emerald"
    elif score >= 70:
        grade = "B"
        badge_color = "blue"
    elif score >= 55:
        grade = "C"
        badge_color = "amber"
    elif score >= 40:
        grade = "D"
        badge_color = "orange"
    else:
        grade = "F"
        badge_color = "red"

    return {
        "score": score,
        "grade": grade,
        "badge_color": badge_color,
        "findings_count": len(findings),
        "critical_count": sum(1 for f in findings if f["severity"] == "critical"),
        "high_count": sum(1 for f in findings if f["severity"] == "high"),
        "findings": findings
    }
