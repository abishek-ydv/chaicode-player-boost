# Chaicode Player Boost

A focused Chrome extension for improving video playback on the Chaicode course player.

## Site Access

Chaicode Player Boost is intentionally active only on:

`https://courses.chaicode.com/*`

The toolbar popup remains accessible on other websites, but mode changes are disabled there with a clear warning. The extension does not inject scripts into unrelated sites or other Chaicode domains.

## Features

- Unlocked seeking and draggable seek bar support.
- Optional custom player controls.
- Normal player mode with seek-bar assist only.
- Native quality and fullscreen delegation.
- Keyboard shortcuts for playback, seeking, speed, mute, fullscreen, and hiding custom controls.
- Watermark hiding for a cleaner lecture view.

## Installation

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this extension directory.

## Development

- `manifest.json`: Extension metadata, permissions, and site matching.
- `unlock-seek.js`: Runs in the main world at `document_start` to unlock seeking behavior.
- `content.js`: Injects and manages the player controls.
- `overlay.css`: Styles the injected player controls.
- `popup.html`, `popup.css`, `popup.js`: Extension popup and mode selection.

After changes, reload the extension in `chrome://extensions/` and refresh the Chaicode course page.
