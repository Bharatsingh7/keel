# OrbitDock 🪐

> **Next-Generation Intelligent Docker Container Platform**  
> *Smarter, faster, and more beautiful than Portainer. Crafted with Apple macOS frosted glassmorphism & Samsung OneUI ergonomics.*

---

## 🌟 Why OrbitDock Outperforms Portainer

OrbitDock integrates the best algorithms and architectural patterns scraped from top open-source Docker projects:

- **Dockge Algorithm**: Native file-based stacks (`~/.orbitdock/stacks/`) avoiding database lock-in + **`docker run` ⇄ Compose bi-directional converter**.
- **Dozzle Algorithm**: Multi-container log correlation in a unified real-time stream + animated SVG micro-sparklines on container cards.
- **LazyDocker Algorithm**: In-depth container process explorer (`top`) showing live PIDs, CPU%, and commands + precise disk space reclaim breakdown.
- **Watchtower Algorithm**: Smart remote registry digest checks to flag when newer image versions are available.
- **Dive Algorithm**: Image layer efficiency scoring (0–100%) and wasted build cache analyzer.
- **Autoheal Algorithm**: Healthcheck sentinel that automatically restarts unhealthy containers with exponential backoff protection.
- **Smart Crash Diagnostician**: Automatically decodes exit codes (OOMKilled 137, missing env vars, port conflicts) and suggests 1-click solutions.
- **CIS Security Auditor**: Automated 100-point security grading (A–F) auditing privileged mode, root user execution, and sensitive mounts.
- **Portainer Killer Feature**: Full container lifecycle, Create wizard, and **Edit & Recreate (Smart Clone/Upgrade)** preserving data volumes.

---

## 🚀 Quickstart

### Option 1: Run directly on host with `uv` (Instant Launch)

```bash
cd ~/Projects/orbitdock
uv run python -m orbitdock.main --port 9090
```

Open your browser at **[http://localhost:9090](http://localhost:9090)**.

### Option 2: Run via Docker

```bash
docker run -d \
  --name orbitdock \
  --restart unless-stopped \
  -p 9090:9090 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.orbitdock:/root/.orbitdock \
  orbitdock:latest
```

---

## 🎨 Design Philosophy

- **Apple macOS Acrylic Glass**: Frosted translucent backdrops (`backdrop-filter: blur(24px)`), delicate borders, fluid spring transitions, and San Francisco typography.
- **Samsung OneUI Ergonomics**: Prominent hero focus status banner, circular SVG gauges for CPU, RAM, and Disk utilization, and a bottom-floating Action Dock for batch operations.
- **Dark & Light Themes**: Seamless toggle between OLED Space Black and Sonoma Crisp Paper modes.
