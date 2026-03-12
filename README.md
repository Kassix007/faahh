# Faahh

Faahh can play audio from a dedicated webview panel when new errors appear in the VS Code Problems panel.

## Features

- Watches diagnostics for new errors.
- Plays `effect.wav` through a Faahh webview panel after audio has been armed.
- Falls back to a warning alert when the audio panel is not ready.
- Provides commands to open the audio panel and toggle alerts on and off.

## Command

- `Faahh: Toggle Alerts`
- `Faahh: Open Audio Panel`

## Setting

- `faahh.enabled`: Enable or disable alerts.

## Audio

Open the Faahh audio panel and click `Enable Audio` once. The panel must stay visible for webview audio playback to work reliably.