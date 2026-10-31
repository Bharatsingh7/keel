/** Real-Time Streaming Logs Viewer (Single & Multi-Container with Regex Search) */
const LogsViewerComponent = {
  socket: null,
  autoScroll: true,
  logLines: [],
  regexFilter: null,
  containerId: null,
  containerName: "",

  open(containerId, containerName, isMulti = false, multiIds = []) {
    this.containerId = containerId;
    this.containerName = containerName;
    this.logLines = [];

    const drawerBody = document.getElementById("drawer-body");
    const drawerTitle = document.getElementById("drawer-title");
    drawerTitle.textContent = isMulti ? `Multi-Container Stream (${multiIds.length} services)` : `Logs: ${containerName}`;

    drawerBody.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- Logs Toolbar -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
            <input type="text" id="log-search-input" class="form-control" style="padding: 6px 12px; font-size: 0.82rem;" placeholder="Filter logs (regex supported)...">
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;">
              <input type="checkbox" id="log-autoscroll-chk" checked onchange="LogsViewerComponent.toggleAutoScroll(this.checked)"> Auto-scroll
            </label>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="LogsViewerComponent.clearLogs()">Clear</button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="LogsViewerComponent.downloadLogs()">Download</button>
          </div>
        </div>

        <!-- Log Terminal Box -->
        <div id="log-console-box" style="flex: 1; background: #07080c; border: 1px solid var(--glass-border); border-radius: 12px; padding: 14px; font-family: var(--font-mono); font-size: 0.82rem; overflow-y: auto; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap; word-break: break-all; min-height: 480px;">
          <div style="color: var(--text-muted);">Connecting to real-time log stream...</div>
        </div>
      </div>
    `;

    document.getElementById("log-search-input").addEventListener("input", (e) => {
      this.setRegexFilter(e.target.value);
    });

    App.openDrawer();
    this.connectSocket(isMulti, multiIds);
  },

  connectSocket(isMulti, multiIds) {
    if (this.socket) {
      this.socket.close();
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    let url = "";

    if (isMulti) {
      url = `${proto}//${host}/ws/multi-logs?ids=${multiIds.join(",")}`;
    } else {
      url = `${proto}//${host}/ws/containers/${this.containerId}/logs?tail=150&timestamps=true`;
    }

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      const box = document.getElementById("log-console-box");
      if (box) box.innerHTML = `<div style="color: var(--accent-emerald);">● Connected to stream</div>`;
    };

    this.socket.onmessage = (event) => {
      let lineText = "";
      let prefix = "";
      if (isMulti) {
        try {
          const item = JSON.parse(event.data);
          prefix = `[${item.container_name}] `;
          lineText = prefix + item.log;
        } catch {
          lineText = event.data;
        }
      } else {
        lineText = event.data;
      }

      this.logLines.push(lineText);
      if (this.logLines.length > 2000) {
        this.logLines.shift();
      }

      this.appendLogLine(lineText);
    };

    this.socket.onerror = (err) => {
      console.error("Log stream WebSocket error:", err);
    };

    this.socket.onclose = () => {
      const box = document.getElementById("log-console-box");
      if (box) {
        const div = document.createElement("div");
        div.style.color = "var(--text-muted)";
        div.textContent = "— Log stream disconnected —";
        box.appendChild(div);
      }
    };
  },

  appendLogLine(line) {
    const box = document.getElementById("log-console-box");
    if (!box) return;

    if (this.regexFilter && !this.regexFilter.test(line)) {
      return;
    }

    const div = document.createElement("div");
    div.textContent = line;
    box.appendChild(div);

    if (this.autoScroll) {
      box.scrollTop = box.scrollHeight;
    }
  },

  setRegexFilter(query) {
    if (!query) {
      this.regexFilter = null;
    } else {
      try {
        this.regexFilter = new RegExp(query, "i");
      } catch {
        this.regexFilter = null;
      }
    }
    this.refreshDisplayedLogs();
  },

  refreshDisplayedLogs() {
    const box = document.getElementById("log-console-box");
    if (!box) return;

    box.innerHTML = "";
    for (const line of this.logLines) {
      if (!this.regexFilter || this.regexFilter.test(line)) {
        const div = document.createElement("div");
        div.textContent = line;
        box.appendChild(div);
      }
    }
    if (this.autoScroll) {
      box.scrollTop = box.scrollHeight;
    }
  },

  toggleAutoScroll(enabled) {
    this.autoScroll = enabled;
  },

  clearLogs() {
    this.logLines = [];
    const box = document.getElementById("log-console-box");
    if (box) box.innerHTML = "";
  },

  downloadLogs() {
    const text = this.logLines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.containerName || 'container'}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
};
