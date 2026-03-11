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
    const config = vscode.workspace.getConfiguration("faahh");
    enabled = config.get("enabled", true);
    const toggleCmd = vscode.commands.registerCommand("faahh.toggle", () => {
        enabled = !enabled;
        vscode.window.showInformationMessage(`Faahh: ${enabled ? "Enabled" : "Disabled"}`);
    });
    context.subscriptions.push(toggleCmd);
    const diagnosticListener = vscode.languages.onDidChangeDiagnostics((event) => {
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
            playSound(context);
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
let isPlaying = false;
function playSound(context) {
    if (isPlaying) {
        return;
    }
    isPlaying = true;
    const soundFile = path.join(context.extensionPath, "effect.wav");
    const players = getPlayers(soundFile);
    playWithFallback(players, 0);
}
function deactivate() {
}
function getPlayers(soundFile) {
    if (process.platform === "win32") {
        return [
            {
                command: "powershell.exe",
                args: [
                    "-NoProfile",
                    "-Command",
                    "$player = New-Object System.Media.SoundPlayer $args[0]; $player.PlaySync()",
                    soundFile,
                ],
            },
        ];
    }
    if (process.platform === "darwin") {
        return [
            {
                command: "afplay",
                args: [soundFile],
            },
        ];
    }
    return [
        {
            command: "aplay",
            args: [soundFile],
        },
        {
            command: "paplay",
            args: [soundFile],
        },
        {
            command: "ffplay",
            args: ["-nodisp", "-autoexit", soundFile],
        },
    ];
}
function playWithFallback(players, index) {
    if (index >= players.length) {
        isPlaying = false;
        console.error("[Faahh] Failed to play sound: no compatible audio player was available.");
        return;
    }
    const player = players[index];
    (0, child_process_1.execFile)(player.command, player.args, (err) => {
        if (!err) {
            isPlaying = false;
            return;
        }
        playWithFallback(players, index + 1);
    });
}
