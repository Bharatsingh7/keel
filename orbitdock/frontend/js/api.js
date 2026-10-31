/** OrbitDock REST API Client */
const API = {
  baseUrl: window.location.origin,

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { "Content-Type": "application/json", ...options.headers };
    try {
      const resp = await fetch(url, { ...options, headers });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.detail || data.message || `HTTP ${resp.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${path}]:`, err);
      throw err;
    }
  },

  // Containers
  getContainers: (all = true) => API.request(`/api/containers?all=${all}`),
  getContainerDetails: (id) => API.request(`/api/containers/${id}`),
  containerAction: (id, action) => API.request(`/api/containers/${id}/action?action=${action}`, { method: "POST" }),
  createContainer: (payload) => API.request("/api/containers", { method: "POST", body: JSON.stringify(payload) }),
  recreateContainer: (id, payload) => API.request(`/api/containers/${id}/recreate`, { method: "POST", body: JSON.stringify(payload) }),
  getContainerTop: (id) => API.request(`/api/containers/${id}/top`),

  // Images
  getImages: () => API.request("/api/images"),
  getImageLayers: (id) => API.request(`/api/images/${id}/layers`),
  pullImage: (image) => API.request("/api/images/pull", { method: "POST", body: JSON.stringify({ image }) }),
  deleteImage: (id, force = false) => API.request(`/api/images/${id}?force=${force}`, { method: "DELETE" }),
  pruneImages: (danglingOnly = true) => API.request(`/api/images/prune?dangling_only=${danglingOnly}`, { method: "POST" }),

  // Volumes
  getVolumes: () => API.request("/api/volumes"),
  createVolume: (payload) => API.request("/api/volumes", { method: "POST", body: JSON.stringify(payload) }),
  deleteVolume: (name, force = false) => API.request(`/api/volumes/${encodeURIComponent(name)}?force=${force}`, { method: "DELETE" }),
  pruneVolumes: () => API.request("/api/volumes/prune", { method: "POST" }),

  // Networks
  getNetworks: () => API.request("/api/networks"),
  createNetwork: (payload) => API.request("/api/networks", { method: "POST", body: JSON.stringify(payload) }),
  deleteNetwork: (id) => API.request(`/api/networks/${id}`, { method: "DELETE" }),
  pruneNetworks: () => API.request("/api/networks/prune", { method: "POST" }),

  // Stacks & Compose
  getStacks: () => API.request("/api/stacks"),
  getStack: (name) => API.request(`/api/stacks/${encodeURIComponent(name)}`),
  deployStack: (payload) => API.request("/api/stacks/deploy", { method: "POST", body: JSON.stringify(payload) }),
  downStack: (name) => API.request(`/api/stacks/${encodeURIComponent(name)}/down`, { method: "POST" }),
  composerize: (command) => API.request("/api/stacks/composerize", { method: "POST", body: JSON.stringify({ command }) }),

  // System
  getSystemInfo: () => API.request("/api/system/info"),
  getDiskUsage: () => API.request("/api/system/disk-usage"),
  pruneSystem: (allImages = false, volumes = false) => API.request(`/api/system/prune?all_images=${allImages}&volumes=${volumes}`, { method: "POST" }),
  getPresets: () => API.request("/api/system/presets"),
  getAuditLogs: (limit = 50) => API.request(`/api/system/audit-logs?limit=${limit}`)
};
