# Keel ⚓
> *Formerly OrbitDock*

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-Engine%20v24+-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

**Next-Generation Intelligent Docker & Container Platform.**  
*Smarter, lighter, and more beautiful than Portainer. Crafted with Apple macOS frosted glassmorphism & Samsung OneUI ergonomics.*

[✨ Highlights](#-core-capabilities) • [🚀 Quickstart](#-quickstart) • [🧠 Smart Engine](#-intelligent-algorithms) • [🎨 Design](#-design-system) • [🧪 Testing](#-verification)

</div>

---

## 🌟 Overview

**Keel** (formerly OrbitDock) is a modern, lightweight, single-binary container management platform designed to replace heavy, cluttered web dashboards. It bridges the gap between terminal power tools (`lazydocker`, `dive`, `dockge`) and full web UIs (`portainer`), providing real-time diagnostics, live telemetry, security scoring, and seamless compose orchestration.

---

## ✨ Core Capabilities

* 🪟 **Apple macOS Acrylic Glassmorphism**: Translucent frosted glass surfaces (`backdrop-filter: blur(24px)`), fluid physics transitions, and crisp SF typography.
* 📱 **Samsung OneUI Ergonomics**: Top focus header, circular SVG telemetry gauges, and a floating bottom Action Dock for instant batch lifecycle commands.
* 🩺 **Self-Healing Diagnostician**: Real-time log pattern matching for container crashes, OOMKilled (exit code 137), port conflicts, missing environment variables, and stale containerd snapshot layers.
* 🛡️ **CIS Security Auditor**: Automated 100-point security grading (A through F) inspecting privileged flags, root user processes, capability drops, and sensitive host path mounts.
* 📦 **Bi-Directional Compose & Dockge Stacks**: Edit multi-container stacks stored as clean YAML files on disk (`~/.orbitdock/stacks/`), with instant 1-click `docker run` ⇄ `docker-compose.yml` translation.
* 🌊 **Live Telemetry Canvas**: Real-time streaming CPU and memory resource waveforms, per-container SVG sparklines, and unified Dozzle-style streaming logs.
* 🔬 **Image Layer Efficiency (Dive Score)**: Inspect Docker image layers, detect wasted cache lines, and check remote registries for upstream version updates.

---

## 🚀 Quickstart

### Option 1: Instant Launch with `uv` (Recommended)

```bash
cd ~/Projects/orbitdock
uv run python -m orbitdock.main --port 9090
```

Open your browser at **[http://localhost:9090](http://localhost:9090)**.

### Option 2: Docker Container

```bash
docker run -d \
  --name keel \
  --restart unless-stopped \
  -p 9090:9090 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.orbitdock:/root/.orbitdock \
  keel:latest
```

### Option 3: Docker Compose

```yaml
services:
  keel:
    image: keel:latest
    container_name: keel
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ~/.orbitdock:/root/.orbitdock
```

---

## 🧠 Intelligent Algorithms

Keel incorporates the proven architectural strengths of the open-source container ecosystem into one unified interface:

| Engine | Implementation | Benefit |
|---|---|---|
| **Dockge Core** | File-backed `compose.yaml` stacks in `~/.orbitdock/stacks/` | Zero proprietary database lock-in; edit in terminal or browser. |
| **Dozzle Engine** | WebSocket multi-container log multiplexer | Filter, search, and correlate logs across microservices in real time. |
| **LazyDocker Inspector** | Top process tree + PID mapping | Inspect live CPU% and thread counts directly inside containers. |
| **Dive Analyzer** | Layer-by-layer image efficiency calculation | Identify bloated image layers and compute overall space efficiency (0–100%). |
| **Watchtower Sentinel** | Remote registry digest comparison | Automatically notify when upstream base images publish security updates. |
| **Autoheal Guardian** | Health check loop with exponential backoff | Automatically restart degraded containers safely without cascade loops. |

---

## 🎨 Design System

* **OLED Dark & Sonoma Light Modes**: Seamless switching between deep obsidian glass and crisp light paper themes.
* **Micro-Sparklines**: Miniature SVG activity graphs embedded directly inside container cards.
* **Instant Action Dock**: Fast batch actions (Start, Stop, Restart, Pause, Prune) that follow your scroll position.
* **Terminal Quick-Run**: Slide-out interactive command palette to execute shell commands directly inside any running container.

---

## 🧪 Verification

Keel includes a comprehensive test suite covering API routes, stack synthesis, diagnostics, and security auditing:

```bash
uv run python3 -m unittest discover tests
```

*Status: 22 tests passing.*

---

## 📄 License

MIT License. Designed and built by [Bharat Singh](https://github.com/Bharatsingh7).
