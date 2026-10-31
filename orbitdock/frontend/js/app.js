/** OrbitDock Main App Controller & Router */
const App = {
  currentView: "dashboard",
  theme: "dark",

  init() {
    this.setupTheme();
    this.setupNavigation();
    this.setupKeyboardShortcuts();
    this.navigate("dashboard");

    // Start background polling for stats gauges
    setInterval(() => this.pollGauges(), 5000);
  },

  setupTheme() {
    const savedTheme = localStorage.getItem("orbitdock_theme") || "dark";
    this.setTheme(savedTheme);

    const toggleBtn = document.getElementById("theme-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.setTheme(this.theme === "dark" ? "light" : "dark");
      });
    }
  },

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("orbitdock_theme", theme);
    const icon = document.getElementById("theme-toggle-icon");
    if (icon) {
      icon.innerHTML = theme === "dark" 
        ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
        : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
  },

  setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const view = item.getAttribute("data-view");
        this.navigate(view);
      });
    });
  },

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // '/' to focus search input
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        const searchInput = document.getElementById("container-search");
        if (searchInput) searchInput.focus();
      }
      // 'Escape' closes modal and drawer
      if (e.key === "Escape") {
        this.closeModal();
        this.closeDrawer();
      }
    });
  },

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.getAttribute("data-view") === view);
    });

    const contentArea = document.getElementById("main-content-view");
    if (!contentArea) return;

    if (view === "dashboard") {
      DashboardComponent.render(contentArea);
    } else if (view === "containers") {
      ContainersComponent.render(contentArea);
    } else if (view === "stacks") {
      StacksComponent.render(contentArea);
    } else if (view === "images") {
      ImagesComponent.render(contentArea);
    } else if (view === "volumes") {
      VolumesNetworksComponent.render(contentArea, "volumes");
    } else if (view === "networks") {
      VolumesNetworksComponent.render(contentArea, "networks");
    } else if (view === "advisor") {
      SmartAdvisorComponent.render(contentArea);
    }
  },

  updateGauges(cpuPct, ramPct, diskPct) {
    const setRing = (id, pct, color) => {
      const circle = document.getElementById(`gauge-${id}-circle`);
      const text = document.getElementById(`gauge-${id}-text`);
      if (!circle || !text) return;
      text.textContent = `${Math.round(pct)}%`;
      const circumference = 2 * Math.PI * 13; // r=13
      const offset = circumference - (pct / 100 * circumference);
      circle.style.strokeDasharray = `${circumference}`;
      circle.style.strokeDashoffset = `${offset}`;
      circle.style.stroke = color;
    };

    setRing("cpu", cpuPct || 0, "#3b82f6");
    setRing("ram", ramPct || 0, "#10b981");
    setRing("disk", diskPct || 0, "#8b5cf6");
  },

  async pollGauges() {
    try {
      const sys = await API.getSystemInfo();
      this.updateGauges(sys.host.cpu_percent, sys.host.ram_percent, sys.host.disk_percent);
    } catch (err) {
      console.debug("Gauge poll error:", err);
    }
  },

  // Modal controller
  openModal(type) {
    if (type === "create-container") {
      ContainerModalComponent.open("create");
    } else if (type === "composerize") {
      ComposerizeModalComponent.open();
    }
  },

  openRecreateModal(containerId) {
    this.closeDrawer();
    ContainerModalComponent.open("recreate", containerId);
  },

  openModalWindow() {
    const backdrop = document.getElementById("main-modal-backdrop");
    if (backdrop) backdrop.classList.add("open");
  },

  closeModal() {
    const backdrop = document.getElementById("main-modal-backdrop");
    if (backdrop) backdrop.classList.remove("open");
  },

  // Drawer controller
  openDrawer() {
    const backdrop = document.getElementById("main-drawer-backdrop");
    if (backdrop) backdrop.classList.add("open");
  },

  closeDrawer() {
    const backdrop = document.getElementById("main-drawer-backdrop");
    if (backdrop) backdrop.classList.remove("open");
    LogsViewerComponent.close();
    TerminalComponent.close();
  },

  async openContainerDetails(containerId) {
    const drawerTitle = document.getElementById("drawer-title");
    const drawerBody = document.getElementById("drawer-body");
    drawerTitle.textContent = "Container Details";
    drawerBody.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Inspecting container...</div>`;
    this.openDrawer();

    try {
      const data = await API.getContainerDetails(containerId);
      ContainerDetailComponent.render(drawerBody, data);
    } catch (err) {
      drawerBody.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Inspect failed: ${err.message}</div>`;
    }
  },

  openLogs(containerId, containerName) {
    LogsViewerComponent.open(containerId, containerName);
  },

  openMultiLogs(ids) {
    LogsViewerComponent.open(null, null, true, ids);
  },

  openTerminal(containerId, containerName) {
    TerminalComponent.open(containerId, containerName);
  },

  async launchPreset(presetId) {
    try {
      const data = await API.getPresets();
      const preset = data.presets.find(p => p.id === presetId);
      if (!preset) return;

      const containerName = prompt(`Enter container name for ${preset.name}:`, preset.id);
      if (!containerName) return;

      const payload = {
        name: containerName,
        image: preset.image,
        command: preset.command,
        ports: [{ host_port: preset.default_port, container_port: preset.container_port }],
        volumes: preset.volumes.map(v => ({ host_path: v.host_path, container_path: v.container_path })),
        env: preset.env ? preset.env.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) : {},
        restart_policy: preset.restart_policy
      };

      await API.createContainer(payload);
      alert(`Successfully launched ${preset.name} container '${containerName}' on port ${preset.default_port}!`);
      this.navigate("containers");
    } catch (err) {
      alert(`Quick deploy failed: ${err.message}`);
    }
  },

  async triggerPrune() {
    if (!confirm("Run 1-Click Smart System Prune? This will remove stopped containers, dangling images, and build cache.")) return;
    try {
      const res = await API.pruneSystem(false, false);
      alert(`Prune complete! Reclaimed ${res.total_reclaimed_mb} MB of disk space.`);
      this.navigate("dashboard");
    } catch (err) {
      alert(`Prune failed: ${err.message}`);
    }
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());
