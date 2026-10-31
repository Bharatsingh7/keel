/** Container Detail Drawer: Deep Inspect, Top Processes, Security Score, and Failure Diagnostics */
const ContainerDetailComponent = {
  activeTab: "overview",
  currentData: null,

  render(container, detailsData) {
    this.currentData = detailsData;
    const summary = detailsData.summary;
    const attrs = detailsData.attrs;
    const security = detailsData.security;
    const diagnostics = detailsData.diagnostics;
    const config = attrs.Config || {};
    const hostConfig = attrs.HostConfig || {};

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- Header Banner -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge ${summary.state.running ? 'badge-emerald' : 'badge-rose'}">
                ● ${summary.status.toUpperCase()}
              </span>
              <span class="badge badge-blue">ID: ${summary.id}</span>
              ${security ? `<span class="badge badge-${security.badge_color}">CIS Grade ${security.grade} (${security.score}%)</span>` : ''}
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="ContainerDetailComponent.copyDockerRun()">
                Copy docker run
              </button>
              <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="ContainerDetailComponent.exportCompose()">
                Export Compose YAML
              </button>
              <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="App.openRecreateModal('${summary.id}')">
                Edit & Recreate
              </button>
            </div>
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 700;">${summary.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; font-family: var(--font-mono);">${summary.image}</p>
        </div>

        <!-- Diagnostics Alert Banner if failure detected -->
        ${diagnostics ? `
          <div class="glass-panel" style="padding: 16px; margin-bottom: 20px; border-color: rgba(244, 63, 94, 0.4); background: rgba(244, 63, 94, 0.08);">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-rose); font-weight: 700; margin-bottom: 4px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Smart Diagnosis: ${diagnostics.title}
            </div>
            <p style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 6px;"><b>Cause:</b> ${diagnostics.root_cause}</p>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px;"><b>Solution:</b> ${diagnostics.suggested_fix}</p>
            <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.75rem; color: #fca5a5; max-height: 80px; overflow-y: auto;">
              ${diagnostics.evidence}
            </div>
          </div>
        ` : ''}

        <!-- Subtabs Navigation -->
        <div class="subtabs-bar">
          <button class="subtab-btn active" data-tab="overview" onclick="ContainerDetailComponent.setTab('overview')">Overview</button>
          <button class="subtab-btn" data-tab="metrics" onclick="ContainerDetailComponent.setTab('metrics')">Live Telemetry</button>
          <button class="subtab-btn" data-tab="processes" onclick="ContainerDetailComponent.setTab('processes')">Processes (Top)</button>
          <button class="subtab-btn" data-tab="security" onclick="ContainerDetailComponent.setTab('security')">Security Audit</button>
          <button class="subtab-btn" data-tab="environment" onclick="ContainerDetailComponent.setTab('environment')">Environment</button>
          <button class="subtab-btn" data-tab="mounts" onclick="ContainerDetailComponent.setTab('mounts')">Mounts</button>
        </div>

        <!-- Tab Contents -->
        <div id="detail-tab-content" style="flex: 1; overflow-y: auto;">
          <!-- Content rendered dynamically -->
        </div>
      </div>
    `;

    this.renderActiveTab();
  },

  setTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".subtabs-bar .subtab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    this.renderActiveTab();
  },

  async renderActiveTab() {
    const container = document.getElementById("detail-tab-content");
    if (!container || !this.currentData) return;

    const summary = this.currentData.summary;
    const attrs = this.currentData.attrs;
    const config = attrs.Config || {};
    const hostConfig = attrs.HostConfig || {};
    const net = attrs.NetworkSettings || {};

    if (this.activeTab === "overview") {
      container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="glass-panel" style="padding: 16px;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 8px;">Network & IP</div>
            <div style="font-size: 0.88rem; margin-bottom: 4px;"><b>Primary IP:</b> ${summary.ip_address || 'None'}</div>
            <div style="font-size: 0.88rem; margin-bottom: 4px;"><b>Network Mode:</b> ${hostConfig.NetworkMode || 'default'}</div>
            <div style="font-size: 0.88rem;"><b>Gateway:</b> ${net.Gateway || 'None'}</div>
          </div>

          <div class="glass-panel" style="padding: 16px;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 8px;">Lifecycle & Specs</div>
            <div style="font-size: 0.88rem; margin-bottom: 4px;"><b>Restart Policy:</b> ${summary.restart_policy}</div>
            <div style="font-size: 0.88rem; margin-bottom: 4px;"><b>Created:</b> ${new Date(summary.created).toLocaleString()}</div>
            <div style="font-size: 0.88rem;"><b>Memory Limit:</b> ${hostConfig.Memory ? `${Math.round(hostConfig.Memory / (1024*1024))} MB` : 'Unlimited'}</div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 16px; margin-top: 16px;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 8px;">Entrypoint & Command</div>
          <pre style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px; overflow-x: auto;">${(config.Cmd || []).join(" ")}</pre>
        </div>
      `;
    } else if (this.activeTab === "processes") {
      container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Fetching container processes...</div>`;
      try {
        const topData = await API.getContainerTop(summary.id);
        if (!topData.processes || topData.processes.length === 0) {
          container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">${topData.message || 'No active processes.'}</div>`;
          return;
        }

        container.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                ${topData.titles.map(t => `<th>${t}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${topData.processes.map(proc => `
                <tr>
                  ${proc.map(col => `<td style="font-family: var(--font-mono); font-size: 0.8rem;">${col}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      } catch (err) {
        container.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Failed to inspect processes: ${err.message}</div>`;
      }
    } else if (this.activeTab === "security") {
      const sec = this.currentData.security;
      container.innerHTML = `
        <div class="glass-panel" style="padding: 20px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">CIS Security Score</div>
            <div style="font-size: 1.8rem; font-weight: 700; margin-top: 4px;">Grade ${sec.grade} (${sec.score}/100)</div>
          </div>
          <span class="badge badge-${sec.badge_color}" style="font-size: 0.9rem; padding: 6px 14px;">${sec.critical_count} Critical Vulnerabilities</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${sec.findings.map(f => `
            <div class="glass-panel" style="padding: 14px 18px; border-left: 4px solid var(--accent-${f.severity === 'critical' ? 'rose' : f.severity === 'high' ? 'amber' : 'blue'});">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 0.9rem;">${f.title}</span>
                <span class="badge badge-${f.severity === 'critical' ? 'rose' : 'amber'}">${f.severity.toUpperCase()}</span>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 6px;">${f.description}</p>
              <div style="font-size: 0.78rem; color: var(--accent-blue);"><b>Remediation:</b> ${f.remediation}</div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (this.activeTab === "metrics") {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="glass-panel" style="padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">CPU Utilization</span>
                <span id="live-cpu-badge" class="badge badge-blue">0.0%</span>
              </div>
              <canvas id="live-cpu-canvas" width="360" height="120" style="width: 100%; height: 120px; background: rgba(0,0,0,0.2); border-radius: 8px;"></canvas>
            </div>

            <div class="glass-panel" style="padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Memory Usage</span>
                <span id="live-mem-badge" class="badge badge-emerald">0 MB (0%)</span>
              </div>
              <canvas id="live-mem-canvas" width="360" height="120" style="width: 100%; height: 120px; background: rgba(0,0,0,0.2); border-radius: 8px;"></canvas>
            </div>
          </div>

          <div class="glass-panel" style="padding: 16px;">
            <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 8px;">Network I/O</div>
            <div style="display: flex; gap: 24px; font-family: var(--font-mono); font-size: 0.88rem;">
              <div><span style="color: var(--accent-emerald);">↓ RX:</span> <span id="live-rx-val">0 KB</span></div>
              <div><span style="color: var(--accent-blue);">↑ TX:</span> <span id="live-tx-val">0 KB</span></div>
            </div>
          </div>
        </div>
      `;
      this.startMetricsStream(summary.id);
    } else if (this.activeTab === "environment") {
      const envList = config.Env || [];
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr><th>Variable</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${envList.map(e => {
              const [k, ...rest] = e.split("=");
              const v = rest.join("=");
              return `<tr><td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-blue);">${k}</td><td style="font-family: var(--font-mono);">${v}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      `;
    } else if (this.activeTab === "mounts") {
      const mounts = attrs.Mounts || [];
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr><th>Type</th><th>Host Source</th><th>Container Destination</th><th>Mode</th></tr>
          </thead>
          <tbody>
            ${mounts.map(m => `
              <tr>
                <td><span class="badge badge-purple">${m.Type}</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${m.Source || m.Name}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${m.Destination}</td>
                <td>${m.Mode || (m.RW ? 'rw' : 'ro')}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  },

  metricsSocket: null,
  cpuHistory: [],
  memHistory: [],

  startMetricsStream(containerId) {
    if (this.metricsSocket) {
      this.metricsSocket.close();
    }
    this.cpuHistory = Array(20).fill(0);
    this.memHistory = Array(20).fill(0);

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/containers/${containerId}/stats`;
    this.metricsSocket = new WebSocket(url);

    this.metricsSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const cpuBadge = document.getElementById("live-cpu-badge");
        const memBadge = document.getElementById("live-mem-badge");
        const rxVal = document.getElementById("live-rx-val");
        const txVal = document.getElementById("live-tx-val");

        if (cpuBadge) cpuBadge.textContent = `${data.cpu_percent}%`;
        if (memBadge) memBadge.textContent = `${data.mem_used_mb} MB (${data.mem_percent}%)`;
        if (rxVal) rxVal.textContent = `${data.net_rx_kb} KB`;
        if (txVal) txVal.textContent = `${data.net_tx_kb} KB`;

        this.cpuHistory.push(data.cpu_percent);
        this.cpuHistory.shift();
        this.memHistory.push(data.mem_percent);
        this.memHistory.shift();

        this.drawChart("live-cpu-canvas", this.cpuHistory, "#3b82f6");
        this.drawChart("live-mem-canvas", this.memHistory, "#10b981");
      } catch {}
    };
  },

  drawChart(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;

    const step = w / (data.length - 1);
    const maxVal = Math.max(100, ...data);

    data.forEach((val, idx) => {
      const x = idx * step;
      const y = h - (val / maxVal * (h - 20)) - 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  },

  exportCompose() {
    if (!this.currentData) return;
    const composeContent = this.currentData.compose_yaml;
    if (!composeContent) {
      alert("No compose configuration available for this container.");
      return;
    }
    const blob = new Blob([composeContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.currentData.summary.name}-compose.yml`;
    a.click();
    URL.revokeObjectURL(url);
  },

  copyDockerRun() {
    if (this.currentData && this.currentData.docker_run_cmd) {
      navigator.clipboard.writeText(this.currentData.docker_run_cmd);
      alert("Copied docker run command to clipboard!");
    }
  }
};
