/** Compose Stacks Component: Native File-Based Stacks Studio (Dockge algorithm) */
const StacksComponent = {
  stacks: [],

  render(container) {
    container.innerHTML = `
      <div class="view-container">
        <div class="toolbar">
          <div style="display: flex; align-items: center; gap: 14px;">
            <h2 style="font-size: 1.35rem; font-weight: 700;">Compose Stacks</h2>
            <span class="badge badge-purple" id="stacks-count-badge">0 Stacks</span>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="App.openModal('composerize')">
              Composerize docker run
            </button>
            <button class="btn btn-primary" onclick="StacksComponent.openDeployModal()">
              + New Stack
            </button>
          </div>
        </div>

        <div class="glass-panel" style="overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Stack Name</th>
                <th>Type</th>
                <th>Services</th>
                <th>Status</th>
                <th>Storage Path</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="stacks-table-body">
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Loading stacks...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.loadStacks();
  },

  async loadStacks() {
    try {
      const data = await API.getStacks();
      this.stacks = data.stacks;

      const badge = document.getElementById("stacks-count-badge");
      if (badge) badge.textContent = `${data.total} Stacks`;

      const tbody = document.getElementById("stacks-table-body");
      if (!tbody) return;

      if (this.stacks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No Compose stacks found. Click '+ New Stack' to deploy one.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.stacks.map(st => {
        const isRunning = st.status === "running";
        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: var(--text-primary);">${st.name}</div>
            </td>
            <td><span class="badge ${st.type === 'file_based' ? 'badge-blue' : 'badge-purple'}">${st.type}</span></td>
            <td>
              <span class="badge badge-emerald">${st.services_count} Containers</span>
            </td>
            <td>
              <span class="badge ${isRunning ? 'badge-emerald' : 'badge-amber'}">${st.status.toUpperCase()}</span>
            </td>
            <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${st.path}
            </td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="StacksComponent.editStack('${st.name}')">
                  Edit YAML
                </button>
                ${isRunning 
                  ? `<button class="btn btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="StacksComponent.downStack('${st.name}')">Down</button>`
                  : `<button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="StacksComponent.editStack('${st.name}')">Deploy</button>`
                }
              </div>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.error("Failed to load stacks:", err);
    }
  },

  async editStack(name) {
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.getElementById("modal-footer");

    modalTitle.textContent = `Edit Stack: ${name}`;
    modalBody.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Loading stack configuration...</div>`;
    App.openModalWindow();

    try {
      const data = await API.getStack(name);
      modalBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <input type="hidden" id="stack-name-input" value="${name}">
          <div>
            <label class="form-label">Docker Compose YAML:</label>
            <textarea id="stack-yaml-input" class="form-control" rows="14" style="font-family: var(--font-mono); font-size: 0.82rem;">${data.compose_yaml || ''}</textarea>
          </div>
          <div>
            <label class="form-label">.env Variables (optional):</label>
            <textarea id="stack-env-input" class="form-control" rows="3" style="font-family: var(--font-mono); font-size: 0.82rem;">${data.env_content || ''}</textarea>
          </div>
        </div>
      `;

      modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="StacksComponent.downStack('${name}')">Down Stack</button>
        <button class="btn btn-primary" onclick="StacksComponent.submitDeploy()">Deploy Stack</button>
      `;
    } catch (err) {
      modalBody.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Failed to load stack: ${err.message}</div>`;
    }
  },

  openDeployModal() {
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.getElementById("modal-footer");

    modalTitle.textContent = "Deploy New Compose Stack";

    const defaultCompose = `version: "3.8"
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`;

    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Stack Name <span style="color: var(--accent-rose);">*</span></label>
          <input type="text" id="stack-name-input" class="form-control" placeholder="e.g. web-app">
        </div>
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Docker Compose YAML:</label>
          </div>
          <textarea id="stack-yaml-input" class="form-control" rows="12" style="font-family: var(--font-mono); font-size: 0.82rem;">${defaultCompose}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">.env Variables (optional):</label>
          <textarea id="stack-env-input" class="form-control" rows="3" placeholder="DB_PASS=secret123" style="font-family: var(--font-mono); font-size: 0.82rem;"></textarea>
        </div>
      </div>
    `;

    modalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="StacksComponent.submitDeploy()">Deploy Stack</button>
    `;

    App.openModalWindow();
  },

  async submitDeploy() {
    const name = document.getElementById("stack-name-input").value.trim();
    const yamlContent = document.getElementById("stack-yaml-input").value.trim();
    const envContent = document.getElementById("stack-env-input").value.trim();

    if (!name || !yamlContent) {
      alert("Stack name and Compose YAML are required.");
      return;
    }

    try {
      const res = await API.deployStack({ name, compose_yaml: yamlContent, env_content: envContent });
      alert(`Stack '${name}' deployed successfully!\n\n${res.output}`);
      App.closeModal();
      this.loadStacks();
    } catch (err) {
      alert(`Deploy failed: ${err.message}`);
    }
  },

  async downStack(name) {
    if (!confirm(`Are you sure you want to stop and down stack '${name}'?`)) return;
    try {
      await API.downStack(name);
      alert(`Stack '${name}' stopped and destroyed.`);
      App.closeModal();
      this.loadStacks();
    } catch (err) {
      alert(`Failed to down stack: ${err.message}`);
    }
  }
};
