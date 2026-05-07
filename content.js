(function () {
  const INSTANCE_KEY = "__cbPlayerBoostCustomControls";
  const ACTIVE_ATTR = "data-cb-active-video";
  const CONTROLS_ID = "cb-player-controls";
  const LEGACY_BAR_ID = "cb-bar";
  const SCAN_DEBOUNCE_MS = 150;
  const SCAN_INTERVAL_MS = 1500;
  const FAST_SCAN_INTERVAL_MS = 250;
  const FAST_SCAN_LIMIT = 40;
  const CONTROLS_IDLE_MS = 2200;
  const STORAGE_SPEED_KEY = "cb-player-boost-speed";
  const STORAGE_ENABLED_KEY = "cb-player-boost-enabled";
  const STORAGE_ARROW_SKIP_KEY = "cb-player-boost-arrow-skip";
  const STORAGE_TIME_MODE_KEY = "cb-player-boost-time-mode";
  const STORAGE_PLAYER_MODE_KEY = "cb-player-boost-player-mode";
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const QUALITY_FALLBACKS = ["Auto", "High", "Medium", "Low"];
  const QUALITY_RE = /^(auto|high|medium|low)$/i;
  const TIME_MODES = ["passed", "remaining", "total"];
  const PLAYER_MODES = {
    CUSTOM: "custom",
    NORMAL: "normal",
  };

  if (window[INSTANCE_KEY]) return;
  window[INSTANCE_KEY] = true;

  let video = null;
  let controls = null;
  let nativeControlsRoot = null;
  let nativeControlsRoots = new Set();
  let scanTimer = null;
  let updateRaf = 0;
  let activeSeekPointer = null;
  let lastForcedSeekAt = 0;
  let lastForcedSeekTime = -1;
  let qualityMenuOpen = false;
  let settingsMenuOpen = false;
  let controlsIdleTimer = null;
  let controlsAreIdle = false;
  let controlsFocusPinned = false;
  let lastControlsPointerAt = 0;
  let playerMode = PLAYER_MODES.CUSTOM;
  let temporaryNormalMode = false;
  let customControlsEnabled = true;
  let arrowSkipSeconds = 10;
  let timeMode = "passed";
  let activeNativeSeekPointer = null;
  let activeNativeSeekBar = null;
  const nativeSeekBars = new WeakSet();
  const nativeProxyStyles = new WeakMap();

  const ui = {
    play: null,
    back30: null,
    back10: null,
    forward10: null,
    forward30: null,
    progress: null,
    fill: null,
    thumb: null,
    time: null,
    mute: null,
    quality: null,
    qualityMenu: null,
    speed: null,
    settings: null,
    settingsMenu: null,
    fullscreen: null,
  };

  const VIDEO_EVENTS = [
    "loadedmetadata",
    "durationchange",
    "timeupdate",
    "progress",
    "play",
    "pause",
    "volumechange",
    "ratechange",
    "seeking",
    "seeked",
  ];

  function icon(name) {
    const icons = {
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.75v12.5l10-6.25-10-6.25z"></path></svg>',
      pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7V5zm6.4 0H17v14h-3.6V5z"></path></svg>',
      rewind30: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M157.744 572.834c22.443-7.125 46.421 5.291 53.589 27.733 39.979 125.696 157.653 210.091 292.82 210.091 169.045 0 306.517-133.973 306.517-298.667 0-164.65-137.472-298.666-306.517-298.666-73.728 0-143.274 25.685-198.186 71.253l92.416-15.232c23.467-4.267 45.226 11.904 49.066 35.115 3.84 23.253-11.904 45.227-35.156 49.024l-181.163 29.952c-23.04 3.797-44.971-11.733-49.323-34.176l-32.171-170.667c-4.352-23.168 10.88-45.525 34.048-49.835 23.083-4.181 45.483 10.88 49.835 34.005l11.605 61.483c70.997-61.483 162.005-96.256 258.602-96.256 216.064 0 391.851 172.245 391.851 383.999s-175.787 384-391.851 384c-172.458 0-322.815-108.331-374.143-269.568-7.125-22.443 5.291-46.421 27.733-53.589z"></path><text x="512" y="620" text-anchor="middle" dominant-baseline="middle" font-size="245" font-weight="800">30</text></svg>',
      forward30: '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M866.261 572.834c-22.443-7.125-46.421 5.291-53.589 27.733-39.979 125.696-157.653 210.091-292.821 210.091-169.045 0-306.517-133.973-306.517-298.667 0-164.65 137.472-298.666 306.517-298.666 73.728 0 143.275 25.685 198.187 71.253l-92.416-15.232c-23.467-4.267-45.227 11.904-49.067 35.115-3.84 23.253 11.904 45.227 35.157 49.024l181.163 29.952c23.04 3.797 44.971-11.733 49.323-34.176l32.171-170.667c4.352-23.168-10.88-45.525-34.048-49.835-23.083-4.181-45.483 10.88-49.835 34.005l-11.605 61.483c-70.997-61.483-162.005-96.256-258.603-96.256-216.064 0-391.851 172.245-391.851 383.999s175.787 384 391.851 384c172.459 0 322.816-108.331 374.144-269.568 7.125-22.443-5.291-46.421-27.733-53.589z"></path><text x="512" y="620" text-anchor="middle" dominant-baseline="middle" font-size="245" font-weight="800">30</text></svg>',
      volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.25h3.45L12 5.2v13.6l-4.55-4.05H4v-5.5zm11.3-1.7 1.2-1.2a7.9 7.9 0 0 1 0 11.3l-1.2-1.2a6.2 6.2 0 0 0 0-8.9zm2.65-2.65 1.2-1.2a11.65 11.65 0 0 1 0 16.6l-1.2-1.2a9.95 9.95 0 0 0 0-14.2z"></path></svg>',
      muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.25h3.45L12 5.2v13.6l-4.55-4.05H4v-5.5zm12.7 2.75 2.45-2.45 1.3 1.3L18 13.3l2.45 2.45-1.3 1.3-2.45-2.45-2.45 2.45-1.3-1.3 2.45-2.45-2.45-2.45 1.3-1.3L16.7 12z"></path></svg>',
      fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 3v-3h2v5h-5v-2h3z"></path></svg>',
      exitFullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8H5V6h5v5H8V8zm8 0v3h-2V6h5v2h-3zM8 16v-3h2v5H5v-2h3zm8 0h3v2h-5v-5h2v3z"></path></svg>',
      settings: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z" fill="none" stroke="currentColor" stroke-width="1.5"></path></svg>',
    };

    if (name === "rewind10") return icons.rewind30.replace(">30<", ">10<");
    if (name === "forward10") return icons.forward30.replace(">30<", ">10<");
    return icons[name] || "";
  }

  function removeOldControls() {
    document.getElementById(LEGACY_BAR_ID)?.remove();
    document.getElementById("cb-back-30-slot")?.remove();
    document.getElementById("cb-forward-30-slot")?.remove();
    document.getElementById("cb-back-30")?.remove();
    document.getElementById("cb-forward-30")?.remove();
  }

  function hideWatermarks(root = document) {
    const watermarks = [];

    try {
      watermarks.push(...root.querySelectorAll?.('[id^="watermark-slide-"]') || []);
    } catch {
      // Ignore detached or restricted roots.
    }

    watermarks.forEach((item) => {
      item.classList.add("cb-watermark-hidden");
      item.setAttribute("aria-hidden", "true");

      const parent = item.closest("p");
      if (parent) {
        parent.classList.add("cb-watermark-hidden");
        parent.setAttribute("aria-hidden", "true");
      }
    });
  }

  function addVideo(out, seen, el) {
    if (!el || seen.has(el)) return;
    seen.add(el);
    out.push(el);
  }

  function collectVideos() {
    const out = [];
    const seen = new Set();

    function visit(node) {
      if (!node) return;

      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === "VIDEO") {
          addVideo(out, seen, node);
        }

        if (node.shadowRoot) {
          visit(node.shadowRoot);
        }

        if (node.tagName === "IFRAME") {
          try {
            const doc = node.contentDocument;
            if (doc && doc.documentElement) visit(doc.documentElement);
          } catch {
            // Cross-origin frames are handled by the all_frames content script.
          }
        }
      }

      const children = node.children;
      if (!children) return;

      for (let i = 0; i < children.length; i += 1) {
        visit(children[i]);
      }
    }

    if (document.documentElement) visit(document.documentElement);
    return out;
  }

  function scoreVideo(item) {
    const rect = item.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const hasMetadata = Number.isFinite(item.duration) && item.duration > 0 ? 1 : 0;
    const readyScore = item.readyState >= 2 ? 2 : item.readyState >= 1 ? 1 : 0;
    const visibleScore = rect.width > 0 && rect.height > 0 ? 1 : 0;

    return readyScore * 100 + hasMetadata * 50 + visibleScore * 50 + area / 1000;
  }

  function findVideo() {
    const videos = collectVideos().filter((item) => item.isConnected);
    if (!videos.length) return null;

    return videos
      .map((item) => ({
        item,
        score: scoreVideo(item) + (item.hasAttribute(ACTIVE_ATTR) ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0].item;
  }

  function isBoxed(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getVideoRect() {
    return video ? video.getBoundingClientRect() : null;
  }

  function rectIntersectsVideo(rect) {
    const videoRect = getVideoRect();
    if (!videoRect) return false;

    return (
      rect.right >= videoRect.left &&
      rect.left <= videoRect.right &&
      rect.bottom >= videoRect.top &&
      rect.top <= videoRect.bottom
    );
  }

  function isInControlBand(clientY) {
    const videoRect = getVideoRect();
    if (!videoRect) return false;

    const bandHeight = Math.min(160, Math.max(90, videoRect.height * 0.24));
    return clientY >= videoRect.bottom - bandHeight && clientY <= videoRect.bottom + 12;
  }

  function findNativeControlsRoots() {
    const roots = new Set();
    const fullscreenElement = getFullscreenElement();
    const fullscreenRect = fullscreenElement?.getBoundingClientRect() || null;
    const bars = Array.from(document.querySelectorAll(".player-progress-bar"))
      .filter((bar) => {
        if (!isBoxed(bar)) return false;
        if (fullscreenElement && !fullscreenElement.contains(bar)) return false;
        const rect = bar.getBoundingClientRect();
        return fullscreenRect ? rect.bottom >= fullscreenRect.bottom - 220 : rectIntersectsVideo(rect);
      });

    for (const bar of bars) {
      for (let el = bar; el && el !== document.body; el = el.parentElement) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const nearFullscreenBottom = fullscreenRect && rect.bottom >= fullscreenRect.bottom - 220;
        const looksLikeBottomLayer =
          (style.position === "absolute" || style.position === "fixed") &&
          rect.width > 120 &&
          rect.height <= 180 &&
          (nearFullscreenBottom || (rectIntersectsVideo(rect) && isInControlBand(rect.top + rect.height / 2)));

        if (looksLikeBottomLayer) {
          roots.add(el);
          break;
        }
      }
    }

    return Array.from(roots);
  }

  function restoreNativeControls() {
    document.documentElement.classList.remove("cb-player-boost-controls-on");
    nativeControlsRoots.forEach((root) => {
      root.classList.remove("cb-chaicode-native-hidden");
      root.classList.remove("cb-native-controls-muted");
    });
    nativeControlsRoots = new Set();
    nativeControlsRoot = null;
    clearNativeProxies();
  }

  function isCustomPlayerMode() {
    return playerMode === PLAYER_MODES.CUSTOM && !temporaryNormalMode && customControlsEnabled;
  }

  function shouldShowCustomControls() {
    return isCustomPlayerMode();
  }

  function hideNativeControls() {
    if (!shouldShowCustomControls()) {
      restoreNativeControls();
      return;
    }

    document.documentElement.classList.add("cb-player-boost-controls-on");
    const nextRoots = new Set(findNativeControlsRoots());

    nativeControlsRoots.forEach((root) => {
      if (!nextRoots.has(root)) {
        root.classList.remove("cb-chaicode-native-hidden");
        root.classList.remove("cb-native-controls-muted");
      }
    });

    nextRoots.forEach((root) => {
      root.classList.remove("cb-chaicode-native-hidden");
      root.classList.add("cb-native-controls-muted");
    });

    nativeControlsRoots = nextRoots;
    nativeControlsRoot = nextRoots.values().next().value || null;
    syncNativeControlProxies();
  }

  function getFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function findPlayerElement() {
    if (!video) return null;

    const viewportArea = window.innerWidth * window.innerHeight;
    const candidates = [];

    for (let el = video; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (!el.contains(video)) continue;

      const area = rect.width * rect.height;
      const reasonablePlayer =
        rect.width >= Math.min(window.innerWidth * 0.55, video.getBoundingClientRect().width) &&
        rect.height >= video.getBoundingClientRect().height &&
        area <= viewportArea * 1.15;

      if (reasonablePlayer) candidates.push({ el, area });
    }

    if (nativeControlsRoot) {
      for (let el = nativeControlsRoot; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (!el.contains(video)) continue;
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (rect.width > 0 && rect.height > 0 && area <= viewportArea * 1.15) {
          candidates.push({ el, area: area + 1 });
        }
      }
    }

    candidates.sort((a, b) => b.area - a.area);
    return candidates[0]?.el || video.parentElement || video;
  }

  function lowestCommonAncestor(a, b) {
    if (!(a instanceof Element) || !(b instanceof Element)) return null;

    const ancestors = new Set();
    for (let el = a; el; el = el.parentElement) {
      ancestors.add(el);
    }

    for (let el = b; el; el = el.parentElement) {
      if (ancestors.has(el)) return el;
    }

    return null;
  }

  function findFullscreenTarget(nativeControl) {
    if (!video) return null;

    const viewportArea = window.innerWidth * window.innerHeight;
    const videoRect = video.getBoundingClientRect();
    const candidates = [];
    const common = lowestCommonAncestor(video, nativeControl);

    for (let el = common; el && el !== document.documentElement; el = el.parentElement) {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const containsVideo = el.contains(video);
      const reasonable =
        containsVideo &&
        rect.width >= videoRect.width * 0.9 &&
        rect.height >= videoRect.height * 0.9 &&
        area >= videoRect.width * videoRect.height &&
        area <= viewportArea * 1.15;

      if (reasonable) candidates.push({ el, area });
    }

    const fallback = findPlayerElement();
    if (fallback) {
      const rect = fallback.getBoundingClientRect();
      candidates.push({ el: fallback, area: rect.width * rect.height });
    }

    candidates.sort((a, b) => a.area - b.area);
    return candidates[0]?.el || video.parentElement || video;
  }

  function fmt(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    const pad = (value) => String(value).padStart(2, "0");

    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function formatRate(rate) {
    return Number.isInteger(rate) ? `${rate}x` : `${parseFloat(rate.toFixed(2))}x`;
  }

  function formatTimeDisplay(current, duration) {
    if (timeMode === "remaining") {
      return `-${fmt(Math.max(0, duration - current))}`;
    }

    if (timeMode === "total") {
      return fmt(duration);
    }

    return `${fmt(current)} / ${fmt(duration)}`;
  }

  function timeModeLabel() {
    if (timeMode === "remaining") return "Remaining time";
    if (timeMode === "total") return "Total duration";
    return "Elapsed time";
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function isVisibleElement(el) {
    if (!(el instanceof Element) || !isBoxed(el)) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function readStoredString(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeStoredString(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Storage can be unavailable in restricted frames.
    }
  }

  function loadSettings() {
    customControlsEnabled = readStoredString(STORAGE_ENABLED_KEY, "true") !== "false";

    const storedSkip = Number(readStoredString(STORAGE_ARROW_SKIP_KEY, "10"));
    arrowSkipSeconds = storedSkip === 30 ? 30 : 10;

    const storedMode = readStoredString(STORAGE_TIME_MODE_KEY, "passed");
    timeMode = TIME_MODES.includes(storedMode) ? storedMode : "passed";
  }

  function normalizePlayerMode(mode) {
    return mode === PLAYER_MODES.NORMAL ? PLAYER_MODES.NORMAL : PLAYER_MODES.CUSTOM;
  }

  function getChromeStorage() {
    try {
      return chrome?.storage?.local || null;
    } catch {
      return null;
    }
  }

  function readPlayerMode(callback) {
    const storage = getChromeStorage();
    if (!storage) {
      callback(PLAYER_MODES.CUSTOM);
      return;
    }

    storage.get({ [STORAGE_PLAYER_MODE_KEY]: PLAYER_MODES.CUSTOM }, (items) => {
      callback(normalizePlayerMode(items?.[STORAGE_PLAYER_MODE_KEY]));
    });
  }

  function setPlayerMode(nextMode) {
    const mode = normalizePlayerMode(nextMode);
    applyPlayerMode(mode);
    scheduleScan();

    const storage = getChromeStorage();
    if (!storage) return;

    storage.set({ [STORAGE_PLAYER_MODE_KEY]: mode });
  }

  function refreshPlayerModeState() {
    document.documentElement.classList.toggle("cb-player-boost-normal-mode", playerMode === PLAYER_MODES.NORMAL);
    document.documentElement.classList.toggle("cb-player-boost-temporary-normal-mode", temporaryNormalMode);
    document.documentElement.classList.toggle("cb-player-boost-custom-mode", shouldShowCustomControls());

    if (shouldShowCustomControls()) {
      hideNativeControls();
      revealControls(true);
    } else {
      closeMenus();
      clearControlsIdleTimer();
      setControlsIdle(false);
      controls?.classList.remove("cb-visible");
      restoreNativeControls();
    }

    requestUiUpdate();
  }

  function applyPlayerMode(nextMode) {
    playerMode = normalizePlayerMode(nextMode);
    temporaryNormalMode = false;
    customControlsEnabled = playerMode === PLAYER_MODES.CUSTOM;
    saveEnabledSetting();
    refreshPlayerModeState();
  }

  function bindPlayerModeListener() {
    try {
      chrome?.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[STORAGE_PLAYER_MODE_KEY]) return;
        applyPlayerMode(changes[STORAGE_PLAYER_MODE_KEY].newValue);
        scheduleScan();
      });
    } catch {
      // Extension storage can be unavailable in restricted frames.
    }
  }

  function saveEnabledSetting() {
    writeStoredString(STORAGE_ENABLED_KEY, customControlsEnabled ? "true" : "false");
  }

  function saveArrowSkipSetting() {
    writeStoredString(STORAGE_ARROW_SKIP_KEY, String(arrowSkipSeconds));
  }

  function saveTimeModeSetting() {
    writeStoredString(STORAGE_TIME_MODE_KEY, timeMode);
  }

  function clampTime(time) {
    if (!video || !Number.isFinite(time)) return 0;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;
    return Math.max(0, Math.min(duration, time));
  }

  function forceSeek(time) {
    if (!video) return;

    const nextTime = clampTime(time);
    const now = performance.now();
    const duplicate =
      Math.abs(nextTime - lastForcedSeekTime) < 0.05 &&
      now - lastForcedSeekAt < 80;

    if (duplicate) return;

    lastForcedSeekAt = now;
    lastForcedSeekTime = nextTime;

    document.dispatchEvent(new CustomEvent("cb-force-seek", { detail: nextTime }));

    try {
      video.currentTime = nextTime;
      video.dispatchEvent(new Event("timeupdate"));
    } catch {
      // The main-world helper normally handles this path.
    }

    requestUiUpdate();
  }

  function skipBy(delta) {
    if (!video) return;
    forceSeek(video.currentTime + delta);
  }

  function seekFromNativeBar(event, bar) {
    if (!video || !bar || !Number.isFinite(video.duration) || video.duration <= 0) return;

    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;

    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    forceSeek(video.duration * pct);
  }

  function shouldAssistNativeSeek() {
    return (playerMode === PLAYER_MODES.NORMAL || temporaryNormalMode || !customControlsEnabled) && Boolean(video);
  }

  function stopNativeSeekEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function onNativeSeekPointerDown(event) {
    if (!shouldAssistNativeSeek() || event.button !== 0) return;

    activeNativeSeekPointer = event.pointerId;
    activeNativeSeekBar = event.currentTarget;
    stopNativeSeekEvent(event);
    activeNativeSeekBar.setPointerCapture?.(event.pointerId);
    seekFromNativeBar(event, activeNativeSeekBar);
  }

  function onNativeSeekPointerMove(event) {
    if (!shouldAssistNativeSeek() || activeNativeSeekPointer !== event.pointerId || !activeNativeSeekBar) return;

    stopNativeSeekEvent(event);
    seekFromNativeBar(event, activeNativeSeekBar);
  }

  function onNativeSeekPointerEnd(event) {
    if (activeNativeSeekPointer !== event.pointerId || !activeNativeSeekBar) return;

    stopNativeSeekEvent(event);
    seekFromNativeBar(event, activeNativeSeekBar);
    activeNativeSeekPointer = null;
    activeNativeSeekBar = null;
  }

  function attachNativeSeekAssist(root = document) {
    const bars = Array.from(root.querySelectorAll?.(".player-progress-bar") || []);

    bars.forEach((bar) => {
      if (!(bar instanceof Element) || nativeSeekBars.has(bar)) return;

      nativeSeekBars.add(bar);
      bar.addEventListener("pointerdown", onNativeSeekPointerDown, true);
      bar.addEventListener("pointermove", onNativeSeekPointerMove, true);
      bar.addEventListener("pointerup", onNativeSeekPointerEnd, true);
      bar.addEventListener("pointercancel", onNativeSeekPointerEnd, true);
    });
  }

  function loadSavedSpeed() {
    try {
      const value = Number(window.localStorage.getItem(STORAGE_SPEED_KEY));
      if (Number.isFinite(value) && value >= SPEEDS[0] && value <= SPEEDS[SPEEDS.length - 1]) {
        return value;
      }
    } catch {
      // Storage can be unavailable in restricted frames.
    }

    return null;
  }

  function saveSpeed(rate) {
    try {
      window.localStorage.setItem(STORAGE_SPEED_KEY, String(rate));
    } catch {
      // Non-critical convenience feature.
    }
  }

  function setSpeed(rate) {
    if (!video || !Number.isFinite(rate)) return;
    document.dispatchEvent(new CustomEvent("cb-set-rate", { detail: rate }));

    try {
      video.playbackRate = rate;
    } catch {
      // The main-world helper normally handles this path.
    }

    saveSpeed(rate);
    requestUiUpdate();

    window.setTimeout(() => requestUiUpdate(), 120);
    window.setTimeout(() => requestUiUpdate(), 400);
  }

  function stepSpeed(dir) {
    if (!video) return;

    const current = video.playbackRate || 1;
    let index = SPEEDS.findIndex((rate) => Math.abs(rate - current) < 0.01);

    if (index === -1) {
      index = SPEEDS.reduce((best, rate, i) => (
        Math.abs(rate - current) < Math.abs(SPEEDS[best] - current) ? i : best
      ), 0);
    }

    const nextIndex = Math.max(0, Math.min(SPEEDS.length - 1, index + dir));
    setSpeed(SPEEDS[nextIndex]);
  }

  function cycleSpeed() {
    if (!video) return;

    const current = video.playbackRate || 1;
    let index = SPEEDS.findIndex((rate) => Math.abs(rate - current) < 0.01);

    if (index === -1) {
      index = SPEEDS.reduce((best, rate, i) => (
        Math.abs(rate - current) < Math.abs(SPEEDS[best] - current) ? i : best
      ), 0);
    }

    setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  }

  function button(className, label, iconName) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `cb-control-btn ${className}`;
    el.title = label;
    el.setAttribute("aria-label", label);
    el.innerHTML = icon(iconName);
    return el;
  }

  function closeMenus(except) {
    if (except !== "quality") {
      qualityMenuOpen = false;
      if (ui.qualityMenu) ui.qualityMenu.hidden = true;
      ui.quality?.setAttribute("aria-expanded", "false");
    }

    if (except !== "settings") {
      settingsMenuOpen = false;
      if (ui.settingsMenu) ui.settingsMenu.hidden = true;
      ui.settings?.setAttribute("aria-expanded", "false");
    }

    if (!qualityMenuOpen && !settingsMenuOpen) {
      scheduleControlsIdleHide(true);
    }
  }

  function positionMenu(menu, anchor) {
    if (!controls || !menu || !anchor) return;

    const controlsRect = controls.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const right = Math.max(8, controlsRect.right - anchorRect.right);
    const bottom = Math.max(48, controlsRect.height + 8);

    menu.style.right = `${right}px`;
    menu.style.bottom = `${bottom}px`;
  }

  function nativeQualityControl() {
    const fullscreenElement = getFullscreenElement();

    return Array.from(document.querySelectorAll(".play-quality"))
      .find((item) => (
        item instanceof Element &&
        item.textContent &&
        isBoxed(item) &&
        (fullscreenElement ? fullscreenElement.contains(item) : rectIntersectsVideo(item.getBoundingClientRect()))
      )) || null;
  }

  function rememberNativeProxyStyle(el) {
    if (!(el instanceof HTMLElement) || nativeProxyStyles.has(el)) return;
    nativeProxyStyles.set(el, el.getAttribute("style") || "");
  }

  function resetNativeProxy(el) {
    if (!(el instanceof HTMLElement)) return;

    const originalStyle = nativeProxyStyles.get(el);
    if (originalStyle !== undefined) {
      if (originalStyle) el.setAttribute("style", originalStyle);
      else el.removeAttribute("style");
      nativeProxyStyles.delete(el);
    }

    el.classList.remove("cb-native-proxy", "cb-native-quality-proxy", "cb-native-fullscreen-proxy");
  }

  function clearNativeProxies() {
    document.querySelectorAll(".cb-native-proxy").forEach((item) => resetNativeProxy(item));
  }

  function applyNativeProxy(nativeControl, anchor, className) {
    if (!(nativeControl instanceof HTMLElement) || !(anchor instanceof Element)) return;

    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      resetNativeProxy(nativeControl);
      return;
    }

    rememberNativeProxyStyle(nativeControl);
    nativeControl.classList.add("cb-native-proxy", className);
    nativeControl.style.position = "fixed";
    nativeControl.style.left = `${rect.left}px`;
    nativeControl.style.top = `${rect.top}px`;
    nativeControl.style.width = `${rect.width}px`;
    nativeControl.style.height = `${rect.height}px`;
    nativeControl.style.minWidth = `${rect.width}px`;
    nativeControl.style.minHeight = `${rect.height}px`;
    nativeControl.style.margin = "0";
    nativeControl.style.padding = "0";
    nativeControl.style.border = "0";
    nativeControl.style.borderRadius = "7px";
    nativeControl.style.opacity = "0";
    nativeControl.style.visibility = "visible";
    nativeControl.style.pointerEvents = "auto";
    nativeControl.style.zIndex = "2147483647";
    nativeControl.style.transform = "none";
    nativeControl.style.cursor = "pointer";
  }

  function syncNativeControlProxies() {
    const canProxy =
      shouldShowCustomControls() &&
      controls?.classList.contains("cb-visible") &&
      !controlsAreIdle;

    if (!canProxy) {
      clearNativeProxies();
      return;
    }

    const qualityControl = nativeQualityControl();
    const active = new Set([qualityControl].filter(Boolean));

    document.querySelectorAll(".cb-native-proxy").forEach((item) => {
      if (!active.has(item)) resetNativeProxy(item);
    });

    applyNativeProxy(qualityControl, ui.quality, "cb-native-quality-proxy");
    positionNativeQualityMenu();
  }

  function nativeQualityMenu() {
    return Array.from(document.querySelectorAll(".quality-selector"))
      .find((item) => item instanceof HTMLElement && isBoxed(item)) || null;
  }

  function positionNativeQualityMenu() {
    const menu = nativeQualityMenu();
    if (!menu || !ui.quality || !shouldShowCustomControls()) return;

    const anchorRect = ui.quality.getBoundingClientRect();
    const controlsRect = controls?.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const width = Math.max(116, Math.min(150, menuRect.width || 126));
    const height = Math.max(124, Math.min(220, menuRect.height || 156));
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, anchorRect.right - width));
    const menuBottom = controlsRect?.top && controlsRect.top > 0 ? controlsRect.top - 8 : anchorRect.top - 8;
    const top = Math.max(8, menuBottom - height);

    menu.classList.add("cb-native-quality-menu");

    const currentLabel = currentQualityLabel().toLowerCase();
    Array.from(menu.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        const text = normalizeText(child.textContent).toLowerCase();
        if (text && text === currentLabel) {
          child.classList.add("cb-menu-item-active");
        } else {
          child.classList.remove("cb-menu-item-active");
        }
      }
    });

    menu.style.position = "fixed";
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.right = "auto";
    menu.style.bottom = "auto";
    menu.style.width = `${width}px`;
    menu.style.minWidth = `${width}px`;
    menu.style.maxHeight = "240px";
    menu.style.transform = "none";
    menu.style.opacity = "1";
    menu.style.visibility = "visible";
    menu.style.pointerEvents = "auto";
    menu.style.zIndex = "2147483647";
  }

  function scheduleNativeQualityMenuPosition() {
    window.setTimeout(positionNativeQualityMenu, 0);
    window.setTimeout(positionNativeQualityMenu, 80);
    window.setTimeout(positionNativeQualityMenu, 180);
  }

  function currentQualityLabel() {
    const label = normalizeText(nativeQualityControl()?.textContent);
    return label || "Auto";
  }

  function dispatchNativeClick(target) {
    if (!(target instanceof Element)) return;

    ["pointerover", "mouseover", "pointermove", "mousemove", "pointerdown", "mousedown", "pointerup", "mouseup"].forEach((eventName) => {
      const EventCtor = eventName.startsWith("pointer") && window.PointerEvent ? window.PointerEvent : window.MouseEvent;
      target.dispatchEvent(new EventCtor(eventName, {
        bubbles: true,
        cancelable: true,
        view: window,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }));
    });

    if (typeof target.click === "function") {
      target.click();
    } else {
      target.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    }
  }

  function withNativeControlsVisible(work, restoreDelay = 350) {
    const roots = Array.from(nativeControlsRoots);
    const hadGlobalHideClass = document.documentElement.classList.contains("cb-player-boost-controls-on");

    document.documentElement.classList.remove("cb-player-boost-controls-on");
    roots.forEach((root) => root.classList.remove("cb-chaicode-native-hidden"));

    try {
      document.documentElement.getBoundingClientRect();
      roots.forEach((root) => root.getBoundingClientRect());
      work();
    } finally {
      window.setTimeout(() => {
        if (shouldShowCustomControls()) {
          if (hadGlobalHideClass) document.documentElement.classList.add("cb-player-boost-controls-on");
          roots.forEach((root) => root.classList.add("cb-chaicode-native-hidden"));
        }
        requestUiUpdate();
      }, restoreDelay);
    }
  }

  function openNativeQualityPanel(restoreDelay = 900) {
    const control = nativeQualityControl();
    if (!control) return false;

    withNativeControlsVisible(() => {
      dispatchNativeClick(control);
    }, restoreDelay);

    return true;
  }

  function qualityOptionCandidates() {
    const selector = "button,[role='button'],[role='option'],[role='menuitem'],li,div,p,span";

    return Array.from(document.querySelectorAll(selector))
      .filter((item) => {
        if (!(item instanceof Element)) return false;
        if (controls?.contains(item)) return false;

        const text = normalizeText(item.textContent);
        if (!QUALITY_RE.test(text)) return false;

        return isVisibleElement(item);
      });
  }

  function discoverQualityLabels() {
    return QUALITY_FALLBACKS.slice();
  }

  function findQualityOption(label) {
    const exactMatches = Array.from(document.querySelectorAll(`.quality-selector .player-quality-${label}, .player-quality-${label}`));
    const exact = exactMatches.find((item) => item instanceof Element && isVisibleElement(item));
    if (exact instanceof Element) return exact;

    const normalizedLabel = normalizeText(label).toLowerCase();
    return qualityOptionCandidates()
      .find((item) => normalizeText(item.textContent).toLowerCase() === normalizedLabel) || null;
  }

  function clickQualityWhenReady(label, startedAt = performance.now()) {
    const option = findQualityOption(label);

    if (option) {
      withNativeControlsVisible(() => {
        dispatchNativeClick(option);
      }, 350);

      window.setTimeout(() => {
        hideNativeControls();
        requestUiUpdate();
      }, 250);
      return;
    }

    if (performance.now() - startedAt > 1300) {
      hideNativeControls();
      requestUiUpdate();
      return;
    }

    window.setTimeout(() => clickQualityWhenReady(label, startedAt), 80);
  }

  function selectQuality(label) {
    closeMenus();

    const alreadyOpenOption = findQualityOption(label);
    if (alreadyOpenOption) {
      withNativeControlsVisible(() => {
        dispatchNativeClick(alreadyOpenOption);
      }, 350);
      window.setTimeout(() => {
        hideNativeControls();
        requestUiUpdate();
      }, 250);
      return;
    }

    const opened = openNativeQualityPanel(1600);
    if (!opened) return;

    window.setTimeout(() => clickQualityWhenReady(label), 140);
  }

  function renderQualityMenu(labels) {
    if (!ui.qualityMenu) return;

    const current = currentQualityLabel().toLowerCase();
    ui.qualityMenu.innerHTML = "";

    labels.forEach((label) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "cb-menu-item";
      item.textContent = label;
      item.setAttribute("aria-label", `Set quality to ${label}`);

      if (label.toLowerCase() === current) {
        item.classList.add("cb-menu-item-active");
      }

      item.addEventListener("click", () => selectQuality(label));
      ui.qualityMenu.appendChild(item);
    });
  }

  function toggleQualityMenu() {
    if (!ui.qualityMenu) return;

    const willOpen = !qualityMenuOpen;
    closeMenus(willOpen ? "quality" : undefined);
    qualityMenuOpen = willOpen;
    ui.qualityMenu.hidden = !willOpen;
    ui.quality?.setAttribute("aria-expanded", String(willOpen));

    if (!willOpen) {
      scheduleControlsIdleHide(true);
      return;
    }

    revealControls(false);
    renderQualityMenu(discoverQualityLabels());
    positionMenu(ui.qualityMenu, ui.quality);
  }

  function setCustomControlsEnabled(enabled) {
    if (playerMode === PLAYER_MODES.NORMAL) {
      refreshPlayerModeState();
      return;
    }

    customControlsEnabled = Boolean(enabled);
    temporaryNormalMode = !customControlsEnabled;

    if (customControlsEnabled) saveEnabledSetting();

    refreshPlayerModeState();
    scheduleScan();
    renderSettingsMenu();
  }

  function toggleCustomControlsEnabled() {
    setCustomControlsEnabled(!customControlsEnabled);
  }

  function setArrowSkipSeconds(seconds) {
    arrowSkipSeconds = seconds === 30 ? 30 : 10;
    saveArrowSkipSetting();
    renderSettingsMenu();
  }

  function cycleTimeMode() {
    const nextIndex = (TIME_MODES.indexOf(timeMode) + 1) % TIME_MODES.length;
    timeMode = TIME_MODES[nextIndex] || "passed";
    saveTimeModeSetting();
    requestUiUpdate();
  }

  function appendShortcutRow(parent, action, keys) {
    const row = document.createElement("div");
    row.className = "cb-shortcut-row";

    const label = document.createElement("span");
    label.className = "cb-shortcut-label";
    label.textContent = action;
    row.appendChild(label);

    const keyGroup = document.createElement("span");
    keyGroup.className = "cb-shortcut-keys";

    keys.forEach((key, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "cb-shortcut-separator";
        separator.textContent = "/";
        keyGroup.appendChild(separator);
      }

      const keycap = document.createElement("kbd");
      keycap.textContent = key;
      keyGroup.appendChild(keycap);
    });

    row.appendChild(keyGroup);
    parent.appendChild(row);
  }

  function appendShortcutSection() {
    if (!ui.settingsMenu) return;

    const section = document.createElement("div");
    section.className = "cb-shortcut-section";

    const title = document.createElement("div");
    title.className = "cb-shortcut-title";
    title.textContent = "Shortcuts";
    section.appendChild(title);

    appendShortcutRow(section, "Play / pause", ["Space", "K"]);
    appendShortcutRow(section, `Skip ${arrowSkipSeconds}s`, ["Left", "Right"]);
    appendShortcutRow(section, "Speed", ["[", "]"]);
    appendShortcutRow(section, "Mute", ["M"]);
    appendShortcutRow(section, "Fullscreen", ["F"]);
    appendShortcutRow(section, "Hide / show custom", ["H"]);

    ui.settingsMenu.appendChild(section);
  }

  function renderSettingsMenu() {
    if (!ui.settingsMenu) return;

    ui.settingsMenu.innerHTML = "";

    const controlsToggle = document.createElement("button");
    controlsToggle.type = "button";
    controlsToggle.className = "cb-menu-item cb-menu-setting";
    controlsToggle.textContent = `Custom controls: ${customControlsEnabled ? "On" : "Off"}`;
    controlsToggle.addEventListener("click", toggleCustomControlsEnabled);
    ui.settingsMenu.appendChild(controlsToggle);

    const arrow10 = document.createElement("button");
    arrow10.type = "button";
    arrow10.className = "cb-menu-item cb-menu-setting";
    arrow10.textContent = "Arrow skip: 10s";
    if (arrowSkipSeconds === 10) arrow10.classList.add("cb-menu-item-active");
    arrow10.addEventListener("click", () => setArrowSkipSeconds(10));
    ui.settingsMenu.appendChild(arrow10);

    const arrow30 = document.createElement("button");
    arrow30.type = "button";
    arrow30.className = "cb-menu-item cb-menu-setting";
    arrow30.textContent = "Arrow skip: 30s";
    if (arrowSkipSeconds === 30) arrow30.classList.add("cb-menu-item-active");
    arrow30.addEventListener("click", () => setArrowSkipSeconds(30));
    ui.settingsMenu.appendChild(arrow30);

    appendShortcutSection();
  }

  function toggleSettingsMenu() {
    if (!ui.settingsMenu) return;

    const willOpen = !settingsMenuOpen;
    closeMenus(willOpen ? "settings" : undefined);
    settingsMenuOpen = willOpen;
    ui.settingsMenu.hidden = !willOpen;
    ui.settings?.setAttribute("aria-expanded", String(willOpen));

    if (!willOpen) {
      scheduleControlsIdleHide(true);
      return;
    }

    revealControls(false);
    renderSettingsMenu();
    positionMenu(ui.settingsMenu, ui.settings);
  }

  function menusAreOpen() {
    return qualityMenuOpen || settingsMenuOpen;
  }

  function setControlsIdle(idle) {
    controlsAreIdle = Boolean(idle);
    controls?.classList.toggle("cb-idle", controlsAreIdle);
    syncNativeControlProxies();
  }

  function clearControlsIdleTimer() {
    if (!controlsIdleTimer) return;
    window.clearTimeout(controlsIdleTimer);
    controlsIdleTimer = null;
  }

  function canAutoHideControls() {
    return Boolean(
      shouldShowCustomControls() &&
      controls &&
      video &&
      activeSeekPointer === null &&
      !menusAreOpen() &&
      !controlsFocusPinned
    );
  }

  function scheduleControlsIdleHide(reset = false) {
    if (!canAutoHideControls()) {
      clearControlsIdleTimer();
      setControlsIdle(false);
      return;
    }

    if (!reset && controlsIdleTimer) return;

    clearControlsIdleTimer();
    controlsIdleTimer = window.setTimeout(() => {
      controlsIdleTimer = null;
      if (canAutoHideControls()) setControlsIdle(true);
    }, CONTROLS_IDLE_MS);
  }

  function revealControls(resetTimer = true) {
    if (!controls) return;
    setControlsIdle(false);
    if (resetTimer) scheduleControlsIdleHide(true);
  }

  function getEventPoint(event) {
    const source = event?.touches?.[0] || event?.changedTouches?.[0] || event;
    if (!source || !Number.isFinite(source.clientX) || !Number.isFinite(source.clientY)) return null;
    return { x: source.clientX, y: source.clientY };
  }

  function pointInRect(point, rect, padding = 0) {
    if (!point || !rect || rect.width <= 0 || rect.height <= 0) return false;
    return (
      point.x >= rect.left - padding &&
      point.x <= rect.right + padding &&
      point.y >= rect.top - padding &&
      point.y <= rect.bottom + padding
    );
  }

  function isActivityNearPlayer(event) {
    if (!video) return false;

    const point = getEventPoint(event);
    if (!point) return true;

    const fullscreenElement = getFullscreenElement();
    if (fullscreenElement) {
      return pointInRect(point, fullscreenElement.getBoundingClientRect(), 8);
    }

    return (
      pointInRect(point, video.getBoundingClientRect(), 24) ||
      pointInRect(point, controls?.getBoundingClientRect(), 24)
    );
  }

  function onPlayerActivity(event) {
    if (!shouldShowCustomControls() || !video || !controls) return;
    if (!isActivityNearPlayer(event)) return;

    revealControls(true);
  }

  function onControlsPointerDown() {
    lastControlsPointerAt = Date.now();
    controlsFocusPinned = false;
  }

  function onControlsFocusIn() {
    const focusFromPointer = Date.now() - lastControlsPointerAt < 500;
    controlsFocusPinned = !focusFromPointer;
    revealControls(false);
    scheduleControlsIdleHide(true);
  }

  function onControlsFocusOut() {
    controlsFocusPinned = false;
    scheduleControlsIdleHide(true);
  }

  function syncAutoHideState() {
    if (!shouldShowCustomControls() || !controls || !video) {
      clearControlsIdleTimer();
      setControlsIdle(false);
      return;
    }

    if (!canAutoHideControls()) {
      clearControlsIdleTimer();
      setControlsIdle(false);
      return;
    }

    if (!controlsAreIdle && !controlsIdleTimer) {
      scheduleControlsIdleHide(false);
    }
  }

  function buildControls() {
    if (controls) return;

    controls = document.createElement("div");
    controls.id = CONTROLS_ID;
    controls.innerHTML = `
      <div class="cb-progress" role="slider" aria-label="Seek video" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
        <div class="cb-progress-track">
          <div class="cb-progress-buffer"></div>
          <div class="cb-progress-fill"></div>
          <div class="cb-progress-thumb"></div>
        </div>
      </div>
      <div class="cb-controls-row">
        <div class="cb-controls-left"></div>
        <div class="cb-controls-spacer"></div>
        <div class="cb-controls-right"></div>
      </div>
      <div class="cb-menu cb-quality-menu" hidden></div>
      <div class="cb-menu cb-settings-menu" hidden></div>
    `;

    ui.progress = controls.querySelector(".cb-progress");
    ui.fill = controls.querySelector(".cb-progress-fill");
    ui.thumb = controls.querySelector(".cb-progress-thumb");
    ui.qualityMenu = controls.querySelector(".cb-quality-menu");
    ui.settingsMenu = controls.querySelector(".cb-settings-menu");

    const left = controls.querySelector(".cb-controls-left");
    const right = controls.querySelector(".cb-controls-right");

    ui.play = button("cb-play", "Play", "play");
    ui.back30 = button("cb-back-30", "Back 30 seconds", "rewind30");
    ui.back10 = button("cb-back-10", "Back 10 seconds", "rewind10");
    ui.forward10 = button("cb-forward-10", "Forward 10 seconds", "forward10");
    ui.forward30 = button("cb-forward-30", "Forward 30 seconds", "forward30");
    ui.mute = button("cb-mute", "Mute", "volume");
    ui.time = document.createElement("button");
    ui.time.type = "button";
    ui.time.className = "cb-time";
    ui.time.title = "Change time display";
    ui.time.setAttribute("aria-label", "Change time display");
    ui.time.textContent = "0:00 / 0:00";
    ui.quality = document.createElement("button");
    ui.quality.type = "button";
    ui.quality.className = "cb-pill-btn cb-quality-btn";
    ui.quality.title = "Change video quality";
    ui.quality.setAttribute("aria-label", "Change video quality");
    ui.quality.textContent = "Auto";
    ui.speed = document.createElement("button");
    ui.speed.type = "button";
    ui.speed.className = "cb-pill-btn cb-speed-btn";
    ui.speed.title = "Change playback speed";
    ui.speed.setAttribute("aria-label", "Change playback speed");
    ui.speed.textContent = "1x";
    ui.fullscreen = button("cb-fullscreen", "Fullscreen", "fullscreen");
    ui.settings = button("cb-settings", "Player Boost settings", "settings");
    ui.settings.setAttribute("aria-haspopup", "menu");
    ui.settings.setAttribute("aria-expanded", "false");

    left.append(ui.play, ui.back30, ui.back10, ui.forward10, ui.forward30);
    right.append(ui.time, ui.mute, ui.quality, ui.speed, ui.fullscreen, ui.settings);

    ui.play.addEventListener("click", () => {
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });

    ui.back30.addEventListener("click", () => skipBy(-30));
    ui.back10.addEventListener("click", () => skipBy(-10));
    ui.forward10.addEventListener("click", () => skipBy(10));
    ui.forward30.addEventListener("click", () => skipBy(30));
    ui.mute.addEventListener("click", () => {
      if (!video) return;
      video.muted = !video.muted;
      requestUiUpdate();
    });
    ui.time.addEventListener("click", cycleTimeMode);
    ui.quality.addEventListener("pointerenter", syncNativeControlProxies);
    ui.quality.addEventListener("click", () => {
      syncNativeControlProxies();
      openNativeQualityPanel(2000);
    });
    ui.speed.addEventListener("click", () => {
      closeMenus();
      cycleSpeed();
    });
    ui.fullscreen.addEventListener("pointerenter", syncNativeControlProxies);
    ui.fullscreen.addEventListener("click", toggleFullscreen);
    ui.settings.addEventListener("click", () => toggleSettingsMenu());

    ui.progress.addEventListener("pointerdown", onProgressPointerDown);
    ui.progress.addEventListener("pointermove", onProgressPointerMove);
    ui.progress.addEventListener("pointerup", onProgressPointerEnd);
    ui.progress.addEventListener("pointercancel", onProgressPointerEnd);

    controls.addEventListener("pointerenter", onPlayerActivity, { passive: true });
    controls.addEventListener("pointermove", onPlayerActivity, { passive: true });
    controls.addEventListener("touchstart", onPlayerActivity, { passive: true });
    controls.addEventListener("pointerdown", onControlsPointerDown, true);
    controls.addEventListener("focusin", onControlsFocusIn);
    controls.addEventListener("focusout", onControlsFocusOut);
    controls.addEventListener("selectstart", preventPlayerSelection, true);
    controls.addEventListener("dragstart", preventPlayerSelection, true);
    controls.addEventListener("mousedown", preventMultiClickSelection, true);
    controls.addEventListener("pointerdown", (event) => event.stopPropagation());
    controls.addEventListener("click", (event) => event.stopPropagation());
    controls.addEventListener("dblclick", (event) => event.stopPropagation());
    controls.addEventListener("contextmenu", (event) => event.stopPropagation());

    (document.body || document.documentElement).appendChild(controls);
  }

  function toggleFullscreen() {
    revealControls(true);

    document.dispatchEvent(new CustomEvent("cb-toggle-fullscreen"));
    window.setTimeout(() => {
      hideNativeControls();
      requestUiUpdate();
    }, 250);
    return;
  }

  function attachVideoEvents(target) {
    VIDEO_EVENTS.forEach((eventName) => {
      target.addEventListener(eventName, requestUiUpdate);
    });
  }

  function detachVideoEvents(target) {
    VIDEO_EVENTS.forEach((eventName) => {
      target.removeEventListener(eventName, requestUiUpdate);
    });
  }

  function updateControlsParent() {
    if (!controls) return;

    const fsElement = getFullscreenElement();
    const targetParent = fsElement || document.body || document.documentElement;

    if (controls.parentElement !== targetParent) {
      targetParent.appendChild(controls);
    }
  }

  function updateControlsPosition() {
    if (!controls || !video) return;

    if (!shouldShowCustomControls()) {
      clearControlsIdleTimer();
      setControlsIdle(false);
      controls.classList.remove("cb-visible");
      return;
    }

    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      clearControlsIdleTimer();
      setControlsIdle(false);
      controls.classList.remove("cb-visible");
      return;
    }

    updateControlsParent();

    const fsElement = getFullscreenElement();
    const fsRect = fsElement ? fsElement.getBoundingClientRect() : null;

    controls.classList.add("cb-visible");
    controls.classList.toggle("cb-idle", controlsAreIdle);

    if (fsRect) {
      controls.style.position = "absolute";
      controls.style.left = "0px";
      controls.style.bottom = "0px";
      controls.style.width = `${Math.max(240, fsRect.width)}px`;
      controls.classList.add("cb-fullscreen");
    } else {
      controls.style.position = "fixed";
      controls.style.left = `${rect.left}px`;
      controls.style.bottom = `${Math.max(0, window.innerHeight - rect.bottom)}px`;
      controls.style.width = `${Math.max(240, rect.width)}px`;
      controls.classList.remove("cb-fullscreen");
    }

    syncNativeControlProxies();
  }

  function updateBuffered(duration) {
    const buffer = controls?.querySelector(".cb-progress-buffer");
    if (!buffer || !video || !Number.isFinite(duration) || duration <= 0 || video.buffered.length === 0) {
      if (buffer) buffer.style.width = "0%";
      return;
    }

    let end = 0;
    for (let i = 0; i < video.buffered.length; i += 1) {
      end = Math.max(end, video.buffered.end(i));
    }

    buffer.style.width = `${Math.max(0, Math.min(100, (end / duration) * 100))}%`;
  }

  function syncUi() {
    if (!controls || !video) return;

    hideNativeControls();
    updateControlsPosition();

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const current = Math.max(0, video.currentTime || 0);
    const pct = duration > 0 ? Math.max(0, Math.min(100, (current / duration) * 100)) : 0;

    if (ui.fill) ui.fill.style.width = `${pct}%`;
    if (ui.thumb) ui.thumb.style.left = `${pct}%`;
    if (ui.time) {
      ui.time.textContent = formatTimeDisplay(current, duration);
      ui.time.title = `${timeModeLabel()}. Click to change.`;
      ui.time.setAttribute("aria-label", `${timeModeLabel()}: ${ui.time.textContent}. Click to change.`);
    }
    if (ui.progress) {
      ui.progress.setAttribute("aria-valuemax", String(Math.floor(duration)));
      ui.progress.setAttribute("aria-valuenow", String(Math.floor(current)));
      ui.progress.setAttribute("aria-valuetext", `${fmt(current)} of ${fmt(duration)}`);
    }

    updateBuffered(duration);

    if (ui.play) {
      ui.play.innerHTML = icon(video.paused ? "play" : "pause");
      ui.play.title = video.paused ? "Play" : "Pause";
      ui.play.setAttribute("aria-label", video.paused ? "Play" : "Pause");
    }

    if (ui.mute) {
      const isMuted = video.muted || video.volume === 0;
      ui.mute.innerHTML = icon(isMuted ? "muted" : "volume");
      ui.mute.title = isMuted ? "Unmute" : "Mute";
      ui.mute.setAttribute("aria-label", isMuted ? "Unmute" : "Mute");
    }

    if (ui.speed) {
      ui.speed.textContent = formatRate(video.playbackRate || 1);
    }

    if (ui.quality) {
      ui.quality.textContent = currentQualityLabel();
    }

    positionNativeQualityMenu();

    if (ui.fullscreen) {
      const inFullscreen = Boolean(getFullscreenElement());
      ui.fullscreen.innerHTML = icon(inFullscreen ? "exitFullscreen" : "fullscreen");
      ui.fullscreen.title = inFullscreen ? "Exit fullscreen" : "Fullscreen";
      ui.fullscreen.setAttribute("aria-label", inFullscreen ? "Exit fullscreen" : "Fullscreen");
    }

    syncAutoHideState();
  }

  function requestUiUpdate() {
    if (updateRaf) return;

    updateRaf = requestAnimationFrame(() => {
      updateRaf = 0;
      syncUi();
    });
  }

  function seekFromProgressEvent(event) {
    if (!video || !ui.progress || !Number.isFinite(video.duration) || video.duration <= 0) return;

    const rect = ui.progress.getBoundingClientRect();
    if (rect.width <= 0) return;

    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    forceSeek(video.duration * pct);
  }

  function onProgressPointerDown(event) {
    if (!video || event.button !== 0) return;

    activeSeekPointer = event.pointerId;
    event.preventDefault();
    event.stopPropagation();
    revealControls(false);
    ui.progress.setPointerCapture?.(event.pointerId);
    seekFromProgressEvent(event);
  }

  function onProgressPointerMove(event) {
    if (activeSeekPointer !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    seekFromProgressEvent(event);
  }

  function onProgressPointerEnd(event) {
    if (activeSeekPointer !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    seekFromProgressEvent(event);
    activeSeekPointer = null;
    scheduleControlsIdleHide(true);
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    if (controls?.contains(target)) return false;
    if (target.closest(".cb-native-proxy, .quality-selector")) return false;

    const tagName = target.tagName;
    return (
      target.isContentEditable ||
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT" ||
      tagName === "BUTTON"
    );
  }

  function isPlayerUiTarget(target) {
    if (!(target instanceof Element)) return false;
    if (controls?.contains(target)) return true;
    if (target.closest(".player-progress-bar, #progress-timer, .player-progress-val, .play-footer, .player-seek-backward, .player-seek-forward, .play-quality, .player-fullscreen, .player-more-options, .icon-default-class")) return true;
    if (target.tagName === "VIDEO") return true;
    if (target === document.body || target === document.documentElement) return false;

    return rectIntersectsVideo(target.getBoundingClientRect());
  }

  function preventPlayerSelection(event) {
    if (!isPlayerUiTarget(event.target)) return;
    event.preventDefault();
    window.getSelection?.()?.removeAllRanges?.();
  }

  function preventMultiClickSelection(event) {
    if (event.detail < 2 || !isPlayerUiTarget(event.target)) return;
    event.preventDefault();
    window.getSelection?.()?.removeAllRanges?.();
  }

  function onKeyDown(event) {
    if (!video || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "h" && playerMode === PLAYER_MODES.CUSTOM) {
      toggleCustomControlsEnabled();
      revealControls(true);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    if (!shouldShowCustomControls()) return;

    let handled = true;

    if (event.key === "[") {
      stepSpeed(-1);
    } else if (event.key === "]") {
      stepSpeed(1);
    } else if (key === "m") {
      video.muted = !video.muted;
      requestUiUpdate();
    } else if (event.key === "ArrowLeft") {
      skipBy(-arrowSkipSeconds);
    } else if (event.key === "ArrowRight") {
      skipBy(arrowSkipSeconds);
    } else if (event.key === " " || key === "k") {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    } else if (key === "f") {
      toggleFullscreen();
    } else {
      handled = false;
    }

    if (!handled) return;

    revealControls(true);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function onKeyUp(event) {
    if (!shouldShowCustomControls()) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function bindVideo(nextVideo) {
    if (video === nextVideo) {
      attachNativeSeekAssist();
      if (shouldShowCustomControls()) {
        buildControls();
        hideNativeControls();
        if (!controls?.classList.contains("cb-visible")) {
          revealControls(true);
        } else {
          syncAutoHideState();
        }
      } else {
        restoreNativeControls();
        controls?.classList.remove("cb-visible");
      }
      requestUiUpdate();
      return;
    }

    if (video) {
      detachVideoEvents(video);
      video.removeAttribute(ACTIVE_ATTR);
    }

    video = nextVideo;
    video.setAttribute(ACTIVE_ATTR, "true");
    attachVideoEvents(video);
    attachNativeSeekAssist();

    if (shouldShowCustomControls()) {
      buildControls();
      hideNativeControls();
      revealControls(true);
    } else {
      restoreNativeControls();
      controls?.classList.remove("cb-visible");
    }

    const savedSpeed = loadSavedSpeed();
    if (savedSpeed !== null && isCustomPlayerMode()) setSpeed(savedSpeed);

    requestUiUpdate();
  }

  function unbindVideo() {
    if (video) {
      detachVideoEvents(video);
      video.removeAttribute(ACTIVE_ATTR);
    }

    video = null;
    activeSeekPointer = null;
    activeNativeSeekPointer = null;
    activeNativeSeekBar = null;
    clearControlsIdleTimer();
    setControlsIdle(false);
    controls?.classList.remove("cb-visible");
    restoreNativeControls();
  }

  function scan() {
    removeOldControls();
    hideWatermarks();
    attachNativeSeekAssist();

    const nextVideo = findVideo();
    if (nextVideo) bindVideo(nextVideo);
    else unbindVideo();
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, SCAN_DEBOUNCE_MS);
  }

  function startRuntime() {
    removeOldControls();
    scan();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            hideWatermarks(node);
            attachNativeSeekAssist(node);
          }
        });
      });
      scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    let fastScans = 0;
    const fastScanTimer = window.setInterval(() => {
      scan();
      fastScans += 1;

      if (video || fastScans >= FAST_SCAN_LIMIT) {
        window.clearInterval(fastScanTimer);
      }
    }, FAST_SCAN_INTERVAL_MS);

    window.setInterval(scan, SCAN_INTERVAL_MS);
    window.addEventListener("resize", requestUiUpdate, { passive: true });
    window.addEventListener("scroll", requestUiUpdate, { capture: true, passive: true });
    document.addEventListener("fullscreenchange", requestUiUpdate);
    document.addEventListener("webkitfullscreenchange", requestUiUpdate);
    document.addEventListener("pointermove", onNativeSeekPointerMove, true);
    document.addEventListener("pointerup", onNativeSeekPointerEnd, true);
    document.addEventListener("pointercancel", onNativeSeekPointerEnd, true);
    document.addEventListener("pointermove", onPlayerActivity, { capture: true, passive: true });
    document.addEventListener("mousemove", onPlayerActivity, { capture: true, passive: true });
    document.addEventListener("touchstart", onPlayerActivity, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPlayerActivity, { capture: true, passive: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Element && event.target.closest(".cb-native-quality-proxy, .play-quality, .quality-selector")) {
        scheduleNativeQualityMenuPosition();
      }
    }, true);
    document.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest(".cb-native-quality-proxy, .play-quality, .quality-selector")) {
        scheduleNativeQualityMenuPosition();
        window.setTimeout(requestUiUpdate, 220);
      }
    }, true);
    document.addEventListener("pointerdown", () => closeMenus());
    document.addEventListener("selectstart", preventPlayerSelection, true);
    document.addEventListener("dragstart", preventPlayerSelection, true);
    document.addEventListener("mousedown", preventMultiClickSelection, true);
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scan();
    });
  }

  function boot() {
    loadSettings();
    bindPlayerModeListener();
    readPlayerMode((mode) => {
      applyPlayerMode(mode);
      startRuntime();
    });
  }

  if (document.documentElement) {
    boot();
  } else {
    window.setTimeout(() => {
      if (document.documentElement) boot();
      else document.addEventListener("DOMContentLoaded", boot, { once: true });
    }, 0);
  }
})();
