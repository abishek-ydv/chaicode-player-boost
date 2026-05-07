# ☕ Chaicode Player Boost

A powerful browser extension specifically engineered for the Chaicode learning platform to enhance the video playback and learning experience.

## 🧑‍💻 For Users

### 🌟 Features
- **Unlocked Seeking:** Bypasses native restrictions to allow free scrubbing through video timelines.
- **Custom Player Controls:** Toggles between standard and custom-built interface elements.
- **Native Delegation:** Grants you native control over video quality and fullscreen functionalities.
- **Keyboard Shortcuts:** Adds custom hotkeys for a smoother playback experience.
- **Decluttering:** Actively removes intrusive, hidden watermarks for a distraction-free view.

### 🚀 Installation
1. Open Chrome and go to `chrome://extensions/`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this directory.

---

## 🛠️ For Developers

### 🏗️ Architecture & Tech Stack
- **Environment:** Chrome Extension Manifest V3
- **Languages:** Vanilla HTML, CSS, JavaScript
- **Core Components:**
  - `content.js`: Main logic injected into Chaicode pages to override player UI.
  - `unlock-seek.js`: Injected into the `MAIN` world at `document_start` to intercept and bypass player restrictions.
  - `overlay.css`: Injects custom styles for the new player controls.
  - `popup.html`/`popup.js`: Manages user settings via `chrome.storage`.

### ⚙️ Development Setup
- The extension heavily relies on `MAIN` world scripting to bypass React/player state. Ensure changes to `unlock-seek.js` do not break the native player's event listeners.
- Reload the extension in `chrome://extensions/` and hard-refresh the Chaicode page to test DOM overrides.
