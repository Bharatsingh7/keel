/** Container Creation & Edit/Recreate (Smart Clone/Upgrade) Modal Component */
const ContainerModalComponent = {
  isRecreate: false,
  targetContainerId: null,

  open(mode = "create", containerId = null) {
    this.isRecreate = mode === "recreate";
    this.targetContainerId = containerId;

    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.getElementById("modal-footer");

    modalTitle.textContent = this.isRecreate ? "Edit & Recreate Container (Smart Clone)" : "Launch New Container";

    modalBody.innerHTML = `
      <form id="container-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label class="form-label">Container Name</label>
            <input type="text" id="c-name" class="form-control" placeholder="e.g. my-app-service">
          </div>
          <div class="form-group">
            <label class="form-label">Docker Image <span style="color: var(--accent-rose);">*</span></label>
            <input type="text" id="c-image" class="form-control" placeholder="e.g. redis:alpine, postgres:16" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Command Override (optional)</label>
          <input type="text" id="c-command" class="form-control" placeholder="e.g. npm start or redis-server --appendonly yes">
        </div>

        <!-- Port Mappings Section -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Port Mappings (Host : Container)</label>
            <button type="button" class="btn btn-secondary" style="padding: 2px 10px; font-size: 0.72rem;" onclick="ContainerModalComponent.addPortRow()">+ Add Port</button>
          </div>
          <div id="ports-rows-container" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Port rows -->
          </div>
        </div>

        <!-- Volumes / Binds Section -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Volumes & Mounts (Host Path : Container Path)</label>
            <button type="button" class="btn btn-secondary" style="padding: 2px 10px; font-size: 0.72rem;" onclick="ContainerModalComponent.addVolumeRow()">+ Add Volume</button>
          </div>
          <div id="volumes-rows-container" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Volume rows -->
          </div>
        </div>

        <!-- Environment Variables Section -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Environment Variables</label>
            <button type="button" class="btn btn-secondary" style="padding: 2px 10px; font-size: 0.72rem;" onclick="ContainerModalComponent.addEnvRow()">+ Add Variable</button>
          </div>
          <div id="env-rows-container" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Env rows -->
          </div>
        </div>

        <!-- Advanced Runtime Options -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label class="form-label">Restart Policy</label>
            <select id="c-restart" class="form-control">
              <option value="unless-stopped">Unless Stopped (Recommended)</option>
              <option value="always">Always</option>
              <option value="on-failure">On Failure</option>
              <option value="no">No</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Memory Limit (MB, 0 = unlimited)</label>
            <input type="number" id="c-mem-limit" class="form-control" placeholder="e.g. 512" min="0">
          </div>
        </div>
      </form>
    `;

    modalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-submit-container" onclick="ContainerModalComponent.submit()">
        ${this.isRecreate ? 'Recreate Container' : 'Launch Container'}
      </button>
    `;

    // Add initial default empty rows
    this.addPortRow();
    this.addVolumeRow();
    this.addEnvRow();

    // If recreate, load existing container configuration to pre-fill
    if (this.isRecreate && containerId) {
      this.loadExistingConfig(containerId);
    }

    App.openModalWindow();
  },

  addPortRow(hostPort = "", containerPort = "") {
    const container = document.getElementById("ports-rows-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "port-row";
    row.style = "display: flex; gap: 8px; align-items: center;";
    row.innerHTML = `
      <input type="number" class="form-control host-port-input" placeholder="Host Port (e.g. 8080)" value="${hostPort}" style="flex: 1;">
      <span style="color: var(--text-muted); font-weight: 700;">:</span>
      <input type="number" class="form-control container-port-input" placeholder="Container Port (e.g. 80)" value="${containerPort}" style="flex: 1;">
      <button type="button" class="btn btn-secondary" style="padding: 6px 10px;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  },

  addVolumeRow(hostPath = "", containerPath = "") {
    const container = document.getElementById("volumes-rows-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "volume-row";
    row.style = "display: flex; gap: 8px; align-items: center;";
    row.innerHTML = `
      <input type="text" class="form-control host-volume-input" placeholder="Host Path / Volume Name" value="${hostPath}" style="flex: 1;">
      <span style="color: var(--text-muted); font-weight: 700;">:</span>
      <input type="text" class="form-control container-volume-input" placeholder="Container Path (e.g. /data)" value="${containerPath}" style="flex: 1;">
      <button type="button" class="btn btn-secondary" style="padding: 6px 10px;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  },

  addEnvRow(key = "", val = "") {
    const container = document.getElementById("env-rows-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "env-row";
    row.style = "display: flex; gap: 8px; align-items: center;";
    row.innerHTML = `
      <input type="text" class="form-control env-key-input" placeholder="KEY (e.g. DB_PASS)" value="${key}" style="flex: 1; font-family: var(--font-mono);">
      <span style="color: var(--text-muted); font-weight: 700;">=</span>
      <input type="text" class="form-control env-val-input" placeholder="VALUE" value="${val}" style="flex: 1; font-family: var(--font-mono);">
      <button type="button" class="btn btn-secondary" style="padding: 6px 10px;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  },

  async loadExistingConfig(containerId) {
    try {
      const data = await API.getContainerDetails(containerId);
      const attrs = data.attrs;
      const config = attrs.Config || {};
      const hostConfig = attrs.HostConfig || {};

      document.getElementById("c-name").value = attrs.Name ? attrs.Name.replace("/", "") : "";
      document.getElementById("c-image").value = config.Image || "";
      if (config.Cmd) {
        document.getElementById("c-command").value = config.Cmd.join(" ");
      }

      // Populate ports
      const portsContainer = document.getElementById("ports-rows-container");
      portsContainer.innerHTML = "";
      const portBindings = hostConfig.PortBindings || {};
      for (const [cPort, bindings] of Object.entries(portBindings)) {
        const cleanCPort = cPort.split("/")[0];
        const hPort = bindings && bindings[0] ? bindings[0].HostPort : "";
        this.addPortRow(hPort, cleanCPort);
      }

      // Populate volumes
      const volumesContainer = document.getElementById("volumes-rows-container");
      volumesContainer.innerHTML = "";
      const binds = hostConfig.Binds || [];
      for (const b of binds) {
        const parts = b.split(":");
        if (parts.length >= 2) {
          this.addVolumeRow(parts[0], parts[1]);
        }
      }

      // Populate env
      const envContainer = document.getElementById("env-rows-container");
      envContainer.innerHTML = "";
      const envList = config.Env || [];
      for (const e of envList) {
        if (!e.startsWith("PATH=")) {
          const [k, ...vParts] = e.split("=");
          this.addEnvRow(k, vParts.join("="));
        }
      }

      // Restart policy
      const restartPolicy = hostConfig.RestartPolicy ? hostConfig.RestartPolicy.Name : "unless-stopped";
      document.getElementById("c-restart").value = restartPolicy;
    } catch (err) {
      console.error("Failed to load existing config for recreate:", err);
    }
  },

  async submit() {
    const btn = document.getElementById("btn-submit-container");
    const name = document.getElementById("c-name").value.trim();
    const image = document.getElementById("c-image").value.trim();
    const command = document.getElementById("c-command").value.trim();
    const restartPolicy = document.getElementById("c-restart").value;
    const memLimit = document.getElementById("c-mem-limit").value;

    if (!image) {
      alert("Docker image is required.");
      return;
    }

    // Collect ports
    const ports = [];
    document.querySelectorAll(".port-row").forEach(row => {
      const h = row.querySelector(".host-port-input").value.trim();
      const c = row.querySelector(".container-port-input").value.trim();
      if (h && c) {
        ports.push({ host_port: parseInt(h, 10), container_port: parseInt(c, 10) });
      }
    });

    // Collect volumes
    const volumes = [];
    document.querySelectorAll(".volume-row").forEach(row => {
      const h = row.querySelector(".host-volume-input").value.trim();
      const c = row.querySelector(".container-volume-input").value.trim();
      if (h && c) {
        volumes.push({ host_path: h, container_path: c });
      }
    });

    // Collect env
    const env = {};
    document.querySelectorAll(".env-row").forEach(row => {
      const k = row.querySelector(".env-key-input").value.trim();
      const v = row.querySelector(".env-val-input").value.trim();
      if (k) {
        env[k] = v;
      }
    });

    const payload = {
      name: name || undefined,
      image,
      command: command ? command.split(" ") : undefined,
      ports,
      volumes,
      env,
      restart_policy: restartPolicy,
      memory_limit_mb: memLimit ? parseInt(memLimit, 10) : undefined
    };

    btn.disabled = true;
    btn.textContent = "Processing...";

    try {
      if (this.isRecreate && this.targetContainerId) {
        await API.recreateContainer(this.targetContainerId, payload);
      } else {
        await API.createContainer(payload);
      }
      App.closeModal();
      if (App.currentView === "containers") {
        ContainersComponent.loadContainers();
      } else {
        App.navigate("containers");
      }
    } catch (err) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = this.isRecreate ? "Recreate Container" : "Launch Container";
    }
  }
};
