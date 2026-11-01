const STYLE_ID = 'sp-lite-anim-style';
const ROOT = 'sp-lite-spin';
const CFG_KEY = 'sp.pref.splite.anim';
const CFG_VER = 5;
const BPM = 138;
const BEAT = 60 / BPM;
/** 一拍落地一次，严格跟 138 BPM（勿再乘 138/128，那会折回 128 手感） */
const DEFAULT_PERIOD = BEAT;

const PRESETS = {
  off: [],
  ui: [
    '#app .btn, #app button, #app .icon-btn',
    '#app .tab, #app .nav-item',
    '#app .avatar, #app .portrait, #app .pavatar',
    '#app .logo, #app .brand',
    '#app .ff-piece, #app .ff-unit',
  ],
  match: [
    '#app .screen.gm .btn, #app .screen.gm button',
    '#app .screen.gm .card, #app .screen.gm .shop-card',
    '#app .screen.gm .portrait, #app .screen.gm .avatar, #app .screen.gm .pavatar',
    '#app .screen.gm .skill-icon, #app .screen.gm .hud-icon',
    '#app .screen.gm .ff-piece, #app .screen.gm .ff-unit',
  ],
  all: [
    '#app .btn img, #app .card img, #app .portrait img, #app .avatar img',
    '#app .btn svg, #app .icon-btn svg, #app .skill-icon svg',
    '#app .btn, #app button, #app .icon-btn',
    '#app .card, #app .portrait, #app .avatar, #app .pavatar',
    '#app .skill-icon, #app .hud-icon, #app .tab, #app .nav-item',
    '#app .ff-piece, #app .ff-unit',
  ],
};

const FREEZE = [
  '#app canvas',
  '#app video',
  '#app .gm__field canvas',
  '#app .gm__vignette',
  '#app .gm__loading',
  '#app .ff-tile',
  '#app .ff-slot',
  '#app .bg',
  '#app [class*="-bg"]',
  '#app [class*="Bg"]',
  '#app [class*="background"]',
  '#app [class*="backdrop"]',
  '#app [class*="wallpaper"]',
  '#app .screen > img',
  '#app .screen > picture',
  '#app .screen > canvas',
  '#app .screen > video',
];

function loadCfg() {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        v: CFG_VER,
        on: raw.on === true,
        preset: PRESETS[raw.preset] ? raw.preset : 'ui',
        period: DEFAULT_PERIOD,
        bpm: BPM,
      };
    }
  } catch {}
  return { v: CFG_VER, on: false, preset: 'ui', period: DEFAULT_PERIOD, bpm: BPM };
}

function saveCfg(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify({ ...cfg, v: CFG_VER })); } catch {}
}

function isBgLike(el) {
  if (!el || !el.tagName) return true;
  if (el.closest && el.closest('.ff-piece, .ff-unit')) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'canvas' || tag === 'video') return true;
  if (el.closest && el.closest('.gm__vignette, .gm__loading, .ff-tile, .ff-slot')) return true;
  const cls = typeof el.className === 'string' ? el.className : '';
  if (/background|\-bg\b|backdrop|wallpaper|full.?bleed|vignette/i.test(cls)) return true;
  const r = el.getBoundingClientRect();
  if (r.width >= window.innerWidth * 0.55 && r.height >= window.innerHeight * 0.4) return true;
  return false;
}

function buildCss(cfg) {
  const sels = PRESETS[cfg.preset] || PRESETS.ui;
  const scoped = sels.map((s) => 'html.' + ROOT + ' ' + s).join(',');
  const freeze = FREEZE.map((s) => 'html.' + ROOT + ' ' + s).join(',');
  return [
    scoped + '{'
      + 'transform-origin:50% 100%;'
      + 'will-change:scale'
      + '}',
    freeze + '{scale:none!important;will-change:auto}',
    '@media (prefers-reduced-motion:reduce){html.' + ROOT + ' [data-sp-ph]{scale:none!important}}',
  ].join('\n');
}

function stampPhases(preset, period) {
  const t = period > 0 ? period : DEFAULT_PERIOD;
  const sels = PRESETS[preset] || PRESETS.ui;
  for (const s of sels) {
    let list;
    try { list = document.querySelectorAll(s); } catch { continue; }
    for (const el of list) {
      if (!el.isConnected || isBgLike(el)) continue;
      if (el.dataset.spPh === '1') continue;
      el.dataset.spPh = '1';
      el.dataset.spOff = String(Math.random());
      el.style.setProperty('--sp-ph', (-Math.random() * t).toFixed(4) + 's');
    }
  }
}

function clearPhases() {
  for (const el of document.querySelectorAll('[data-sp-ph]')) {
    try {
      el.style.removeProperty('--sp-ph');
      el.style.removeProperty('scale');
      delete el.dataset.spPh;
      delete el.dataset.spOff;
    } catch {}
  }
}

function collectTargets(preset) {
  const sels = PRESETS[preset] || PRESETS.ui;
  const out = [];
  const seen = new Set();
  for (const s of sels) {
    let list;
    try { list = document.querySelectorAll(s); } catch { continue; }
    for (const el of list) {
      if (seen.has(el) || !el.isConnected) continue;
      if (el.__spFlip) continue;
      if (isBgLike(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      seen.add(el);
      out.push(el);
    }
  }
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function playFlip(el) {
  if (!el || el.__spFlip || typeof el.animate !== 'function') return;
  el.__spFlip = true;
  const anim = el.animate(
    [
      { rotate: 'y 0deg' },
      { rotate: 'y 180deg', offset: 0.42 },
      { rotate: 'y 360deg' },
    ],
    {
      duration: 700,
      easing: 'cubic-bezier(0.4, 0.05, 0.2, 1)',
      fill: 'none',
    },
  );
  const clear = () => { el.__spFlip = false; };
  anim.finished.then(clear).catch(clear);
  setTimeout(clear, 900);
}

/** 战场干员在 Pixi canvas 上，CSS 选不中；挂钩 UnitView.update */
const unitBounce = { on: false, period: DEFAULT_PERIOD };
const rhythm = { active: false, t: 0, bpm: BPM, period: DEFAULT_PERIOD };
let unitHooked = false;

function bounceScale(period, phase) {
  // 有音乐：跟曲进度+BPM；没音乐：本地时钟一直抖
  const per = rhythm.active && rhythm.period > 0
    ? rhythm.period
    : (period > 0 ? period : DEFAULT_PERIOD);
  const clock = rhythm.active ? rhythm.t : (performance.now() / 1000);
  const ph = ((typeof phase === 'number' ? Math.abs(phase) % 1 : 0) * per);
  const u = (clock + ph) / per;
  const a = (Math.sin(u * Math.PI * 2) + 1) / 2;
  return {
    x: 1.12 * (1 - a) + 0.9 * a,
    y: 0.88 * (1 - a) + 1.12 * a,
  };
}

function installUnitBounce() {
  if (unitHooked) return;
  unitHooked = true;
  const tryPatch = (UV) => {
    if (!UV || !UV.prototype || UV.prototype.__spLiteBounce) return false;
    const orig = UV.prototype.update;
    if (typeof orig !== 'function') return false;
    UV.prototype.__spLiteBounce = true;
    UV.prototype.update = function spLiteUpdate(dt, cam, t) {
      const ret = orig.apply(this, arguments);
      try {
        const root = this.root;
        if (!root || this.destroyed) return ret;
        if (!unitBounce.on || document.hidden) {
          if (this.__spLiteScaled) {
            root.scale.set(1, 1);
            this.__spLiteScaled = false;
          }
          return ret;
        }
        if (this.__spPhase == null) this.__spPhase = Math.random();
        const sc = bounceScale(unitBounce.period, this.__spPhase);
        root.scale.set(sc.x, sc.y);
        this.__spLiteScaled = true;
      } catch {}
      return ret;
    };
    return true;
  };

  void import('/js/render/units.js')
    .then((mod) => { tryPatch(mod && mod.UnitView); })
    .catch(() => {});

  let n = 0;
  const timer = setInterval(() => {
    n += 1;
    if (n > 20) { clearInterval(timer); return; }
    void import('/js/render/units.js')
      .then((mod) => { if (tryPatch(mod && mod.UnitView)) clearInterval(timer); })
      .catch(() => {});
  }, 1000);
}

export function createAnim() {
  let cfg = loadCfg();
  let styleEl = null;
  let flipTimer = 0;
  let phaseTimer = 0;
  let raf = 0;
  let pulseFn = null;
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) try { fn(get()); } catch {} };

  installUnitBounce();

  function get() { return { ...cfg }; }

  function tickDomBounce() {
    for (const el of document.querySelectorAll('[data-sp-ph="1"]')) {
      if (isBgLike(el)) continue;
      const off = Number(el.dataset.spOff) || 0;
      const sc = bounceScale(unitBounce.period, off);
      el.style.scale = sc.x + ' ' + sc.y;
    }
  }

  function stopRaf() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function startRaf() {
    if (raf) return;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!cfg.on) return;
      rhythm.active = false;
      if (typeof pulseFn === 'function') {
        try {
          const r = pulseFn();
          if (r && r.active) {
            rhythm.active = true;
            rhythm.t = Number(r.t) || 0;
            const bpm = Number(r.bpm);
            const per = Number(r.period);
            rhythm.bpm = Number.isFinite(bpm) && bpm > 0 ? bpm : BPM;
            rhythm.period = Number.isFinite(per) && per > 0 ? per : (60 / rhythm.bpm);
          }
        } catch {
          rhythm.active = false;
        }
      }
      unitBounce.period = rhythm.active ? rhythm.period : cfg.period;
      tickDomBounce();
    };
    raf = requestAnimationFrame(loop);
  }

  function stopPhaseLoop() {
    clearInterval(phaseTimer);
    phaseTimer = 0;
  }

  function startPhaseLoop() {
    stopPhaseLoop();
    stampPhases(cfg.preset, cfg.period);
    phaseTimer = setInterval(() => {
      if (!cfg.on) return;
      stampPhases(cfg.preset, cfg.period);
    }, 1200);
  }

  function stopFlipLoop() {
    clearTimeout(flipTimer);
    flipTimer = 0;
  }

  function runFlipBurst() {
    const list = collectTargets(cfg.preset);
    if (!list.length) return;
    const n = Math.min(list.length, 1 + Math.floor(Math.random() * 3));
    for (const el of shuffle(list).slice(0, n)) playFlip(el);
  }

  function scheduleFlip() {
    clearTimeout(flipTimer);
    if (!cfg.on) return;
    const wait = 600 + Math.random() * 2200;
    flipTimer = setTimeout(() => {
      if (!cfg.on) return;
      runFlipBurst();
      scheduleFlip();
    }, wait);
  }

  function apply() {
    const doc = document;
    const html = doc.documentElement;
    unitBounce.on = !!cfg.on;
    unitBounce.period = cfg.period;
    if (!cfg.on) {
      html.classList.remove(ROOT);
      stopFlipLoop();
      stopPhaseLoop();
      stopRaf();
      clearPhases();
      rhythm.active = false;
      rhythm.period = DEFAULT_PERIOD;
      unitBounce.period = cfg.period;
      if (styleEl) { try { styleEl.remove(); } catch {} styleEl = null; }
      return;
    }
    html.classList.add(ROOT);
    const css = buildCss(cfg);
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = STYLE_ID;
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
    startPhaseLoop();
    startRaf();
    scheduleFlip();
  }

  function set(patch) {
    cfg = { ...cfg, ...(patch || {}) };
    if (patch && patch.preset && !PRESETS[patch.preset]) cfg.preset = 'ui';
    cfg.period = DEFAULT_PERIOD;
    cfg.bpm = BPM;
    saveCfg(cfg);
    apply();
    emit();
    return get();
  }

  apply();
  return {
    get,
    set,
    presets: Object.keys(PRESETS),
    bindRhythm(fn) { pulseFn = typeof fn === 'function' ? fn : null; },
    subscribe(fn) { if (typeof fn === 'function') subs.add(fn); return () => subs.delete(fn); },
    dispose() {
      cfg = { ...cfg, on: false };
      pulseFn = null;
      apply();
      try { delete document.documentElement.dataset.spLiteAnim; } catch {}
    },
  };
}
