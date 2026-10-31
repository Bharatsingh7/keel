/** Composerize Modal: Convert `docker run` to Compose YAML & 1-Click Launch */
const ComposerizeModalComponent = {
  open() {
    const modalTitle = document.getElementById("modal-title");
    const modalBody = document.getElementById("modal-body");
    const modalFooter = document.getElementById("modal-footer");

    modalTitle.textContent = "Composerize: docker run ⇄ Compose";

    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label class="form-label">Paste any docker run command:</label>
          <textarea id="composerize-input" class="form-control" rows="3" placeholder="docker run -d -p 8080:80 --name web-server -v /data:/app nginx:alpine"></textarea>
          <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
            <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="ComposerizeModalComponent.convert()">Convert to Compose</button>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Generated Docker Compose YAML:</label>
            <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.72rem;" onclick="ComposerizeModalComponent.copyYaml()">Copy YAML</button>
          </div>
          <textarea id="composerize-output" class="form-control" rows="10" placeholder="Generated Compose YAML will appear here..." style="font-family: var(--font-mono); font-size: 0.82rem;"></textarea>
        </div>
      </div>
    `;

    modalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" id="btn-deploy-composerize" onclick="ComposerizeModalComponent.deployAsStack()">Deploy as Stack</button>
    `;

    App.openModalWindow();
  },

  async convert() {
    const input = document.getElementById("composerize-input").value.trim();
    if (!input) {
      alert("Please paste a docker run command.");
      return;
    }

    try {
      const res = await API.composerize(input);
      document.getElementById("composerize-output").value = res.compose_yaml;
    } catch (err) {
      alert(`Conversion error: ${err.message}`);
    }
  },

  copyYaml() {
    const output = document.getElementById("composerize-output").value;
    if (output) {
      navigator.clipboard.writeText(output);
      alert("Copied Compose YAML to clipboard!");
    }
  },

  async deployAsStack() {
    const yamlContent = document.getElementById("composerize-output").value.trim();
    if (!yamlContent) {
      alert("Please convert a command to Compose YAML first.");
      return;
    }

    const stackName = prompt("Enter a name for this new stack:", "imported-app");
    if (!stackName) return;

    try {
      await API.deployStack({ name: stackName, compose_yaml: yamlContent });
      alert(`Stack '${stackName}' deployed successfully!`);
      App.closeModal();
      App.navigate("stacks");
    } catch (err) {
      alert(`Deploy failed: ${err.message}`);
    }
  }
};
