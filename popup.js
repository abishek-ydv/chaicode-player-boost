const MODE_KEY = "cb-player-boost-player-mode";
const DEFAULT_MODE = "custom";
const summary = document.getElementById("mode-summary");
const toggle = document.getElementById("mode-toggle");
const modeCard = document.getElementById("mode-card");
const modeTitle = document.getElementById("mode-title");
const modeCopy = document.getElementById("mode-copy");
const modeButtons = Array.from(document.querySelectorAll("[data-player-mode]"));
let currentMode = DEFAULT_MODE;
let isCoursePage = false;

function normalizeMode(mode) {
  return mode === "normal" ? "normal" : DEFAULT_MODE;
}

function render(mode) {
  currentMode = normalizeMode(mode);
  const isCustom = currentMode === "custom";

  document.body.dataset.mode = currentMode;
  document.body.dataset.site = isCoursePage ? "course" : "unsupported";
  toggle.dataset.mode = currentMode;
  modeCard.dataset.mode = currentMode;
  modeCard.setAttribute("aria-disabled", String(!isCoursePage));
  toggle.setAttribute("aria-disabled", String(!isCoursePage));
  modeButtons.forEach((button) => {
    const selected = button.dataset.playerMode === currentMode;
    button.setAttribute("aria-checked", String(selected));
    button.disabled = !isCoursePage;
    button.tabIndex = isCoursePage && selected ? 0 : -1;
  });

  modeTitle.textContent = isCustom ? "Custom player" : "Normal player";
  modeCopy.textContent = isCustom
    ? "Boost controls, shortcuts, speed, quality, fullscreen."
    : "Chaicode controls with draggable seek bar only.";
  summary.textContent = isCoursePage
    ? isCustom ? "Custom mode selected" : "Normal mode selected"
    : "Open courses.chaicode.com";
  summary.disabled = isCoursePage;
  summary.setAttribute("aria-label", isCoursePage ? summary.textContent : "Open courses.chaicode.com");
}

function saveMode(mode) {
  if (!isCoursePage) return;
  const nextMode = normalizeMode(mode);
  chrome.storage.local.set({ [MODE_KEY]: nextMode }, () => render(nextMode));
}

function isCourseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "courses.chaicode.com";
  } catch {
    return false;
  }
}

function detectActiveSite(callback) {
  if (!chrome.tabs?.query) {
    callback(false);
    return;
  }

  chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      callback(false);
      return;
    }

    callback(isCourseUrl(tabs?.[0]?.url || ""));
  });
}

detectActiveSite((allowed) => {
  isCoursePage = allowed;
  chrome.storage.local.get({ [MODE_KEY]: DEFAULT_MODE }, (items) => {
    render(items[MODE_KEY]);
  });
});

toggle.addEventListener("click", (event) => {
  const option = event.target.closest("[data-player-mode]");
  if (!option) return;
  saveMode(option.dataset.playerMode);
});

summary.addEventListener("click", () => {
  if (isCoursePage) return;
  chrome.tabs?.create?.({ url: "https://courses.chaicode.com/" });
});

toggle.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  if (!isCoursePage) return;

  event.preventDefault();
  const nextMode = event.key === "ArrowLeft" || event.key === "Home" ? "normal" : "custom";
  saveMode(nextMode);
  modeButtons.find((button) => button.dataset.playerMode === nextMode)?.focus();
});
