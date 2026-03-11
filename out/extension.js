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
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
let previousErrorCount = 0;
let enabled = true;
function activate(context) {
    const config = vscode.workspace.getConfiguration("errorSoundPlayer");
    enabled = config.get("enabled", true);
    // Toggle command
    const toggleCmd = vscode.commands.registerCommand("errorSoundPlayer.toggle", () => {
        enabled = !enabled;
        vscode.window.showInformationMessage(`Error Sound Player: ${enabled ? "Enabled" : "Disabled"}`);
    });
    context.subscriptions.push(toggleCmd);
    // Listen for diagnostics changes (errors/warnings in Problems pane)
    const diagnosticListener = vscode.languages.onDidChangeDiagnostics((event) => {
        if (!enabled) {
            return;
        }
        // Count total errors across all files
        const allDiagnostics = vscode.languages.getDiagnostics();
        let currentErrorCount = 0;
        for (const [, diagnostics] of allDiagnostics) {
            for (const diag of diagnostics) {
                if (diag.severity === vscode.DiagnosticSeverity.Error) {
                    currentErrorCount++;
                }
            }
        }
        // Play sound only when new errors appear (count increased)
        if (currentErrorCount > previousErrorCount) {
            playSound(context);
        }
        previousErrorCount = currentErrorCount;
    });
    context.subscriptions.push(diagnosticListener);
    // React to config changes
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("errorSoundPlayer.enabled")) {
            const updated = vscode.workspace.getConfiguration("errorSoundPlayer");
            enabled = updated.get("enabled", true);
        }
    });
    context.subscriptions.push(configListener);
    // Initialise the previous error count so we don't fire on activation
    const allDiagnostics = vscode.languages.getDiagnostics();
    for (const [, diagnostics] of allDiagnostics) {
        for (const diag of diagnostics) {
            if (diag.severity === vscode.DiagnosticSeverity.Error) {
                previousErrorCount++;
            }
        }
    }
}
let isPlaying = false;
function playSound(context) {
    if (isPlaying) {
        return;
    }
    isPlaying = true;
    const soundFile = path.join(context.extensionPath, "effect.wav");
    const platform = process.platform;
    let command;
    if (platform === "win32") {
        const escaped = soundFile.replace(/'/g, "''");
        command = `powershell -NoProfile -Command "(New-Object Media.SoundPlayer '${escaped}').PlaySync()"`;
    }
    else if (platform === "darwin") {
        command = `afplay "${soundFile}"`;
    }
    else {
        command = `aplay "${soundFile}" 2>/dev/null || paplay "${soundFile}" 2>/dev/null || ffplay -nodisp -autoexit "${soundFile}" 2>/dev/null`;
    }
    (0, child_process_1.exec)(command, (err) => {
        isPlaying = false;
        if (err) {
            console.error("[Error Sound Player] Failed to play sound:", err.message);
        }
    });
}
function deactivate() {
    // nothing to clean up
}
//# sourceMappingURL=extension.js.map