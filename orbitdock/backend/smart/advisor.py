"""Smart Resource Optimization, Memory Leak Detection, and Port Collision Advisor."""
import socket
from typing import Any, Dict, List, Optional, Tuple
from orbitdock.backend.core.docker_engine import get_client

def check_host_port_available(port: int, host: str = "0.0.0.0") -> Tuple[bool, Optional[str]]:
    """Test if a host TCP port is available for binding."""
    if not (1 <= port <= 65535):
        return False, f"Invalid port number: {port}"
        
    # Check 1: Check active Docker containers port bindings
    try:
        client = get_client()
        containers = client.containers.list(all=False)
        for c in containers:
            ports = c.attrs.get("NetworkSettings", {}).get("Ports") or {}
            for c_port, bindings in ports.items():
                if bindings:
                    for b in bindings:
                        if b.get("HostPort") == str(port):
                            return False, f"Port {port} is already mapped by container '{c.name}'"
    except Exception:
        pass

    # Check 2: Test local socket binding
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((host, port))
        sock.close()
        return True, None
    except OSError as e:
        return False, f"Port {port} is already in use by host process ({e.strerror})"

def detect_memory_leak(samples: List[Tuple[float, float]]) -> Dict[str, Any]:
    """
    Analyze time-series (timestamp, mem_bytes) to detect runaway memory leak.
    Requires at least 6 samples. Calculates linear trend slope.
    """
    if len(samples) < 6:
        return {"has_leak": False, "confidence": 0, "reason": "Insufficient samples"}

    n = len(samples)
    x = [s[0] - samples[0][0] for s in samples]  # relative time in seconds
    y = [s[1] / (1024 * 1024) for s in samples]  # memory in MB

    mean_x = sum(x) / n
    mean_y = sum(y) / n

    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    denominator = sum((x[i] - mean_x) ** 2 for i in range(n))

    if denominator == 0:
        return {"has_leak": False, "confidence": 0, "reason": "Zero time variance"}

    slope = numerator / denominator  # MB per second

    # Memory growth percentage from start to finish
    initial_mem = y[0] if y[0] > 0 else 1.0
    final_mem = y[-1]
    growth_ratio = (final_mem - initial_mem) / initial_mem

    # Count upward vs downward steps
    upward_steps = sum(1 for i in range(1, n) if y[i] > y[i-1])
    monotonicity = upward_steps / (n - 1)

    # Flag leak if slope > 0.05 MB/sec (or 3MB/min) and growth > 25% with high monotonicity
    if slope > 0.02 and growth_ratio > 0.25 and monotonicity > 0.75:
        confidence = min(95, int(monotonicity * 100))
        return {
            "has_leak": True,
            "confidence": confidence,
            "slope_mb_per_min": round(slope * 60, 2),
            "initial_mb": round(initial_mem, 1),
            "current_mb": round(final_mem, 1),
            "growth_percent": round(growth_ratio * 100, 1),
            "recommendation": "Memory usage shows steady monotonic growth without garbage collection reclamation. Investigate process heap."
        }

    return {"has_leak": False, "confidence": 0, "growth_percent": round(growth_ratio * 100, 1)}

def evaluate_resource_optimization(peak_mem_mb: float, allocated_limit_mb: float) -> Optional[Dict[str, Any]]:
    """Recommend right-sizing for container memory limits."""
    if allocated_limit_mb <= 0:
        return {
            "type": "no_limit",
            "message": "Container has no memory limit set; a memory leak could destabilize host OS.",
            "suggested_limit_mb": int(max(256, peak_mem_mb * 1.5))
        }

    ratio = peak_mem_mb / allocated_limit_mb
    if ratio < 0.15 and allocated_limit_mb > 512:
        # Over-provisioned
        suggested = int(max(256, peak_mem_mb * 2.0))
        return {
            "type": "over_provisioned",
            "message": f"Over-provisioned: Peak usage is {peak_mem_mb:.0f} MB ({ratio*100:.1f}% of {allocated_limit_mb:.0f} MB).",
            "suggested_limit_mb": suggested
        }
    elif ratio > 0.88:
        # Near limit, risk of OOM
        return {
            "type": "near_limit",
            "message": f"Risk of OOMKill: Peak usage is {peak_mem_mb:.0f} MB ({ratio*100:.1f}% of {allocated_limit_mb:.0f} MB limit).",
            "suggested_limit_mb": int(allocated_limit_mb * 1.5)
        }

    return None
