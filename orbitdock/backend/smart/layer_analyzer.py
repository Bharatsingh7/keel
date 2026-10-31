"""Image Layer Efficiency and Wasted Space Analyzer (Dive algorithm)."""
import re
from typing import Any, Dict, List
from orbitdock.backend.core.docker_engine import get_api_client, get_client

WASTED_PATTERNS = [
    {
        "pattern": r"apt-get update(?![^;]*rm -rf /var/lib/apt/lists)",
        "issue": "Uncleaned apt package lists left in layer",
        "estimate_wasted_mb": 25.0
    },
    {
        "pattern": r"npm install(?![^;]*npm cache clean)",
        "issue": "NPM cache left behind in layer",
        "estimate_wasted_mb": 40.0
    },
    {
        "pattern": r"pip install(?![^;]*--no-cache-dir)",
        "issue": "Pip cache stored in image layer",
        "estimate_wasted_mb": 30.0
    },
    {
        "pattern": r"apk update(?![^;]*rm -rf /var/cache/apk)",
        "issue": "Alpine apk cache stored in image layer",
        "estimate_wasted_mb": 10.0
    }
]

def analyze_image_layers(image_id: str) -> Dict[str, Any]:
    """Inspect image layers, calculate sizes, detect bloat, and calculate efficiency score."""
    api = get_api_client()
    client = get_client()

    try:
        img = client.images.get(image_id)
        history = api.history(img.id)
    except Exception as e:
        return {"error": str(e), "layers": [], "efficiency_score": 0}

    total_size = img.attrs.get("Size", 0)
    layers = []
    wasted_bytes = 0
    findings = []

    for idx, h in enumerate(reversed(history)):
        size = h.get("Size", 0)
        cmd = h.get("CreatedBy", "")
        layer_id = h.get("Id", "")[:12] if h.get("Id") else f"<layer-{idx}>"

        # Check for common waste patterns
        layer_issues = []
        for wp in WASTED_PATTERNS:
            if re.search(wp["pattern"], cmd, re.IGNORECASE):
                layer_issues.append(wp["issue"])
                wasted_bytes += int(wp["estimate_wasted_mb"] * 1024 * 1024)
                findings.append({
                    "layer": idx + 1,
                    "issue": wp["issue"],
                    "command": cmd[:80]
                })

        layers.append({
            "step": idx + 1,
            "layer_id": layer_id,
            "size_bytes": size,
            "size_mb": round(size / (1024 * 1024), 2),
            "command": cmd,
            "issues": layer_issues
        })

    # Reverse back so topmost layer is at top of UI
    layers.reverse()

    # Efficiency calculation
    if total_size > 0:
        clean_bytes = max(0, total_size - min(total_size, wasted_bytes))
        efficiency_score = round((clean_bytes / total_size) * 100.0, 1)
    else:
        efficiency_score = 100.0

    return {
        "image_id": img.id[:19],
        "tags": img.tags,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "total_layers": len(layers),
        "efficiency_score": efficiency_score,
        "estimated_wasted_mb": round(wasted_bytes / (1024 * 1024), 2),
        "findings": findings,
        "layers": layers
    }
