/** Images Component: Image Management & Dive-Style Layer Efficiency Inspector */
const ImagesComponent = {
  images: [],

  render(container) {
    container.innerHTML = `
      <div class="view-container">
        <div class="toolbar">
          <div style="display: flex; align-items: center; gap: 14px;">
            <h2 style="font-size: 1.35rem; font-weight: 700;">Docker Images</h2>
            <span class="badge badge-blue" id="images-count-badge">0 Images</span>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="ImagesComponent.prune()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Prune Unused
            </button>
            <button class="btn btn-primary" onclick="ImagesComponent.openPullModal()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Pull Image
            </button>
          </div>
        </div>

        <div class="glass-panel" style="overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Image Tag / Repository</th>
                <th>Image ID</th>
                <th>Size</th>
                <th>Status</th>
                <th>Created</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="images-table-body">
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Loading images...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.loadImages();
  },

  async loadImages() {
    try {
      const data = await API.getImages();
      this.images = data.images;
      const countBadge = document.getElementById("images-count-badge");
      if (countBadge) countBadge.textContent = `${data.total} Images`;

      const tbody = document.getElementById("images-table-body");
      if (!tbody) return;

      if (this.images.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No images found on host.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.images.map(img => {
        const primaryTag = img.tags[0] || "<none>:<none>";
        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); font-size: 0.88rem;">${primaryTag}</div>
              ${img.tags.length > 1 ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${img.tags.slice(1).join(", ")}</div>` : ''}
            </td>
            <td><span class="badge badge-purple" style="font-family: var(--font-mono);">${img.id}</span></td>
            <td style="font-family: var(--font-mono); font-weight: 600;">${img.size_mb} MB</td>
            <td>
              <span class="badge ${img.in_use ? 'badge-emerald' : 'badge-amber'}">
                ${img.in_use ? 'In Use' : 'Unused'}
              </span>
            </td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(img.created).toLocaleDateString()}</td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="ImagesComponent.inspectLayers('${img.id}', '${primaryTag}')">
                  Layers (Dive)
                </button>
                <button class="btn btn-danger" style="padding: 4px 10px; font-size: 0.75rem;" onclick="ImagesComponent.deleteImage('${img.id}')">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.error("Failed to load images:", err);
    }
  },

  async inspectLayers(imageId, tag) {
    const drawerTitle = document.getElementById("drawer-title");
    const drawerBody = document.getElementById("drawer-body");
    drawerTitle.textContent = `Layer Analysis: ${tag}`;
    drawerBody.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Analyzing layer history & efficiency...</div>`;
    App.openDrawer();

    try {
      const data = await API.getImageLayers(imageId);
      drawerBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Dive Efficiency Score Banner -->
          <div class="glass-panel" style="padding: 20px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Dive Efficiency Score</div>
              <div style="font-size: 1.8rem; font-weight: 700; margin-top: 4px; color: ${data.efficiency_score >= 90 ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">
                ${data.efficiency_score}% Efficiency
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                Total Size: ${data.total_size_mb} MB • ${data.total_layers} layers • ${data.estimated_wasted_mb} MB suspected waste
              </div>
            </div>
            <span class="badge ${data.efficiency_score >= 90 ? 'badge-emerald' : 'badge-amber'}" style="font-size: 0.9rem; padding: 6px 14px;">
              ${data.findings.length} Optimization Findings
            </span>
          </div>

          <!-- Layers Breakdown Table -->
          <div>
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 10px;">Layer Breakdown</h3>
            <div class="glass-panel" style="overflow: hidden;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Size</th>
                    <th>Command</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.layers.map(l => `
                    <tr>
                      <td style="font-weight: 700;">${l.step}</td>
                      <td style="font-family: var(--font-mono); font-weight: 600; white-space: nowrap;">${l.size_mb} MB</td>
                      <td style="font-family: var(--font-mono); font-size: 0.78rem; max-width: 400px; word-break: break-all;">${l.command}</td>
                      <td>
                        ${l.issues.length > 0 ? l.issues.map(iss => `<span class="badge badge-rose" style="font-size: 0.7rem;">${iss}</span>`).join(" ") : '<span style="color: var(--text-muted); font-size: 0.75rem;">Clean</span>'}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      drawerBody.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Analysis failed: ${err.message}</div>`;
    }
  },

  openPullModal() {
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.getElementById("modal-footer");

    modalTitle.textContent = "Pull Image from Registry";
    modalBody.innerHTML = `
      <div class="form-group">
        <label class="form-label">Image Name and Tag:</label>
        <input type="text" id="pull-image-input" class="form-control" placeholder="e.g. redis:7-alpine, postgres:16, caddy:latest">
        <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">
          Pulls from Docker Hub or specified registry URL (e.g. ghcr.io/org/repo).
        </p>
      </div>
      <div id="pull-status-message" style="margin-top: 12px; font-size: 0.85rem;"></div>
    `;

    modalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-start-pull" onclick="ImagesComponent.startPull()">Pull Image</button>
    `;

    App.openModalWindow();
  },

  async startPull() {
    const input = document.getElementById("pull-image-input").value.trim();
    const btn = document.getElementById("btn-start-pull");
    const statusMsg = document.getElementById("pull-status-message");

    if (!input) {
      alert("Please enter an image name.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Pulling...";
    statusMsg.innerHTML = `<span style="color: var(--accent-blue);">Downloading image layers from registry...</span>`;

    try {
      await API.pullImage(input);
      statusMsg.innerHTML = `<span style="color: var(--accent-emerald);">✔ Successfully pulled ${input}!</span>`;
      setTimeout(() => {
        App.closeModal();
        ImagesComponent.loadImages();
      }, 1000);
    } catch (err) {
      statusMsg.innerHTML = `<span style="color: var(--accent-rose);">✖ Pull failed: ${err.message}</span>`;
      btn.disabled = false;
      btn.textContent = "Pull Image";
    }
  },

  async deleteImage(id) {
    if (!confirm(`Are you sure you want to delete image ${id}?`)) return;
    try {
      await API.deleteImage(id);
      await this.loadImages();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  },

  async prune() {
    if (!confirm("Remove all dangling and unused images?")) return;
    try {
      const res = await API.pruneImages(true);
      alert(`Pruned ${res.images_deleted_count} images. Reclaimed ${res.space_reclaimed_mb} MB!`);
      await this.loadImages();
    } catch (err) {
      alert(`Prune failed: ${err.message}`);
    }
  }
};
