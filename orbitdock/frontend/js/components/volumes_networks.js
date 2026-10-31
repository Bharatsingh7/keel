/** Volumes & Networks Component */
const VolumesNetworksComponent = {
  currentTab: "volumes",

  render(container, defaultTab = "volumes") {
    this.currentTab = defaultTab;
    container.innerHTML = `
      <div class="view-container">
        <div class="toolbar">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div class="filter-pills">
              <button class="filter-pill ${this.currentTab === 'volumes' ? 'active' : ''}" onclick="VolumesNetworksComponent.switchTab('volumes')">Volumes</button>
              <button class="filter-pill ${this.currentTab === 'networks' ? 'active' : ''}" onclick="VolumesNetworksComponent.switchTab('networks')">Networks</button>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="VolumesNetworksComponent.pruneCurrent()">
              Prune Unused
            </button>
            <button class="btn btn-primary" onclick="VolumesNetworksComponent.openCreateModal()">
              + Create ${this.currentTab === 'volumes' ? 'Volume' : 'Network'}
            </button>
          </div>
        </div>

        <div id="vn-content-area" class="glass-panel" style="overflow: hidden;">
          <!-- Content populated dynamically -->
        </div>
      </div>
    `;

    this.loadData();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll(".filter-pills .filter-pill").forEach(p => {
      p.classList.toggle("active", p.textContent.toLowerCase() === tab);
    });
    const createBtn = document.querySelector(".toolbar .btn-primary");
    if (createBtn) createBtn.textContent = `+ Create ${tab === 'volumes' ? 'Volume' : 'Network'}`;
    this.loadData();
  },

  async loadData() {
    const area = document.getElementById("vn-content-area");
    if (!area) return;

    if (this.currentTab === "volumes") {
      try {
        const data = await API.getVolumes();
        if (data.volumes.length === 0) {
          area.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No Docker volumes found.</div>`;
          return;
        }

        area.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Volume Name</th>
                <th>Driver</th>
                <th>Attached Containers</th>
                <th>Mountpoint</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${data.volumes.map(v => `
                <tr>
                  <td style="font-weight: 700; font-family: var(--font-mono); color: var(--text-primary);">${v.name}</td>
                  <td><span class="badge badge-blue">${v.driver}</span></td>
                  <td>
                    ${v.attached_containers.length > 0 
                      ? v.attached_containers.map(c => `<span class="badge badge-emerald">${c.container_name}</span>`).join(" ")
                      : `<span class="badge badge-amber">Unused</span>`}
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.mountpoint}</td>
                  <td style="text-align: right;">
                    <button class="btn btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="VolumesNetworksComponent.deleteVolume('${v.name}')">Delete</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      } catch (err) {
        area.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Error loading volumes: ${err.message}</div>`;
      }
    } else {
      try {
        const data = await API.getNetworks();
        if (data.networks.length === 0) {
          area.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No Docker networks found.</div>`;
          return;
        }

        area.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Network Name</th>
                <th>ID</th>
                <th>Driver</th>
                <th>Subnet</th>
                <th>Gateway</th>
                <th>Connected Containers</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${data.networks.map(n => `
                <tr>
                  <td style="font-weight: 700; color: var(--text-primary);">${n.name}</td>
                  <td><span class="badge badge-purple" style="font-family: var(--font-mono);">${n.id}</span></td>
                  <td><span class="badge badge-blue">${n.driver}</span></td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">${n.subnet || '—'}</td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">${n.gateway || '—'}</td>
                  <td>
                    ${n.connected_containers.length > 0
                      ? n.connected_containers.map(c => `<span class="badge badge-emerald" title="${c.ipv4_address}">${c.container_name}</span>`).join(" ")
                      : `<span style="color: var(--text-muted); font-size: 0.78rem;">None</span>`}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="VolumesNetworksComponent.deleteNetwork('${n.id}')">Delete</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      } catch (err) {
        area.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Error loading networks: ${err.message}</div>`;
      }
    }
  },

  openCreateModal() {
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.getElementById("modal-footer");

    if (this.currentTab === "volumes") {
      modalTitle.textContent = "Create Docker Volume";
      modalBody.innerHTML = `
        <div class="form-group">
          <label class="form-label">Volume Name</label>
          <input type="text" id="vol-name-input" class="form-control" placeholder="e.g. postgres_data">
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <input type="text" id="vol-driver-input" class="form-control" value="local">
        </div>
      `;
      modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="VolumesNetworksComponent.submitCreateVolume()">Create Volume</button>
      `;
    } else {
      modalTitle.textContent = "Create Docker Network";
      modalBody.innerHTML = `
        <div class="form-group">
          <label class="form-label">Network Name</label>
          <input type="text" id="net-name-input" class="form-control" placeholder="e.g. app_network">
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select id="net-driver-input" class="form-control">
            <option value="bridge">bridge (Standard local)</option>
            <option value="overlay">overlay (Multi-host Swarm)</option>
            <option value="macvlan">macvlan</option>
            <option value="ipvlan">ipvlan</option>
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Subnet (optional)</label>
            <input type="text" id="net-subnet-input" class="form-control" placeholder="e.g. 172.28.0.0/16">
          </div>
          <div class="form-group">
            <label class="form-label">Gateway (optional)</label>
            <input type="text" id="net-gateway-input" class="form-control" placeholder="e.g. 172.28.0.1">
          </div>
        </div>
      `;
      modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="VolumesNetworksComponent.submitCreateNetwork()">Create Network</button>
      `;
    }

    App.openModalWindow();
  },

  async submitCreateVolume() {
    const name = document.getElementById("vol-name-input").value.trim();
    const driver = document.getElementById("vol-driver-input").value.trim() || "local";
    if (!name) return alert("Volume name is required.");

    try {
      await API.createVolume({ name, driver });
      App.closeModal();
      this.loadData();
    } catch (err) {
      alert(`Create volume failed: ${err.message}`);
    }
  },

  async submitCreateNetwork() {
    const name = document.getElementById("net-name-input").value.trim();
    const driver = document.getElementById("net-driver-input").value;
    const subnet = document.getElementById("net-subnet-input").value.trim();
    const gateway = document.getElementById("net-gateway-input").value.trim();
    if (!name) return alert("Network name is required.");

    try {
      await API.createNetwork({ name, driver, subnet: subnet || undefined, gateway: gateway || undefined });
      App.closeModal();
      this.loadData();
    } catch (err) {
      alert(`Create network failed: ${err.message}`);
    }
  },

  async deleteVolume(name) {
    if (!confirm(`Delete volume '${name}'?`)) return;
    try {
      await API.deleteVolume(name);
      this.loadData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  },

  async deleteNetwork(id) {
    if (!confirm(`Delete network '${id}'?`)) return;
    try {
      await API.deleteNetwork(id);
      this.loadData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  },

  async pruneCurrent() {
    if (this.currentTab === "volumes") {
      if (!confirm("Prune all unused Docker volumes?")) return;
      try {
        const res = await API.pruneVolumes();
        alert(`Pruned ${res.volumes_deleted_count} volumes. Reclaimed ${res.space_reclaimed_mb} MB!`);
        this.loadData();
      } catch (err) {
        alert(`Prune failed: ${err.message}`);
      }
    } else {
      if (!confirm("Prune all unused Docker networks?")) return;
      try {
        const res = await API.pruneNetworks();
        alert(`Pruned ${res.networks_deleted_count} networks.`);
        this.loadData();
      } catch (err) {
        alert(`Prune failed: ${err.message}`);
      }
    }
  }
};
