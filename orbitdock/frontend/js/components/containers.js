/** Containers Component: Cards Grid, SVG Sparklines, and Floating Batch Action Dock */
const ContainersComponent = {
  selectedIds: new Set(),
  activeFilter: "all",
  searchQuery: "",
  containers: [],

  render(container) {
    container.innerHTML = `
      <div class="view-container">
        <!-- Toolbar -->
        <div class="toolbar">
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <div class="search-input-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" class="search-input" id="container-search" placeholder="Search by name, image, or port... [/]">
            </div>

            <div class="filter-pills">
              <button class="filter-pill active" data-filter="all" onclick="ContainersComponent.setFilter('all')">All</button>
              <button class="filter-pill" data-filter="running" onclick="ContainersComponent.setFilter('running')">Running</button>
              <button class="filter-pill" data-filter="stopped" onclick="ContainersComponent.setFilter('stopped')">Stopped</button>
              <button class="filter-pill" data-filter="unhealthy" onclick="ContainersComponent.setFilter('unhealthy')">Unhealthy</button>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="ContainersComponent.openMultiLogs()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              Multi-Logs
            </button>
            <button class="btn btn-primary" onclick="App.openModal('create-container')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Create Container
            </button>
          </div>
        </div>

        <!-- Cards Grid -->
        <div id="containers-grid" class="cards-grid">
          <!-- Dynamically generated container cards -->
        </div>

        <!-- Floating Bottom Action Dock (Samsung OneUI Ergonomics) -->
        <div id="floating-batch-dock" class="floating-dock">
          <span style="font-size: 0.85rem; font-weight: 600;" id="batch-count-text">0 selected</span>
          <div style="height: 18px; width: 1px; background: var(--glass-border);"></div>
          <button class="btn btn-secondary" style="padding: 5px 14px; font-size: 0.8rem;" onclick="ContainersComponent.batchAction('start')">Start</button>
          <button class="btn btn-secondary" style="padding: 5px 14px; font-size: 0.8rem;" onclick="ContainersComponent.batchAction('restart')">Restart</button>
          <button class="btn btn-secondary" style="padding: 5px 14px; font-size: 0.8rem;" onclick="ContainersComponent.batchAction('stop')">Stop</button>
          <button class="btn btn-danger" style="padding: 5px 14px; font-size: 0.8rem;" onclick="ContainersComponent.batchAction('remove')">Delete</button>
        </div>
      </div>
    `;

    document.getElementById("container-search").addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderCards();
    });

    this.loadContainers();
  },

  setFilter(filter) {
    this.activeFilter = filter;
    document.querySelectorAll(".filter-pill").forEach(p => {
      p.classList.toggle("active", p.getAttribute("data-filter") === filter);
    });
    this.renderCards();
  },

  async loadContainers() {
    try {
      const data = await API.getContainers(true);
      this.containers = data.containers;
      this.renderCards();
    } catch (err) {
      console.error("Failed to load containers:", err);
    }
  },

  renderCards() {
    const grid = document.getElementById("containers-grid");
    if (!grid) return;

    const filtered = this.containers.filter(c => {
      // Status filter
      if (this.activeFilter === "running" && !c.state.running) return false;
      if (this.activeFilter === "stopped" && c.state.running) return false;
      if (this.activeFilter === "unhealthy" && c.state.health !== "unhealthy" && !c.state.oom_killed) return false;

      // Search query
      if (this.searchQuery) {
        const matchName = c.name.toLowerCase().includes(this.searchQuery);
        const matchImage = c.image.toLowerCase().includes(this.searchQuery);
        const matchPort = c.ports.some(p => (p.host_port && p.host_port.toString().includes(this.searchQuery)));
        return matchName || matchImage || matchPort;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: var(--text-muted);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px;"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          <p style="font-size: 1rem; font-weight: 600;">No containers match your criteria.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(c => this.generateCardHtml(c)).join("");
    this.updateDock();
  },

  generateCardHtml(c) {
    const isRunning = c.state.running;
    const isPaused = c.state.paused;
    const isUnhealthy = c.state.health === "unhealthy" || c.state.oom_killed;
    const isChecked = this.selectedIds.has(c.id);

    let dotClass = "stopped";
    let statusText = "Stopped";
    if (isRunning) {
      dotClass = isUnhealthy ? "unhealthy" : "running";
      statusText = isUnhealthy ? "Unhealthy" : "Running";
    } else if (isPaused) {
      dotClass = "paused";
      statusText = "Paused";
    }

    // Ports pills
    const portsHtml = c.ports
      .filter(p => p.host_port)
      .map(p => `
        <span class="meta-pill">
          <a href="http://localhost:${p.host_port}" target="_blank" rel="noopener">:${p.host_port} ↗</a>
        </span>
      `).join("");

    // Pseudo-random initial sparkline points for realistic live visual
    const sparklinePoints = [15, 20, 18, 25, 22, 28, 24, 30].map((v, i) => `${i * 12},${28 - (v / 100 * 24)}`).join(" ");

    return `
      <div class="glass-panel container-card" id="card-${c.id}">
        <!-- Card Header -->
        <div class="container-card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent-blue); cursor: pointer;" 
              ${isChecked ? "checked" : ""} onchange="ContainersComponent.toggleSelect('${c.id}')">
            <div class="status-dot ${dotClass}"></div>
            <div>
              <div class="container-name" style="cursor: pointer;" onclick="App.openContainerDetails('${c.id}')">${c.name}</div>
              <div class="container-image-tag" title="${c.image}">${c.image}</div>
            </div>
          </div>
          <span class="badge ${isRunning ? 'badge-emerald' : 'badge-rose'}" style="font-size: 0.72rem;">${statusText}</span>
        </div>

        <!-- Live Sparklines Area (Dozzle Inspired) -->
        <div class="sparkline-container">
          <div class="sparkline-metric">
            <span class="sparkline-label">CPU / Activity</span>
            <span class="sparkline-val" id="cpu-val-${c.id}">${isRunning ? 'Active' : '0.0%'}</span>
          </div>
          <svg class="sparkline-svg" viewBox="0 0 84 28">
            <polyline fill="none" stroke="${isRunning ? '#3b82f6' : '#64748b'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${sparklinePoints}"/>
          </svg>
        </div>

        <!-- Meta Pills (Ports & Stack) -->
        <div class="meta-pills-row">
          ${c.stack ? `<span class="badge badge-purple" style="font-size: 0.7rem;">Stack: ${c.stack}</span>` : ''}
          ${portsHtml ? portsHtml : `<span style="font-size: 0.72rem; color: var(--text-muted);">No ports published</span>`}
        </div>

        <!-- Card Actions Toolbar -->
        <div class="card-actions-bar">
          <div style="display: flex; gap: 6px;">
            ${isRunning 
              ? `<button class="card-action-btn" title="Stop" onclick="ContainersComponent.action('${c.id}', 'stop')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                 </button>
                 <button class="card-action-btn" title="Restart" onclick="ContainersComponent.action('${c.id}', 'restart')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>
                 </button>`
              : `<button class="card-action-btn" title="Start" onclick="ContainersComponent.action('${c.id}', 'start')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                 </button>`
            }
            <button class="card-action-btn" title="Live Logs" onclick="App.openLogs('${c.id}', '${c.name}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
            <button class="card-action-btn" title="Interactive Shell Console" onclick="App.openTerminal('${c.id}', '${c.name}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            </button>
          </div>

          <div style="display: flex; gap: 6px;">
            <button class="card-action-btn" title="Edit & Recreate (Smart Clone)" onclick="App.openRecreateModal('${c.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="card-action-btn" title="Delete Container" style="color: var(--accent-rose);" onclick="ContainersComponent.action('${c.id}', 'remove')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateDock();
  },

  updateDock() {
    const dock = document.getElementById("floating-batch-dock");
    const text = document.getElementById("batch-count-text");
    if (!dock) return;

    const count = this.selectedIds.size;
    if (count > 0) {
      text.textContent = `${count} container${count > 1 ? 's' : ''} selected`;
      dock.classList.add("show");
    } else {
      dock.classList.remove("show");
    }
  },

  async action(id, act) {
    try {
      await API.containerAction(id, act);
      await this.loadContainers();
    } catch (err) {
      alert(`Action '${act}' failed: ${err.message}`);
    }
  },

  async batchAction(act) {
    if (this.selectedIds.size === 0) return;
    if (act === "remove" && !confirm(`Are you sure you want to delete ${this.selectedIds.size} container(s)?`)) return;

    for (const id of this.selectedIds) {
      try {
        await API.containerAction(id, act);
      } catch (err) {
        console.error(`Batch action ${act} failed for ${id}:`, err);
      }
    }
    this.selectedIds.clear();
    await this.loadContainers();
  },

  openMultiLogs() {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      // Pick first 3 running containers as default
      const runningIds = this.containers.filter(c => c.state.running).slice(0, 3).map(c => c.id);
      if (runningIds.length === 0) {
        alert("No running containers available for multi-logs.");
        return;
      }
      App.openMultiLogs(runningIds);
    } else {
      App.openMultiLogs(ids);
    }
  }
};
