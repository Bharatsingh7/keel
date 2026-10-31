/** Interactive Web Terminal Component (Xterm.js + WebSocket PTY) */
const TerminalComponent = {
  term: null,
  socket: null,
  containerId: null,

  open(containerId, containerName, shell = "/bin/sh") {
    this.containerId = containerId;
    const drawerBody = document.getElementById("drawer-body");
    const drawerTitle = document.getElementById("drawer-title");
    drawerTitle.textContent = `Terminal: ${containerName}`;

    drawerBody.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge badge-emerald">Interactive PTY</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">${shell}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="TerminalComponent.switchShell('/bin/bash')">Switch to Bash</button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="TerminalComponent.switchShell('/bin/sh')">Switch to Sh</button>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="TerminalComponent.clearTerminal()">Clear</button>
          </div>
        </div>

        <div id="xterm-container" class="terminal-wrapper" style="flex: 1; min-height: 500px;"></div>
      </div>
    `;

    App.openDrawer();

    // Initialize Xterm after drawer is rendered
    setTimeout(() => {
      this.initXterm(shell);
    }, 100);
  },

  initXterm(shell) {
    if (this.term) {
      this.term.dispose();
    }
    if (this.socket) {
      this.socket.close();
    }

    const containerEl = document.getElementById("xterm-container");
    if (!containerEl) return;

    // Create Terminal instance
    this.term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SF Mono", "Fira Code", Menlo, monospace',
      theme: {
        background: '#090a0f',
        foreground: '#e2e8f0',
        cursor: '#3b82f6',
        selectionBackground: 'rgba(59, 130, 246, 0.35)',
        black: '#1e293b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc'
      }
    });

    this.term.open(containerEl);
    this.term.focus();

    // Connect WebSocket
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${proto}//${host}/ws/containers/${this.containerId}/terminal?shell=${encodeURIComponent(shell)}`;

    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = () => {
      this.term.writeln("\x1b[32m✔ Connected to container shell session.\x1b[0m\r\n");
      // Send initial dimensions
      this.sendResize();
    };

    this.socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        this.term.write(event.data);
      } else {
        const uint8 = new Uint8Array(event.data);
        this.term.write(uint8);
      }
    };

    this.socket.onerror = (err) => {
      this.term.writeln("\r\n\x1b[31mTerminal WebSocket error.\x1b[0m");
    };

    this.socket.onclose = () => {
      this.term.writeln("\r\n\x1b[33m— Session closed —\x1b[0m");
    };

    // Forward keystrokes to container
    this.term.onData((data) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(data);
      }
    });

    window.addEventListener("resize", () => this.sendResize());
  },

  sendResize() {
    if (!this.term || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const cols = this.term.cols;
    const rows = this.term.rows;
    this.socket.send(JSON.stringify({ type: "resize", cols, rows }));
  },

  switchShell(shell) {
    this.initXterm(shell);
  },

  clearTerminal() {
    if (this.term) this.term.clear();
  },

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.term) {
      this.term.dispose();
      this.term = null;
    }
  }
};
