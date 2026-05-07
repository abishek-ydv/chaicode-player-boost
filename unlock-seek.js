(function () {
  const ACTIVE_ATTR = "data-cb-active-video";
  const PROTECT_MS = 5000;
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  const rateDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate");
  const nativeFastSeek = HTMLMediaElement.prototype.fastSeek;

  if (!desc || !desc.set || !desc.get) return;

  let protectUntil = 0;
  let protectedTarget = -1;
  let rateProtectUntil = 0;
  let protectedRate = -1;

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
            // Cross-origin frames get their own content-script instance.
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

  function getSeekTargets() {
    const videos = collectVideos();
    const active = videos.filter((video) => video.hasAttribute(ACTIVE_ATTR));
    return active.length ? active : videos;
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

  function isBoxed(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function lowestCommonAncestor(a, b) {
    if (!(a instanceof Element) || !(b instanceof Element)) return null;

    const ancestors = new Set();
    for (let el = a; el; el = el.parentElement) ancestors.add(el);
    for (let el = b; el; el = el.parentElement) {
      if (ancestors.has(el)) return el;
    }

    return null;
  }

  function findFullscreenTarget() {
    const video = getSeekTargets()[0];
    if (!video) return document.documentElement;

    const viewportArea = window.innerWidth * window.innerHeight;
    const videoRect = video.getBoundingClientRect();
    const candidates = [];
    const nativeControls = Array.from(document.querySelectorAll(".player-fullscreen, .player-progress-bar"))
      .filter((item) => item instanceof Element && isBoxed(item));

    nativeControls.forEach((control) => {
      const common = lowestCommonAncestor(video, control);

      for (let el = common; el && el !== document.documentElement; el = el.parentElement) {
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;

        if (
          el !== video &&
          el.contains(video) &&
          el.contains(control) &&
          rect.width >= videoRect.width * 0.9 &&
          rect.height >= videoRect.height * 0.9 &&
          area >= videoRect.width * videoRect.height &&
          area <= viewportArea * 1.2
        ) {
          candidates.push({ el, area });
        }
      }
    });

    for (let el = video; el && el !== document.documentElement; el = el.parentElement) {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;

      if (
        el !== video &&
        rect.width >= videoRect.width * 0.9 &&
        rect.height >= videoRect.height * 0.9 &&
        area >= videoRect.width * videoRect.height * 1.05 &&
        area <= viewportArea * 1.2
      ) {
        candidates.push({ el, area });
      }
    }

    candidates.sort((a, b) => a.area - b.area);
    return candidates[0]?.el || video.parentElement || document.documentElement;
  }

  function protectSeek(time) {
    protectedTarget = time;
    protectUntil = performance.now() + PROTECT_MS;
  }

  function protectRate(rate) {
    protectedRate = rate;
    rateProtectUntil = performance.now() + PROTECT_MS;
  }

  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    get: desc.get,
    set(val) {
      const next = Number(val);
      const now = performance.now();
      const cur = desc.get.call(this);

      if (Number.isFinite(next) && now < protectUntil && protectedTarget >= 0) {
        const isLargeBackwardReset = next < protectedTarget - 3 && next < cur - 3;
        if (isLargeBackwardReset) return;
      }

      if (Number.isFinite(next) && next > cur + 3) {
        protectSeek(next);
      }

      desc.set.call(this, val);
    },
    configurable: true,
    enumerable: true,
  });

  if (typeof nativeFastSeek === "function") {
    HTMLMediaElement.prototype.fastSeek = function (time) {
      const next = Number(time);
      const cur = desc.get.call(this);

      if (Number.isFinite(next) && next > cur + 3) {
        protectSeek(next);
      }

      return nativeFastSeek.call(this, time);
    };
  }

  if (rateDesc && rateDesc.get && rateDesc.set) {
    Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
      get: rateDesc.get,
      set(val) {
        const next = Number(val);
        const now = performance.now();

        if (
          Number.isFinite(next) &&
          now < rateProtectUntil &&
          protectedRate > 0 &&
          Math.abs(next - protectedRate) > 0.01
        ) {
          return;
        }

        if (Number.isFinite(next) && next > 0) {
          protectRate(next);
        }

        rateDesc.set.call(this, val);
      },
      configurable: true,
      enumerable: true,
    });
  }

  document.addEventListener("cb-force-seek", (e) => {
    const time = e.detail;
    if (typeof time !== "number" || !Number.isFinite(time)) return;

    protectSeek(time);
    getSeekTargets().forEach((target) => {
      desc.set.call(target, time);
      target.dispatchEvent(new Event("seeking"));
      target.dispatchEvent(new Event("timeupdate"));
      target.dispatchEvent(new Event("seeked"));
    });
  });

  document.addEventListener("cb-set-rate", (e) => {
    const rate = e.detail;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return;

    protectRate(rate);
    getSeekTargets().forEach((target) => {
      if (rateDesc && rateDesc.set) rateDesc.set.call(target, rate);
      else target.playbackRate = rate;
    });
  });

  document.addEventListener("cb-toggle-fullscreen", () => {
    const fullscreenElement = getFullscreenElement();

    if (fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else document.webkitExitFullscreen?.();
      return;
    }

    const target = findFullscreenTarget();
    if (target?.requestFullscreen) target.requestFullscreen().catch?.(() => {});
    else target?.webkitRequestFullscreen?.();
  });
})();
