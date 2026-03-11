import * as vscode from "vscode";
import * as path from "path";
import { execFile } from "child_process";

let previousErrorCount = 0;
let enabled = true;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("faahh");
  enabled = config.get<boolean>("enabled", true);

  const toggleCmd = vscode.commands.registerCommand(
    "faahh.toggle",
    () => {
      enabled = !enabled;
      vscode.window.showInformationMessage(
        `Faahh: ${enabled ? "Enabled" : "Disabled"}`
      );
    }
  );
  context.subscriptions.push(toggleCmd);

  const diagnosticListener = vscode.languages.onDidChangeDiagnostics(
    (event: vscode.DiagnosticChangeEvent) => {
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
    }
  );

  context.subscriptions.push(diagnosticListener);

  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("faahh.enabled")) {
      const updated = vscode.workspace.getConfiguration("faahh");
      enabled = updated.get<boolean>("enabled", true);
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

type PlayerCommand = {
  command: string;
  args: string[];
};

function playSound(context: vscode.ExtensionContext) {
  if (isPlaying) {
    return;
  }
  isPlaying = true;

  const soundFile = path.join(context.extensionPath, "effect.wav");
  const players = getPlayers(soundFile);

  playWithFallback(players, 0);
}

export function deactivate() {
}

function getPlayers(soundFile: string): PlayerCommand[] {
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

function playWithFallback(players: PlayerCommand[], index: number) {
  if (index >= players.length) {
    isPlaying = false;
    console.error("[Faahh] Failed to play sound: no compatible audio player was available.");
    return;
  }

  const player = players[index];
  execFile(player.command, player.args, (err) => {
    if (!err) {
      isPlaying = false;
      return;
    }

    playWithFallback(players, index + 1);
  });
}
