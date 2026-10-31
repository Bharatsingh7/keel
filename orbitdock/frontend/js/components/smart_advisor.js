/** Smart Advisor Component: Security Posture, Failure Root Cause Diagnostician, and Resource Tuning */
const SmartAdvisorComponent = {
  render(container) {
    container.innerHTML = `
      <div class="view-container">
        <!-- Hero Intelligence Banner -->
        <div class="glass-panel" style="padding: 24px 28px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <span class="badge badge-purple" style="margin-bottom: 6px;">● Algorithmic Diagnostics Active</span>
              <h2 style="font-size: 1.45rem; font-weight: 700;">Smart Advisor & Security Sentinel</h2>
              <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 4px;">
                Auditing CIS Docker benchmark compliance, crash-loop signatures, memory slopes, and port collisions.
              </p>
            </div>
            <button class="btn btn-primary" onclick="SmartAdvisorComponent.refreshAudits()">
              Re-Scan Containers
            </button>
          </div>
        </div>

        <div id="advisor-cards-container" style="display: flex; flex-direction: column; gap: 18px;">
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">Auditing container fleet...</div>
        </div>
      </div>
    `;

    this.refreshAudits();
  },

  async refreshAudits() {
    const container = document.getElementById("advisor-cards-container");
    if (!container) return;

    try {
      const data = await API.getContainers(true);
      const containers = data.containers;

      if (containers.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No containers found to audit.</div>`;
        return;
      }

      // Fetch details & security score for each container
      const auditResults = await Promise.all(
        containers.map(c => API.getContainerDetails(c.id).catch(() => null))
      );

      const validAudits = auditResults.filter(Boolean);

      container.innerHTML = validAudits.map(item => {
        const summary = item.summary;
        const sec = item.security;
        const diag = item.diagnostics;

        return `
          <div class="glass-panel" style="padding: 22px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="status-dot ${summary.state.running ? 'running' : 'stopped'}"></div>
                <div>
                  <h3 style="font-size: 1.1rem; font-weight: 700;">${summary.name}</h3>
                  <div style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">${summary.image}</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="badge badge-${sec.badge_color}" style="font-size: 0.85rem; padding: 4px 12px;">
                  CIS Grade ${sec.grade} (${sec.score}/100)
                </span>
                <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="App.openContainerDetails('${summary.id}')">
                  Inspect
                </button>
                <button class="btn btn-primary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="App.openRecreateModal('${summary.id}')">
                  Harden & Recreate
                </button>
              </div>
            </div>

            <!-- Diagnostics Warning if container failed -->
            ${diag ? `
              <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 10px; padding: 12px 16px;">
                <div style="color: var(--accent-rose); font-weight: 700; font-size: 0.88rem; margin-bottom: 2px;">
                  ⚠ ${diag.title} (Exit Code ${diag.exit_code})
                </div>
                <div style="font-size: 0.82rem; color: var(--text-primary); margin-bottom: 4px;">${diag.root_cause}</div>
                <div style="font-size: 0.8rem; color: var(--accent-blue);"><b>Recommended Fix:</b> ${diag.suggested_fix}</div>
              </div>
            ` : ''}

            <!-- Security Findings List -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
              ${sec.findings.map(f => `
                <div style="background: rgba(0, 0, 0, 0.18); border: 1px solid var(--glass-border); border-radius: 10px; padding: 10px 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-weight: 600; font-size: 0.82rem;">${f.title}</span>
                    <span class="badge badge-${f.severity === 'critical' ? 'rose' : f.severity === 'high' ? 'amber' : 'blue'}" style="font-size: 0.68rem;">${f.severity}</span>
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-secondary);">${f.remediation}</div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }).join("");

    } catch (err) {
      container.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Audit error: ${err.message}</div>`;
    }
  }
};
