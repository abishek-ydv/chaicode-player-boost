const MODE_KEY = "cb-player-boost-player-mode";
const DEFAULT_MODE = "custom";
const summary = document.getElementById("mode-summary");
const toggle = document.getElementById("mode-toggle");
const modeCard = document.getElementById("mode-card");
const modeTitle = document.getElementById("mode-title");
const modeCopy = document.getElementById("mode-copy");
const modeButtons = Array.from(document.querySelectorAll("[data-player-mode]"));
let currentMode = DEFAULT_MODE;

function normalizeMode(mode) {
  return mode === "normal" ? "normal" : DEFAULT_MODE;
}

function render(mode) {
  currentMode = normalizeMode(mode);
  const isCustom = currentMode === "custom";

  document.body.dataset.mode = currentMode;
  toggle.dataset.mode = currentMode;
  modeCard.dataset.mode = currentMode;
  modeButtons.forEach((button) => {
    const selected = button.dataset.playerMode === currentMode;
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });

  modeTitle.textContent = isCustom ? "Custom player" : "Normal player";
  modeCopy.textContent = isCustom
    ? "Boost controls, shortcuts, speed, quality, fullscreen."
    : "Chaicode controls with draggable seek bar only.";
  summary.textContent = isCustom ? "Custom player enabled" : "Normal player enabled";
}

function saveMode(mode) {
  const nextMode = normalizeMode(mode);
  chrome.storage.local.set({ [MODE_KEY]: nextMode }, () => render(nextMode));
}

chrome.storage.local.get({ [MODE_KEY]: DEFAULT_MODE }, (items) => {
  render(items[MODE_KEY]);
});

toggle.addEventListener("click", (event) => {
  const option = event.target.closest("[data-player-mode]");
  if (!option) return;
  saveMode(option.dataset.playerMode);
});

toggle.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

  event.preventDefault();
  const nextMode = event.key === "ArrowLeft" || event.key === "Home" ? "normal" : "custom";
  saveMode(nextMode);
  modeButtons.find((button) => button.dataset.playerMode === nextMode)?.focus();
});
