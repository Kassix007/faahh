"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
let previousErrorCount = 0;
let enabled = true;
let currentExtensionUri;
function activate(context) {
    currentExtensionUri = context.extensionUri;
    const config = vscode.workspace.getConfiguration("faahh");
    enabled = config.get("enabled", true);
    const toggleCmd = vscode.commands.registerCommand("faahh.toggle", () => {
        enabled = !enabled;
        vscode.window.showInformationMessage(`Faahh alerts: ${enabled ? "Enabled" : "Disabled"}`);
    });
    context.subscriptions.push(toggleCmd);
    const openAudioPanelCmd = vscode.commands.registerCommand("faahh.openAudioPanel", () => {
        FaahhAudioPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(openAudioPanelCmd);
    const diagnosticListener = vscode.languages.onDidChangeDiagnostics(() => {
        if (!enabled) {
            return;
        }
        const allDiagnostics = vscode.languages.getDiagnostics();
        let currentErrorCount = 0;
        for (const [, diagnostics] of allDiagnostics) {
            for (const diag of diagnostics) {
                if (diag.severity === vscode.DiagnosticSeverity.Error) {
                    currentErrorCount++;
                }
            }
        }
        if (currentErrorCount > previousErrorCount) {
            const newErrorCount = currentErrorCount - previousErrorCount;
            if (FaahhAudioPanel.currentPanel?.canPlayAudio()) {
                void FaahhAudioPanel.currentPanel.playAudio();
            }
            else {
                void notifyAboutNewErrors(newErrorCount);
            }
        }
        previousErrorCount = currentErrorCount;
    });
    context.subscriptions.push(diagnosticListener);
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("faahh.enabled")) {
            const updated = vscode.workspace.getConfiguration("faahh");
            enabled = updated.get("enabled", true);
        }
    });
    context.subscriptions.push(configListener);
    const allDiagnostics = vscode.languages.getDiagnostics();
    for (const [, diagnostics] of allDiagnostics) {
        for (const diag of diagnostics) {
            if (diag.severity === vscode.DiagnosticSeverity.Error) {
                previousErrorCount++;
            }
        }
    }
}
function deactivate() {
}
async function notifyAboutNewErrors(newErrorCount) {
    const label = newErrorCount === 1 ? "1 new error" : `${newErrorCount} new errors`;
    const selection = await vscode.window.showWarningMessage(`Faahh detected ${label} in the Problems panel.`, "Open Problems", "Open Audio Panel");
    if (selection === "Open Problems") {
        await vscode.commands.executeCommand("workbench.actions.view.problems");
    }
    if (selection === "Open Audio Panel") {
        FaahhAudioPanel.createOrShow(currentExtensionUri);
    }
}
class FaahhAudioPanel {
    constructor(panel, extensionUri, disposables = []) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.disposables = disposables;
        this.audioArmed = false;
        this.panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        this.panel.webview.html = this.getHtml(this.panel.webview);
        this.panel.webview.onDidReceiveMessage((message) => {
            if (message.type === "armed") {
                this.audioArmed = true;
                void vscode.window.showInformationMessage("Faahh audio is armed for this panel.");
            }
            if (message.type === "playFailed" && message.reason) {
                void vscode.window.showWarningMessage(`Faahh could not play audio: ${message.reason}`);
            }
        }, undefined, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }
    static createOrShow(extensionUri) {
        if (FaahhAudioPanel.currentPanel) {
            FaahhAudioPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
            return FaahhAudioPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel("faahhAudio", "Faahh Audio", vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [extensionUri],
        });
        FaahhAudioPanel.currentPanel = new FaahhAudioPanel(panel, extensionUri);
        return FaahhAudioPanel.currentPanel;
    }
    canPlayAudio() {
        return this.audioArmed && this.panel.visible;
    }
    async playAudio() {
        await this.panel.webview.postMessage({ type: "play" });
    }
    dispose() {
        FaahhAudioPanel.currentPanel = undefined;
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }
    getHtml(webview) {
        const nonce = getNonce();
        const audioUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "effect.wav"));
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Faahh Audio</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
    }

    button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 8px 12px;
      cursor: pointer;
    }

    p {
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <h2>Faahh Audio Panel</h2>
  <p>Keep this panel visible and click the button once to allow audio playback.</p>
  <button id="arm">Enable Audio</button>
  <audio id="player" preload="auto" src="${audioUri}"></audio>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const player = document.getElementById('player');
    const armButton = document.getElementById('arm');

    armButton.addEventListener('click', async () => {
      try {
        player.currentTime = 0;
        await player.play();
        player.pause();
        player.currentTime = 0;
        vscode.postMessage({ type: 'armed' });
      } catch (error) {
        vscode.postMessage({
          type: 'playFailed',
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    });

    window.addEventListener('message', async (event) => {
      if (event.data?.type !== 'play') {
        return;
      }

      try {
        player.currentTime = 0;
        await player.play();
      } catch (error) {
        vscode.postMessage({
          type: 'playFailed',
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    });
  </script>
</body>
</html>`;
    }
}
function getNonce() {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    for (let index = 0; index < 32; index++) {
        value += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return value;
}
