/** Dashboard Component: Samsung OneUI Ergonomic Gauges & System Health */
const DashboardComponent = {
  render(container) {
    container.innerHTML = `
      <div class="dashboard-view">
        <!-- Hero Health Overview Banner (Samsung OneUI Style) -->
        <div class="glass-panel" style="padding: 28px 32px; margin-bottom: 24px; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -20px; top: -30px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%); border-radius: 50%; pointer-events: none;"></div>
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
            <div>
              <span class="badge badge-emerald" style="margin-bottom: 8px;">● Docker Engine Online</span>
              <h2 id="dash-hero-title" style="font-size: 1.55rem; font-weight: 700; letter-spacing: -0.02em;">Loading System Intelligence...</h2>
              <p id="dash-hero-subtitle" style="color: var(--text-secondary); font-size: 0.92rem; margin-top: 4px;">Auditing container health, storage, and security...</p>
            </div>
            <div style="display: flex; gap: 12px;">
              <button class="btn btn-secondary" onclick="App.openModal('composerize')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
                Composerize
              </button>
              <button class="btn btn-primary" onclick="App.openModal('create-container')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                Launch Container
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Quick Stats Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin-bottom: 28px;">
          <div class="glass-panel" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Containers</span>
              <span class="badge badge-emerald" id="dash-running-badge">0 Running</span>
            </div>
            <div style="font-size: 2rem; font-weight: 700; margin-top: 8px; font-family: var(--font-mono);" id="dash-total-containers">0</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;" id="dash-stopped-containers">0 stopped</div>
          </div>

          <div class="glass-panel" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Images</span>
              <span class="badge badge-blue">Local Engine</span>
            </div>
            <div style="font-size: 2rem; font-weight: 700; margin-top: 8px; font-family: var(--font-mono);" id="dash-total-images">0</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;" id="dash-images-size">0 MB total</div>
          </div>

          <div class="glass-panel" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Compose Stacks</span>
              <span class="badge badge-purple">Native Stacks</span>
            </div>
            <div style="font-size: 2rem; font-weight: 700; margin-top: 8px; font-family: var(--font-mono);" id="dash-total-stacks">0</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">File-based & External</div>
          </div>

          <div class="glass-panel" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.76rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Reclaimable</span>
              <button class="btn btn-secondary" style="padding: 3px 10px; font-size: 0.72rem;" onclick="App.triggerPrune()">Prune Now</button>
            </div>
            <div style="font-size: 2rem; font-weight: 700; margin-top: 8px; font-family: var(--font-mono); color: var(--accent-amber);" id="dash-reclaimable">0 MB</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">Unused layers & dead containers</div>
          </div>
        </div>

        <!-- 1-Click Launch Presets Section -->
        <div style="margin-bottom: 28px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em;">1-Click Quick Launch Presets</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Pre-configured with auto-generated secure credentials</span>
          </div>
          <div id="presets-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Recent System Events & Audit Log -->
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 16px;">Audit Log & Sentinel Events</h3>
          <div class="glass-panel" style="padding: 16px 20px;">
            <div id="audit-log-list" style="display: flex; flex-direction: column; gap: 10px;">
              <p style="color: var(--text-muted); font-size: 0.85rem;">No recent audit events.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadData();
  },

  async loadData() {
    try {
      const [sysInfo, diskUsage, containersData, stacksData, presetsData, auditLogs] = await Promise.all([
        API.getSystemInfo(),
        API.getDiskUsage(),
        API.getContainers(true),
        API.getStacks(),
        API.getPresets(),
        API.getAuditLogs(10)
      ]);

      // Update OneUI Progress Rings in Header
      App.updateGauges(sysInfo.host.cpu_percent, sysInfo.host.ram_percent, sysInfo.host.disk_percent);

      // Hero banner
      const runningCount = containersData.containers.filter(c => c.state.running).length;
      const totalCount = containersData.containers.length;
      const stoppedCount = totalCount - runningCount;

      const heroTitle = document.getElementById("dash-hero-title");
      const heroSubtitle = document.getElementById("dash-hero-subtitle");
      if (heroTitle) {
        heroTitle.textContent = `${runningCount} of ${totalCount} Containers Running`;
      }
      if (heroSubtitle) {
        heroSubtitle.textContent = `${diskUsage.total_reclaimable_mb} MB reclaimable space • Docker v${sysInfo.docker.version} (${sysInfo.host.os})`;
      }

      // Stats cards
      document.getElementById("dash-total-containers").textContent = totalCount;
      document.getElementById("dash-running-badge").textContent = `${runningCount} Running`;
      document.getElementById("dash-stopped-containers").textContent = `${stoppedCount} stopped`;

      document.getElementById("dash-total-images").textContent = sysInfo.docker.images_total;
      document.getElementById("dash-images-size").textContent = `${diskUsage.images.size_mb} MB total`;

      document.getElementById("dash-total-stacks").textContent = stacksData.total;
      document.getElementById("dash-reclaimable").textContent = `${diskUsage.total_reclaimable_mb} MB`;

      // Presets
      const presetsGrid = document.getElementById("presets-grid");
      if (presetsGrid && presetsData.presets) {
        presetsGrid.innerHTML = presetsData.presets.map(p => `
          <div class="glass-panel" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-weight: 700; font-size: 0.98rem;">${p.name}</span>
                <span class="badge badge-blue">${p.category}</span>
              </div>
              <p style="font-size: 0.78rem; color: var(--text-secondary);">${p.description}</p>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--glass-border);">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">Port ${p.default_port}</span>
              <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="App.launchPreset('${p.id}')">
                Quick Deploy
              </button>
            </div>
          </div>
        `).join("");
      }

      // Audit logs
      const auditList = document.getElementById("audit-log-list");
      if (auditList && auditLogs.logs && auditLogs.logs.length > 0) {
        auditList.innerHTML = auditLogs.logs.map(log => `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; padding: 6px 0; border-bottom: 1px solid var(--glass-border);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge badge-purple">${log.event_type}</span>
              <span style="font-weight: 600;">${log.target_name}</span>
            </div>
            <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(log.timestamp).toLocaleTimeString()}</span>
          </div>
        `).join("");
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
    }
  }
};
