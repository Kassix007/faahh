import * as vscode from "vscode";
import * as path from "path";
import { exec } from "child_process";

let previousErrorCount = 0;
let enabled = true;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("errorSoundPlayer");
  enabled = config.get<boolean>("enabled", true);

  // Toggle command
  const toggleCmd = vscode.commands.registerCommand(
    "errorSoundPlayer.toggle",
    () => {
      enabled = !enabled;
      vscode.window.showInformationMessage(
        `Error Sound Player: ${enabled ? "Enabled" : "Disabled"}`
      );
    }
  );
  context.subscriptions.push(toggleCmd);

  // Listen for diagnostics changes (errors/warnings in Problems pane)
  const diagnosticListener = vscode.languages.onDidChangeDiagnostics(
    (event: vscode.DiagnosticChangeEvent) => {
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
    }
  );

  context.subscriptions.push(diagnosticListener);

  // React to config changes
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("errorSoundPlayer.enabled")) {
      const updated = vscode.workspace.getConfiguration("errorSoundPlayer");
      enabled = updated.get<boolean>("enabled", true);
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

function playSound(context: vscode.ExtensionContext) {
  if (isPlaying) {
    return;
  }
  isPlaying = true;

  const soundFile = path.join(context.extensionPath, "effect.wav");
  const platform = process.platform;
  let command: string;

  if (platform === "win32") {
    const escaped = soundFile.replace(/'/g, "''");
    command = `powershell -NoProfile -Command "(New-Object Media.SoundPlayer '${escaped}').PlaySync()"`;
  } else if (platform === "darwin") {
    command = `afplay "${soundFile}"`;
  } else {
    command = `aplay "${soundFile}" 2>/dev/null || paplay "${soundFile}" 2>/dev/null || ffplay -nodisp -autoexit "${soundFile}" 2>/dev/null`;
  }

  exec(command, (err) => {
    isPlaying = false;
    if (err) {
      console.error("[Error Sound Player] Failed to play sound:", err.message);
    }
  });
}

export function deactivate() {
  // nothing to clean up
}
