import { createAnim } from './anim.js';
import { createMusic } from './music.js';

const ROOT_ID = 'sp-lite-root';
const FAB_ID = 'sp-lite-fab';
const FAB_POS_KEY = 'sp.pref.splite.fabPos';
const FAB_SKIN_KEY = 'sp.pref.splite.fabSkin';
const ZAP_KEY = 'sp.pref.splite.zap';
const FAB_IMG_AMIYA = new URL('./assets/amiya-spin.gif', import.meta.url).href;
const FAB_IMG_MMK = new URL('./assets/mmk-spin.gif', import.meta.url).href;

function loadFabSkinId() {
  try {
    const v = localStorage.getItem(FAB_SKIN_KEY);
    if (v === 'mmk' || v === 'fish') return 'mmk';
  } catch {}
  return 'amiya';
}

function loadFabSkin() {
  return loadFabSkinId() === 'mmk' ? FAB_IMG_MMK : FAB_IMG_AMIYA;
}

function saveFabSkin(id) {
  try {
    if (id === 'mmk') localStorage.setItem(FAB_SKIN_KEY, 'mmk');
    else localStorage.removeItem(FAB_SKIN_KEY);
  } catch {}
}

function loadZap() {
  try {
    const v = localStorage.getItem(ZAP_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {}
  return true;
}

function saveZap(on) {
  try { localStorage.setItem(ZAP_KEY, on ? '1' : '0'); } catch {}
}

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v === 'boolean') { if (v) n.setAttribute(k, ''); }
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of kids) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

function loadFabPos() {
  try {
    const o = JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null');
    if (o && typeof o.left === 'number' && typeof o.top === 'number') {
      return { left: o.left, top: o.top, side: o.side === 'right' ? 'right' : 'left' };
    }
  } catch {}
  return null;
}

function saveFabPos(left, top, side) {
  try { localStorage.setItem(FAB_POS_KEY, JSON.stringify({ left, top, side })); } catch {}
}

function injectStyle() {
  let s = document.getElementById('sp-lite-ui-style');
  if (!s) {
    s = document.createElement('style');
    s.id = 'sp-lite-ui-style';
    document.head.appendChild(s);
  }
  s.textContent = `
#${FAB_ID}{
  position:fixed;
  right:max(12px, env(safe-area-inset-right));
  bottom:max(72px, calc(env(safe-area-inset-bottom) + 64px));
  z-index:2147483646;
  --sp-fab: 84px;
  --sp-fab-img: 76px;
  width:var(--sp-fab); height:var(--sp-fab); padding:0;
  display:flex; align-items:center; justify-content:center;
  border-radius:50%; overflow:visible;
  color:transparent; font-size:0; line-height:0;
  background:transparent; border:0;
  cursor:grab; user-select:none; opacity:.95; touch-action:none;
  -webkit-tap-highlight-color:transparent;
  transition:transform .15s ease, opacity .15s ease;
}
#${FAB_ID}.sp-fab-moving{
  transition:left .45s cubic-bezier(0.22, 1, 0.36, 1), top .45s cubic-bezier(0.22, 1, 0.36, 1), transform .15s ease, opacity .15s ease;
}
#${FAB_ID}::before{
  content:''; position:absolute; inset:0; border-radius:50%; z-index:0;
  background:rgba(8,11,10,.55);
  border:1px solid var(--line-3, #4a5751);
  box-shadow:0 2px 10px rgba(0,0,0,.45);
  pointer-events:none;
  transition:border-color .15s ease;
}
#${FAB_ID}:active{ cursor:grabbing; }
#${FAB_ID}:hover{ opacity:1; transform:scale(1.06); }
#${FAB_ID}:hover::before{ border-color:var(--mint-500, #4ed8af); }
#${FAB_ID}.hidden{display:none}
#${FAB_ID} img, #${FAB_ID} .sp-lite-fabimg{
  position:relative; z-index:1;
  width:var(--sp-fab-img); height:var(--sp-fab-img); object-fit:contain; border-radius:50%;
  pointer-events:none; user-select:none; display:block;
}
@media (max-width:900px){
  #${FAB_ID}{
    --sp-fab: clamp(34px, 9vw, 42px);
    --sp-fab-img: clamp(28px, 7.5vw, 36px);
    bottom:max(72px, calc(env(safe-area-inset-bottom) + 60px));
  }
}
@media (max-width:480px){
  #${FAB_ID}{
    --sp-fab: clamp(32px, 8.5vw, 38px);
    --sp-fab-img: clamp(26px, 7vw, 32px);
  }
}
@media (hover:none) and (pointer:coarse){
  #${FAB_ID}:hover{ transform:none; }
}

#${ROOT_ID}{
  position:fixed; left:auto; top:auto;
  right:max(12px, env(safe-area-inset-right)); bottom:max(12px, env(safe-area-inset-bottom));
  z-index:2147483646; width:auto; max-width:calc(100vw - 8px);
  display:flex; flex-direction:row; align-items:stretch; gap:6px;
  color:var(--text-hi, #f2f2f2);
  font-family:var(--font-cjk, "Noto Sans SC", "Microsoft YaHei", sans-serif);
  font-size:12px; line-height:1.3;
  pointer-events:none;
}
#${ROOT_ID}.sp-moving{
  transition:left .45s cubic-bezier(0.22, 1, 0.36, 1), top .45s cubic-bezier(0.22, 1, 0.36, 1);
}
#${ROOT_ID} .sp-sheet.sp-sheet-moving{
  transition:left .45s cubic-bezier(0.22, 1, 0.36, 1) !important;
}
#${ROOT_ID}.hidden{display:none}
#${ROOT_ID} *{ box-sizing:border-box; }
#${ROOT_ID} .sp-card{
  pointer-events:auto;
  background:rgba(14,18,16,.94);
  border:1px solid var(--line-2, #3e4b45);
  box-shadow:0 6px 18px rgba(0,0,0,.45);
  backdrop-filter:blur(8px);
}

#${ROOT_ID} .sp-player{
  position:relative; isolation:isolate; overflow:visible;
  padding:8px 9px 9px; flex:none;
  width:min(300px, calc(100vw - 16px));
  border-color:rgba(78,216,175,.32);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.55),
    inset 0 0 0 1px rgba(78,216,175,.1),
    0 8px 22px rgba(0,0,0,.5);
}
#${ROOT_ID} .sp-player::before{
  content:''; position:absolute; inset:0; pointer-events:none; z-index:2;
  background:
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) left top / 10px 1px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) left top / 1px 10px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) right top / 10px 1px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) right top / 1px 10px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) left bottom / 10px 1px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) left bottom / 1px 10px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) right bottom / 10px 1px no-repeat,
    linear-gradient(var(--mint-400, #59f4ca), var(--mint-400, #59f4ca)) right bottom / 1px 10px no-repeat;
  opacity:.72;
}
#${ROOT_ID} .sp-player.is-armed{
  border-color:rgba(78,216,175,.55);
}
#${ROOT_ID} .sp-player.is-armed::before{ opacity:.95; }
#${ROOT_ID} .sp-player.is-live{
  border-color:var(--mint-400, #59f4ca);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.55),
    inset 0 0 0 1px rgba(89,244,202,.18),
    0 0 16px rgba(78,216,175,.2),
    0 10px 26px rgba(0,0,0,.55);
}
#${ROOT_ID} .sp-player.is-live::before{ opacity:1; }
#${ROOT_ID} .sp-player.is-bounce{
  transform-origin:50% 100%;
  will-change:scale;
}
#${ROOT_ID} .sp-bolt,
#${FAB_ID} .sp-bolt{
  position:absolute; inset:-8px; width:calc(100% + 16px); height:calc(100% + 16px);
  pointer-events:none; z-index:4; overflow:visible;
  opacity:0;
  filter:drop-shadow(0 0 2px rgba(78,216,175,.35));
}
#${FAB_ID} .sp-bolt{
  inset:-56px; width:calc(100% + 112px); height:calc(100% + 112px); z-index:2;
}
#${ROOT_ID} .sp-bolt.is-on,
#${FAB_ID} .sp-bolt.is-on{ animation:sp-lite-bolt .28s ease-out forwards; }
#${ROOT_ID} .sp-bolt polyline,
#${FAB_ID} .sp-bolt polyline{
  fill:none !important; stroke-linecap:round; stroke-linejoin:round;
}
#${ROOT_ID} .sp-bolt .sp-bolt__bloom,
#${FAB_ID} .sp-bolt .sp-bolt__bloom{
  stroke:rgba(78,216,175,.22); stroke-width:3.2;
}
#${ROOT_ID} .sp-bolt .sp-bolt__glow,
#${FAB_ID} .sp-bolt .sp-bolt__glow{
  stroke:rgba(89,244,202,.4); stroke-width:1.6;
}
#${ROOT_ID} .sp-bolt .sp-bolt__core,
#${FAB_ID} .sp-bolt .sp-bolt__core{
  stroke:rgba(180,255,230,.7); stroke-width:.85;
}
@keyframes sp-lite-bolt{
  0%{ opacity:0; }
  15%{ opacity:.55; }
  100%{ opacity:0; }
}
@media (prefers-reduced-motion:reduce){
  #${ROOT_ID} .sp-bolt, #${FAB_ID} .sp-bolt{ display:none; }
}
#${ROOT_ID} .sp-head{
  display:flex; align-items:flex-start; justify-content:space-between; gap:6px;
  margin:0 0 4px;
}
#${ROOT_ID} .sp-stage{
  position:relative; flex:1; min-width:0; height:16px; overflow:hidden;
}
#${ROOT_ID} .sp-stage-reel{
  display:flex; flex-direction:column; will-change:transform;
  transform:translate3d(0,0,0);
}
#${ROOT_ID} .sp-unit{
  flex:none; height:16px; box-sizing:border-box;
  display:flex; flex-direction:column; justify-content:center;
  min-width:0; padding:0;
}
#${ROOT_ID} .sp-prog-block{ margin:0 0 7px; }
#${ROOT_ID} .sp-prog-block.hidden{ display:none; }
#${ROOT_ID} .sp-stage--prog{ height:22px; }
#${ROOT_ID} .sp-stage--prog .sp-unit-prog{ flex:none; height:22px; }
#${ROOT_ID} .sp-unit.is-out{ opacity:.55; }
#${ROOT_ID} .sp-title-wrap{
  position:relative; width:100%; min-width:0; height:16px; overflow:hidden;
}
#${ROOT_ID} .sp-title{
  position:absolute; left:0; top:0; height:16px; line-height:16px; margin:0;
  font-size:12px; font-weight:600; color:var(--text-hi, #f2f2f2);
  white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis;
}
#${ROOT_ID} .sp-title.is-marquee{
  max-width:none; overflow:visible; text-overflow:clip; padding-right:32px;
  animation:sp-title-marquee var(--sp-dur, 8s) linear infinite alternate;
  will-change:transform;
}
#${ROOT_ID} .sp-title.is-empty{ color:var(--text-dim, #5d6863); font-weight:500; }
#${ROOT_ID} .sp-unit.is-out .sp-title{ color:var(--text-dim, #5d6863); font-weight:500; }
@keyframes sp-title-marquee{
  0%, 12%{ transform:translateX(0); }
  88%, 100%{ transform:translateX(calc(0px - var(--sp-shift, 0px))); }
}
#${ROOT_ID} .sp-icons{ display:flex; gap:6px; flex:none; align-items:center; }
#${ROOT_ID} .sp-ico{
  appearance:none; cursor:pointer; width:22px; height:22px; padding:0;
  display:grid; place-items:center;
  border:1px solid transparent; background:transparent;
  color:var(--text-dim, #5d6863); font-size:11px; line-height:1;
}
#${ROOT_ID} .sp-ico:hover, #${ROOT_ID} .sp-ico.is-on{
  color:var(--mint-400, #59f4ca); border-color:var(--mint-a35, rgba(78,216,175,.35));
  background:rgba(78,216,175,.08);
}
#${ROOT_ID} .sp-ico.hidden{ display:none; }
#${ROOT_ID} .sp-switch{
  position:relative; display:inline-flex; align-items:center; gap:6px;
  cursor:pointer; margin:0; height:22px; user-select:none;
  color:var(--text-dim, #5d6863); font-size:10px; font-weight:700; letter-spacing:.06em;
}
#${ROOT_ID} .sp-switch input{
  position:absolute; opacity:0; width:0; height:0; pointer-events:none;
}
#${ROOT_ID} .sp-switch__track{
  position:relative; width:28px; height:15px; border-radius:999px; flex:none;
  background:rgba(47,58,53,.9); border:1px solid var(--line-3, #4a5751);
  transition:background .15s ease, border-color .15s ease;
}
#${ROOT_ID} .sp-switch__track::after{
  content:''; position:absolute; top:1px; left:1px;
  width:11px; height:11px; border-radius:50%;
  background:var(--text-dim, #5d6863);
  transition:transform .15s ease, background .15s ease, box-shadow .15s ease;
}
#${ROOT_ID} .sp-switch input:checked + .sp-switch__track{
  background:rgba(78,216,175,.22); border-color:var(--mint-500, #4ed8af);
}
#${ROOT_ID} .sp-switch input:checked + .sp-switch__track::after{
  transform:translateX(13px); background:var(--mint-400, #59f4ca);
  box-shadow:0 0 6px rgba(89,244,202,.55);
}
#${ROOT_ID} .sp-switch input:checked ~ .sp-switch__lab{ color:var(--mint-400, #59f4ca); }

#${ROOT_ID} .sp-unit-prog{
  display:flex; align-items:center; gap:6px; height:22px; min-width:0;
  cursor:default; touch-action:none;
}
#${ROOT_ID} .sp-time{ font-size:10px; color:var(--text-dim, #5d6863); font-variant-numeric:tabular-nums; min-width:28px; }
#${ROOT_ID} .sp-time.is-end{ text-align:right; }
#${ROOT_ID} .sp-trackwrap{
  position:relative; flex:1; min-width:0; height:22px;
  display:flex; align-items:center;
}
#${ROOT_ID} .sp-bar{
  -webkit-appearance:none; appearance:none; flex:1; height:22px; border-radius:0;
  background:transparent; outline:none; cursor:pointer; margin:0; padding:0; min-width:0;
  position:relative; z-index:1;
}
#${ROOT_ID} .sp-bar::-webkit-slider-runnable-track{
  height:3px; border-radius:0; background:var(--line, #2f3a35);
}
#${ROOT_ID} .sp-bar::-moz-range-track{
  height:3px; border-radius:0; background:var(--line, #2f3a35);
}
#${ROOT_ID} .sp-player.is-mixing .sp-bar{ visibility:hidden; pointer-events:none; }
#${ROOT_ID} .sp-bar::-webkit-slider-thumb{
  -webkit-appearance:none; width:12px; height:12px; border-radius:0; margin-top:-4.5px;
  background:var(--mint-400, #59f4ca); border:0; cursor:pointer; position:relative; z-index:3;
  box-shadow:0 0 0 0 rgba(78,216,175,0);
  transition:width .12s ease, height .12s ease, margin-top .12s ease, box-shadow .12s ease;
}
#${ROOT_ID} .sp-bar::-moz-range-thumb{
  width:12px; height:12px; border-radius:0; background:var(--mint-400, #59f4ca); border:0; cursor:pointer; position:relative; z-index:3;
  box-shadow:0 0 0 0 rgba(78,216,175,0);
  transition:width .12s ease, height .12s ease, box-shadow .12s ease;
}
#${ROOT_ID} .sp-bar:hover::-webkit-slider-thumb,
#${ROOT_ID} .sp-bar:focus-visible::-webkit-slider-thumb,
#${ROOT_ID} .sp-bar.is-seek::-webkit-slider-thumb{
  width:18px; height:18px; margin-top:-7.5px;
  box-shadow:0 0 0 4px rgba(78,216,175,.28);
}
#${ROOT_ID} .sp-bar:hover::-moz-range-thumb,
#${ROOT_ID} .sp-bar:focus-visible::-moz-range-thumb,
#${ROOT_ID} .sp-bar.is-seek::-moz-range-thumb{
  width:18px; height:18px;
  box-shadow:0 0 0 4px rgba(78,216,175,.28);
}
#${ROOT_ID} .sp-cue-dim{
  display:none; position:absolute; top:50%; margin-top:-1.5px; height:3px; z-index:2;
  background:#0b0e0c;
  pointer-events:none;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);
}
#${ROOT_ID} .sp-player.has-cue .sp-cue-dim{ display:block; }
#${ROOT_ID} .sp-player.is-mixing .sp-cue-dim{ display:none; }
#${ROOT_ID} .sp-cue-dim--in{ left:0; }
#${ROOT_ID} .sp-cue-dim--out{ right:0; }
#${ROOT_ID} .sp-filltrack{
  display:none; position:absolute; left:0; right:0; top:50%; margin-top:-1.5px; height:3px;
  background:var(--line, #2f3a35); overflow:hidden; pointer-events:none;
}
#${ROOT_ID} .sp-player.is-mixing .sp-filltrack{ display:block; }
#${ROOT_ID} .sp-mix-tag{
  display:none; margin:4px 0 0; padding:0;
  font-size:9px; font-weight:700; letter-spacing:.1em; text-align:center;
  color:var(--mint-400, #59f4ca); opacity:.9; pointer-events:none;
  line-height:1.2;
}
#${ROOT_ID} .sp-player.is-mixing .sp-mix-tag{ display:block; }
#${ROOT_ID} .sp-player.is-mixing .sp-prog-block{ margin-bottom:2px; }
#${ROOT_ID} .sp-unit-prog.is-in .sp-filltrack{ display:block; }
#${ROOT_ID} .sp-fill{
  position:absolute; left:0; top:0; bottom:0; width:0%;
  background:var(--mint-400, #59f4ca);
}
#${ROOT_ID} .sp-unit-prog.is-out .sp-fill{ background:rgba(140,160,150,.75); }
#${ROOT_ID} .sp-unit-prog.is-out{ opacity:.55; }

#${ROOT_ID} .sp-ctrls{ display:flex; justify-content:center; align-items:center; gap:8px; }
#${ROOT_ID} .sp-ctrl{
  appearance:none; cursor:pointer; border:1px solid var(--line, #2f3a35);
  background:rgba(20,24,22,.9); color:var(--text-md, #c3cbc7);
  width:28px; height:28px; display:grid; place-items:center;
  font-size:12px; padding:0; line-height:1;
}
#${ROOT_ID} .sp-ctrl:hover{ border-color:var(--mint-500, #4ed8af); color:var(--mint-400, #59f4ca); }
#${ROOT_ID} .sp-ctrl--main{
  width:34px; height:34px;
  color:var(--mint-400, #59f4ca);
  border-color:var(--mint-a35, rgba(78,216,175,.35));
  background:rgba(78,216,175,.12);
  font-size:13px;
}
#${ROOT_ID} .sp-ctrl.is-on{
  color:var(--mint-400, #59f4ca);
  border-color:var(--mint-a35, rgba(78,216,175,.35));
}
#${ROOT_ID} .sp-ctrl.hidden{ display:none; }
#${ROOT_ID} .sp-ctrl.is-lock{
  opacity:.45; cursor:not-allowed;
}

#${ROOT_ID} .sp-sheet{
  margin:0; width:min(240px, calc(100vw - 16px)); flex:none;
  overflow:hidden; overscroll-behavior:contain;
  padding:8px 9px; display:flex; flex-direction:column; min-height:0; min-width:0;
  height:auto; max-height:none;
}
#${ROOT_ID} .sp-sheet.hidden{display:none}
#${ROOT_ID} .sp-sheet__hd{
  display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px; flex:none;
}
#${ROOT_ID} .sp-sheet__t{
  margin:0; font-family:var(--font-display, Oxanium, sans-serif);
  font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase;
  color:var(--mint-400, #59f4ca);
}
#${ROOT_ID} .sp-search{
  width:100%; flex:none; margin:0 0 6px; padding:7px 8px; min-height:34px;
  border:1px solid var(--line, #2f3a35); background:rgba(20,24,22,.95);
  color:var(--text-hi, #f2f2f2); font:inherit; font-size:13px; outline:none;
  -webkit-appearance:none; appearance:none; border-radius:0;
}
#${ROOT_ID} .sp-search::placeholder{ color:var(--text-dim, #5d6863); }
#${ROOT_ID} .sp-search:focus{ border-color:var(--mint-a35, rgba(78,216,175,.35)); }
#${ROOT_ID} .sp-sheet__body{
  flex:1 1 auto; min-height:0; height:0;
  overflow-y:auto; overflow-x:hidden;
  -webkit-overflow-scrolling:touch; overscroll-behavior:contain; touch-action:pan-y;
}
#${ROOT_ID} .sp-btn{
  appearance:none; cursor:pointer; border:1px solid var(--line, #2f3a35);
  background:rgba(20,24,22,.9); color:var(--text-md, #c3cbc7);
  font:inherit; font-size:11px; font-weight:600; padding:4px 8px; min-height:24px;
}
#${ROOT_ID} .sp-btn:hover{ border-color:var(--mint-500, #4ed8af); color:var(--mint-400, #59f4ca); }
#${ROOT_ID} .sp-btn--main{
  color:var(--mint-400, #59f4ca); background:rgba(78,216,175,.1);
  border-color:var(--mint-a35, rgba(78,216,175,.35));
}
#${ROOT_ID} .sp-file{ position:relative; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; }
#${ROOT_ID} .sp-file input[type=file]{ position:absolute; inset:0; opacity:0; cursor:pointer; font-size:0; }
#${ROOT_ID} .sp-upload-acts{ display:flex; gap:4px; flex:none; align-items:center; }
#${ROOT_ID} .sp-btn--danger{
  color:#e88; border-color:rgba(232,136,136,.35);
}
#${ROOT_ID} .sp-btn--danger:hover{
  color:#fcc; border-color:rgba(232,136,136,.55); background:rgba(232,136,136,.08);
}
#${ROOT_ID} .sp-list-meta{
  display:flex; align-items:center; justify-content:space-between; gap:6px;
  margin:0 0 6px; flex:none; min-height:22px; flex-wrap:wrap;
}
#${ROOT_ID} .sp-list-count{
  font-size:10px; color:var(--text-dim, #5d6863); letter-spacing:.04em;
}
#${ROOT_ID} .sp-list-acts{ display:flex; gap:4px; flex:none; align-items:center; flex-wrap:wrap; }
#${ROOT_ID} .sp-bpm-prog{
  display:none; width:100%; flex:1 0 100%; gap:6px; align-items:center; margin-top:2px;
}
#${ROOT_ID} .sp-bpm-prog.is-on{ display:flex; }
#${ROOT_ID} .sp-bpm-prog__bar{
  flex:1; min-width:0; height:6px; background:rgba(47,58,53,.7); overflow:hidden;
}
#${ROOT_ID} .sp-bpm-prog__fill{
  height:100%; width:0%; background:var(--mint-500, #4ed8af); transition:width .12s linear;
}
#${ROOT_ID} .sp-bpm-prog__txt{
  flex:none; font-size:10px; color:var(--text-dim, #5d6863); font-variant-numeric:tabular-nums; min-width:3.5em; text-align:right;
}
#${ROOT_ID} .sp-btn.is-on{
  color:var(--mint-400, #59f4ca); border-color:var(--mint-a35, rgba(78,216,175,.35));
  background:rgba(78,216,175,.1);
}
#${ROOT_ID} .sp-btn.is-busy{ opacity:.55; pointer-events:none; }
#${ROOT_ID} .sp-item__meta{
  display:flex; align-items:baseline; justify-content:space-between; gap:8px; min-width:0;
}
#${ROOT_ID} .sp-item__bpm{
  flex:none; font-size:10px; color:var(--text-dim, #5d6863); font-variant-numeric:tabular-nums;
}

#${ROOT_ID} .sp-item{
  display:flex; flex-direction:column; gap:0;
  padding:5px 2px; border-bottom:1px solid rgba(47,58,53,.5); cursor:pointer;
  min-height:28px;
}
#${ROOT_ID} .sp-item:last-child{ border-bottom:0; }
#${ROOT_ID} .sp-item.is-cur .sp-item__name{ color:var(--mint-400, #59f4ca); }
#${ROOT_ID} .sp-item.is-open{
  background:rgba(78,216,175,.06);
  border-bottom-color:rgba(78,216,175,.22);
}
#${ROOT_ID} .sp-item.is-locked{ opacity:.45; cursor:not-allowed; }
#${ROOT_ID} .sp-item__name{
  min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  font-size:12px; font-weight:600; color:var(--text-md, #c3cbc7);
}
#${ROOT_ID} .sp-item__acts{
  display:none; align-items:center; gap:6px; margin-top:6px; padding:0 0 2px;
}
#${ROOT_ID} .sp-item.is-open .sp-item__acts{ display:flex; }
#${ROOT_ID} .sp-item__act{
  appearance:none; cursor:pointer; margin:0; padding:0 8px; height:26px;
  border:1px solid var(--line, #2f3a35); background:rgba(20,24,22,.9);
  color:var(--text-md, #c3cbc7); font:inherit; font-size:11px; font-weight:600;
  display:inline-flex; align-items:center; justify-content:center;
}
#${ROOT_ID} .sp-item__act:hover{
  border-color:var(--mint-500, #4ed8af); color:var(--mint-400, #59f4ca);
}
#${ROOT_ID} .sp-item__act--del{
  margin-left:auto; min-width:26px; padding:0; color:var(--text-dim, #5d6863);
}
#${ROOT_ID} .sp-item__act--del:hover{ color:#e88; border-color:rgba(232,136,136,.45); }
#${ROOT_ID} .sp-empty{ color:var(--text-dim, #5d6863); font-size:11px; text-align:center; padding:10px 0; }
@media (max-width:900px){
  #${ROOT_ID} .sp-player{ width:min(280px, calc(78vw - 12px)); }
  #${ROOT_ID} .sp-sheet{ width:min(250px, calc(70vw - 12px)); }
  #${ROOT_ID} .sp-item{ padding:10px 2px; min-height:40px; }
  #${ROOT_ID} .sp-item__name{ font-size:13px; }
  #${ROOT_ID} .sp-item__act{ height:32px; font-size:12px; }
  #${ROOT_ID} .sp-item__act--del{ min-width:32px; }
  #${ROOT_ID} .sp-search{ min-height:38px; font-size:14px; padding:8px 10px; }
}
#${ROOT_ID}.is-list{
  align-items:flex-start;
  pointer-events:auto;
}
@media (max-width:420px){
  #${ROOT_ID}.is-list{
    flex-direction:column; align-items:stretch;
  }
  #${ROOT_ID}.is-list .sp-player,
  #${ROOT_ID}.is-list .sp-sheet{
    width:min(320px, calc(100vw - 12px));
  }
}

#${ROOT_ID} .sp-playbody{ margin:0; }
#${ROOT_ID} .sp-playbody.hidden{ display:none; }
#${ROOT_ID} .sp-foot{
  display:flex; flex-direction:column; gap:6px; align-items:stretch;
  margin-top:6px; padding-top:6px; border-top:1px solid rgba(47,58,53,.55);
}
#${ROOT_ID} .sp-foot__fx{
  display:flex; width:100%; align-items:stretch; gap:8px;
}
#${ROOT_ID} .sp-foot__fx .sp-tog--fx{
  flex:1 1 0; justify-content:center; min-width:0;
}
#${ROOT_ID} label.sp-tog.is-locked{ opacity:.45; pointer-events:none; }
#${ROOT_ID} label.sp-tog{
  display:inline-flex; align-items:center; gap:4px; cursor:pointer;
  color:var(--text-lo, #8a948f); font-size:10px; margin:0;
  transition:color .15s ease, border-color .15s ease, background .15s ease;
}
#${ROOT_ID} label.sp-tog input{
  appearance:none; -webkit-appearance:none;
  width:7px; height:7px; margin:0; padding:0; flex:none;
  border-radius:50%; box-sizing:border-box;
  border:1px solid var(--line-3, #4a5751);
  background:rgba(20,26,24,.85);
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.25);
  transition:background .15s ease, border-color .15s ease, box-shadow .15s ease;
}
#${ROOT_ID} label.sp-tog input:checked{
  border-color:rgba(89,244,202,.75);
  background:var(--mint-400, #59f4ca);
  box-shadow:0 0 6px rgba(89,244,202,.65), 0 0 1px rgba(89,244,202,.95);
}
#${ROOT_ID} label.sp-tog:has(input:checked){ color:var(--mint-300, #9af8dc); }
#${ROOT_ID} label.sp-tog--fx{
  height:26px; min-height:26px; padding:0 7px; box-sizing:border-box;
  border:1px solid var(--line, #2f3a35);
  background:rgba(20,24,22,.9); color:var(--text-md, #c3cbc7);
  gap:5px; font-size:11px; font-weight:600;
}
#${ROOT_ID} label.sp-tog--fx input{ width:8px; height:8px; }
#${ROOT_ID} label.sp-tog--fx:hover{
  border-color:var(--mint-500, #4ed8af); color:var(--mint-400, #59f4ca);
}
#${ROOT_ID} label.sp-tog--fx:has(input:checked){
  color:var(--mint-400, #59f4ca);
  border-color:var(--mint-a35, rgba(78,216,175,.35));
  background:rgba(78,216,175,.12);
}
#${ROOT_ID} .sp-skin{
  display:flex; align-items:center; gap:8px; margin:0; flex-wrap:wrap;
  color:var(--text-lo, #8a948f); font-size:10px;
}
#${ROOT_ID} .sp-foot__bot{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
}
#${ROOT_ID} .sp-help-btn{
  appearance:none; cursor:pointer; margin:0 0 0 auto; padding:0 8px; height:24px;
  border:1px solid var(--line, #2f3a35); background:rgba(20,24,22,.9);
  color:var(--text-lo, #8a948f); font:inherit; font-size:10px; font-weight:700;
  letter-spacing:.04em; flex:none;
}
#${ROOT_ID} .sp-help-btn:hover{
  color:var(--mint-400, #59f4ca); border-color:var(--mint-a35, rgba(78,216,175,.35));
}
#${ROOT_ID} .sp-help{
  position:fixed; inset:0; z-index:2147483647; display:none;
  align-items:center; justify-content:center;
  padding:max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  background:rgba(0,0,0,.55); pointer-events:auto;
}
#${ROOT_ID} .sp-help.is-on{ display:flex; }
#${ROOT_ID} .sp-help__panel{
  width:min(420px, calc(100vw - 24px)); max-height:min(78vh, 640px);
  display:flex; flex-direction:column; min-height:0;
  background:rgba(14,18,16,.97); border:1px solid rgba(78,216,175,.28);
  box-shadow:0 12px 40px rgba(0,0,0,.55);
}
#${ROOT_ID} .sp-help__hd{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:10px 12px; border-bottom:1px solid rgba(47,58,53,.7); flex:none;
}
#${ROOT_ID} .sp-help__t{
  margin:0; font-size:13px; font-weight:700; color:var(--mint-400, #59f4ca);
  letter-spacing:.06em;
}
#${ROOT_ID} .sp-help__x{
  appearance:none; cursor:pointer; width:26px; height:26px; padding:0;
  border:1px solid transparent; background:transparent;
  color:var(--text-dim, #5d6863); font-size:14px; line-height:1;
}
#${ROOT_ID} .sp-help__x:hover{ color:var(--mint-400, #59f4ca); }
#${ROOT_ID} .sp-help__body{
  flex:1 1 auto; min-height:0; overflow:auto; padding:10px 12px 14px;
  overscroll-behavior:contain;
}
#${ROOT_ID} .sp-guide{
  display:flex; flex-direction:column; gap:10px;
}
#${ROOT_ID} .sp-guide__item{
  display:grid; grid-template-columns:52px minmax(0,1fr); gap:10px; align-items:start;
  padding:8px; border:1px solid rgba(47,58,53,.65); background:rgba(20,24,22,.55);
}
#${ROOT_ID} .sp-guide__pic{
  width:52px; height:52px; display:grid; place-items:center;
  border:1px solid rgba(78,216,175,.28); background:rgba(78,216,175,.08);
  color:var(--mint-400, #59f4ca); font-size:11px; font-weight:800;
  letter-spacing:.04em; text-align:center; line-height:1.15; user-select:none;
}
#${ROOT_ID} .sp-guide__h{
  margin:0 0 3px; font-size:12px; font-weight:700; color:var(--text-hi, #f2f2f2);
}
#${ROOT_ID} .sp-guide__p{
  margin:0; font-size:11px; color:var(--text-lo, #8a948f); line-height:1.45;
}
`;
}

function fmt(t) {
  if (!t || !isFinite(t) || t < 0) return '0:00';
  const s = Math.floor(t % 60);
  const m = Math.floor(t / 60);
  return m + ':' + String(s).padStart(2, '0');
}

const I18N = {
  zh: {
    idle: '未播放', hostPlaying: '卫戍音乐播放中', pick: '点 ≡ 选曲', uploadFirst: '先上传曲子',
    playlist: '播放列表', upload: '上传', uploadFolder: '文件夹', search: '查找曲名', empty: '还没有曲子', noMatch: '无匹配',
    tracksN: '共 {n} 首', sortName: '名称', sortBpm: 'BPM', analyzeBpm: '分析 BPM',
    del: '删除', delAll: '清空', delAllAsk: '清空全部曲子？', close: '关闭', customBgm: 'DJ', rave: '锐舞', zap: '放电', smartCue: 'mix',
    skin: '皮肤', skinAmiya: '阿米娅', skinMmk: 'mmk', copy: '复制曲名', help: '说明', helpTitle: '使用说明',
    playNow: '现在播放', playNext: '下一首播放',
    playPause: '播放/暂停', next: '下一首',
    modeList: '列表循环', modeOne: '单曲循环', modeShuffle: '随机播放',
    modeLock: '原厂循环（不可改）', fab: 'DJ (Alt+L)',
  },
  en: {
    idle: 'Idle', hostPlaying: 'Host BGM', pick: 'Tap ≡ to pick', uploadFirst: 'Upload a track',
    playlist: 'Playlist', upload: 'Upload', uploadFolder: 'Folder', search: 'Search', empty: 'No tracks yet', noMatch: 'No matches',
    tracksN: '{n} tracks', sortName: 'Name', sortBpm: 'BPM', analyzeBpm: 'Analyze BPM',
    del: 'Delete', delAll: 'Clear', delAllAsk: 'Clear all tracks?', close: 'Close', customBgm: 'DJ', rave: 'Rave', zap: 'Zap', smartCue: 'mix',
    skin: 'Skin', skinAmiya: 'Amiya', skinMmk: 'mmk', copy: 'Copy title', help: 'Help', helpTitle: 'Guide',
    playNow: 'Play now', playNext: 'Play next',
    playPause: 'Play / Pause', next: 'Next',
    modeList: 'Repeat all', modeOne: 'Repeat one', modeShuffle: 'Shuffle',
    modeLock: 'Host loop (locked)', fab: 'DJ (Alt+L)',
  },
  ja: {
    idle: '停止中', hostPlaying: '本体BGM再生中', pick: '≡ で選曲', uploadFirst: '曲を追加',
    playlist: 'プレイリスト', upload: '追加', uploadFolder: 'フォルダ', search: '曲名検索', empty: '曲がありません', noMatch: '一致なし',
    tracksN: '{n} 曲', sortName: '名前', sortBpm: 'BPM', analyzeBpm: 'BPM解析',
    del: '削除', delAll: '全削除', delAllAsk: '曲をすべて削除しますか？', close: '閉じる', customBgm: 'DJ', rave: 'レイヴ', zap: '放電', smartCue: 'mix',
    skin: 'スキン', skinAmiya: 'アーミヤ', skinMmk: 'mmk', copy: '曲名をコピー', help: '説明', helpTitle: '使い方',
    playNow: '今すぐ再生', playNext: '次に再生',
    playPause: '再生/一時停止', next: '次へ',
    modeList: '全曲リピート', modeOne: '1曲リピート', modeShuffle: 'シャッフル',
    modeLock: '本体ループ（変更不可）', fab: 'DJ (Alt+L)',
  },
  ko: {
    idle: '대기', hostPlaying: '기본 BGM 재생 중', pick: '≡ 로 선택', uploadFirst: '곡을 업로드',
    playlist: '재생 목록', upload: '업로드', uploadFolder: '폴더', search: '곡 검색', empty: '곡이 없습니다', noMatch: '결과 없음',
    tracksN: '{n}곡', sortName: '이름', sortBpm: 'BPM', analyzeBpm: 'BPM 분석',
    del: '삭제', delAll: '전체삭제', delAllAsk: '모든 곡을 삭제할까요?', close: '닫기', customBgm: 'DJ', rave: '레이브', zap: '방전', smartCue: 'mix',
    skin: '스킨', skinAmiya: '아미야', skinMmk: 'mmk', copy: '곡명 복사', help: '안내', helpTitle: '사용 안내',
    playNow: '지금 재생', playNext: '다음에 재생',
    playPause: '재생/일시정지', next: '다음',
    modeList: '전체 반복', modeOne: '한 곡 반복', modeShuffle: '셔플',
    modeLock: '기본 루프(잠금)', fab: 'DJ (Alt+L)',
  },
  'zh-TW': {
    idle: '未播放', hostPlaying: '衛戍音樂播放中', pick: '點 ≡ 選曲', uploadFirst: '先上傳曲子',
    playlist: '播放列表', upload: '上傳', uploadFolder: '資料夾', search: '查找曲名', empty: '還沒有曲子', noMatch: '無匹配',
    tracksN: '共 {n} 首', sortName: '名稱', sortBpm: 'BPM', analyzeBpm: '分析 BPM',
    del: '刪除', delAll: '清空', delAllAsk: '清空全部曲子？', close: '關閉', customBgm: 'DJ', rave: '銳舞', zap: '放電', smartCue: 'mix',
    skin: '皮膚', skinAmiya: '阿米婭', skinMmk: 'mmk', copy: '複製曲名', help: '說明', helpTitle: '使用說明',
    playNow: '現在播放', playNext: '下一首播放',
    playPause: '播放/暫停', next: '下一首',
    modeList: '列表循環', modeOne: '單曲循環', modeShuffle: '隨機播放',
    modeLock: '原廠循環（不可改）', fab: 'DJ (Alt+L)',
  },
};

function normalizeLang(code) {
  const c = String(code || '').trim().toLowerCase().replace(/_/g, '-');
  if (!c || c === 'zh' || c === 'zh-cn' || c.startsWith('zh-hans')) return 'zh';
  if (c === 'zh-tw' || c === 'zh-hk' || c === 'zh-mo' || c.startsWith('zh-hant')) return 'zh-TW';
  if (c.startsWith('en')) return 'en';
  if (c.startsWith('ja') || c === 'jp') return 'ja';
  if (c.startsWith('ko')) return 'ko';
  if (I18N[c]) return c;
  const base = c.split('-')[0];
  if (I18N[base]) return base;
  return 'zh';
}

function readHostLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q) return normalizeLang(q);
  } catch {}
  try {
    const v = localStorage.getItem('sp.pref.lang');
    if (v) return normalizeLang(v);
  } catch {}
  return 'zh';
}

let uiLang = readHostLang();
function t(key) {
  return (I18N[uiLang] && I18N[uiLang][key]) || I18N.zh[key] || key;
}

function modeUi() {
  return {
    list: { text: '⇄', title: t('modeList') },
    one: { text: '①', title: t('modeOne') },
    shuffle: { text: '⇝', title: t('modeShuffle') },
  };
}

function watchHostLang(onChange) {
  let cur = uiLang;
  const check = () => {
    const next = readHostLang();
    if (next === cur) return;
    cur = next;
    uiLang = next;
    onChange(next);
  };
  try {
    const proto = Storage.prototype;
    if (!proto.__spLiteLangHook) {
      const raw = proto.setItem;
      proto.setItem = function (k, v) {
        raw.call(this, k, v);
        if (k === 'sp.pref.lang') {
          try { window.dispatchEvent(new CustomEvent('sp-lite-lang')); } catch {}
        }
      };
      proto.__spLiteLangHook = true;
    }
  } catch {}
  window.addEventListener('sp-lite-lang', check);
  window.addEventListener('storage', (e) => { if (!e.key || e.key === 'sp.pref.lang') check(); });
  setInterval(check, 800);
}

function createUi(anim, music) {
  let openList = false;
  let listMenuId = null;
  let seeking = false;
  let listQuery = '';
  let listSortKey = 'name';
  let listSortDir = 'asc';
  let listBodyEl = null;
  let listSearchEl = null;
  let listCountEl = null;
  let listSortNameBtn = null;
  let listSortBpmBtn = null;
  let listMetaEl = null;
  let listBpmProgEl = null;
  let listBpmProgFillEl = null;
  let listBpmProgTxtEl = null;
  let bpmScanGen = 0;
  let bpmScanBusy = false;
  let bpmScanDone = 0;
  let bpmScanTotal = 0;

  const root = el('div', { id: ROOT_ID, class: 'hidden' });
  const sheetList = el('div', { class: 'sp-card sp-sheet hidden' });
  const player = el('div', { class: 'sp-card sp-player' });
  const mixTag = el('div', { class: 'sp-mix-tag', text: 'MIXING' });

  const titleA = el('div', { class: 'sp-title is-empty', text: t('idle') });
  const titleB = el('div', { class: 'sp-title', text: '' });
  const titleWrapA = el('div', { class: 'sp-title-wrap' }, [titleA]);
  const titleWrapB = el('div', { class: 'sp-title-wrap' }, [titleB]);
  const timeCur = el('span', { class: 'sp-time', text: '0:00' });
  const timeEnd = el('span', { class: 'sp-time is-end', text: '0:00' });
  const timeCurB = el('span', { class: 'sp-time', text: '0:00' });
  const timeEndB = el('span', { class: 'sp-time is-end', text: '0:00' });
  const fillA = el('div', { class: 'sp-fill' });
  const fillB = el('div', { class: 'sp-fill' });
  const fillTrackA = el('div', { class: 'sp-filltrack' }, [fillA]);
  const fillTrackB = el('div', { class: 'sp-filltrack' }, [fillB]);
  const cueDimIn = el('div', { class: 'sp-cue-dim sp-cue-dim--in', title: '' });
  const cueDimOut = el('div', { class: 'sp-cue-dim sp-cue-dim--out', title: '' });
  const clampBarVal = (el) => {
    const p = music.snapshot().player;
    const dur = p.duration || 0;
    if (!(dur > 0)) return;
    const minPct = Math.ceil(((Number(p.seekMin) || 0) / dur) * 1000);
    const maxRaw = Number(p.seekMax);
    const maxT = Number.isFinite(maxRaw) ? maxRaw : Math.max(0, dur - 3);
    const maxPct = Math.floor((Math.max(Number(p.seekMin) || 0, maxT) / dur) * 1000);
    let v = Number(el.value);
    if (v < minPct) v = minPct;
    if (v > maxPct) v = maxPct;
    el.value = String(v);
  };
  const endSeek = (e) => {
    seeking = false;
    bar.classList.remove('is-seek');
    clampBarVal(e.target);
    const p = music.snapshot().player;
    music.seek((Number(e.target.value) / 1000) * (p.duration || 0));
  };
  const bar = el('input', {
    class: 'sp-bar', type: 'range', min: '0', max: '1000', value: '0', step: '1',
    onPointerDown: (e) => {
      seeking = true;
      bar.classList.add('is-seek');
      e.stopPropagation();
    },
    onInput: (e) => {
      seeking = true;
      bar.classList.add('is-seek');
      clampBarVal(e.target);
    },
    onPointerUp: endSeek,
    onPointerCancel: () => { seeking = false; bar.classList.remove('is-seek'); },
    onChange: endSeek,
  });
  for (const z of [cueDimIn, cueDimOut]) {
    z.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    z.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
  }
  const trackWrapA = el('div', { class: 'sp-trackwrap' }, [bar, cueDimIn, cueDimOut, fillTrackA]);
  const trackWrapB = el('div', { class: 'sp-trackwrap' }, [fillTrackB]);
  const unitProgA = el('div', { class: 'sp-unit-prog' }, [timeCur, trackWrapA, timeEnd]);
  const unitProgB = el('div', { class: 'sp-unit-prog is-in' }, [timeCurB, trackWrapB, timeEndB]);
  const unitA = el('div', { class: 'sp-unit' }, [titleWrapA]);
  const unitB = el('div', { class: 'sp-unit is-in' }, [titleWrapB]);
  const stageReel = el('div', { class: 'sp-stage-reel' }, [unitA, unitB]);
  const stage = el('div', { class: 'sp-stage' }, [stageReel]);
  const progReel = el('div', { class: 'sp-stage-reel' }, [unitProgA, unitProgB]);
  const progBlock = el('div', { class: 'sp-prog-block' }, [
    el('div', { class: 'sp-stage sp-stage--prog' }, [progReel]),
    mixTag,
  ]);
  const btnList = el('button', { class: 'sp-ctrl', type: 'button', title: t('playlist'), text: '≡' });
  const btnClose = el('button', { class: 'sp-ico', type: 'button', title: t('close'), text: '×', onClick: () => hide() });
  const btnCopy = el('button', {
    class: 'sp-ico', type: 'button', title: t('copy'), text: '⎘',
    onClick: (e) => {
      e.stopPropagation();
      const name = String(shownTitle || '').trim()
        .replace(/\.(mp3|ogg|oga|opus|wav|wave|flac|aac|m4a|m4b|mp4|m4v|webm|wma|aiff?|caf)$/i, '');
      if (!name) return;
      const okFlash = () => {
        btnCopy.classList.add('is-on');
        setTimeout(() => btnCopy.classList.remove('is-on'), 500);
      };
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(name).then(okFlash).catch(() => {
          try {
            const ta = document.createElement('textarea');
            ta.value = name;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            okFlash();
          } catch {}
        });
        return;
      }
      try {
        const ta = document.createElement('textarea');
        ta.value = name;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        okFlash();
      } catch {}
    },
  });
  btnList.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!music.snapshot().on) return;
    openList = !openList; paintSheets(); paintIcons();
  });

  const btnPlay = el('button', { class: 'sp-ctrl sp-ctrl--main', type: 'button', text: '▶', title: t('playPause'), onClick: () => music.toggle() });
  const btnNext = el('button', { class: 'sp-ctrl', type: 'button', text: '⏭', title: t('next'), onClick: () => void music.next() });
  const btnMode = el('button', {
    class: 'sp-ctrl', type: 'button', text: '⇄', title: t('modeList'),
    onClick: () => {
      if (btnMode.disabled) return;
      music.cycleMode();
      paintMode();
    },
  });

  const chkBgm = el('input', {
    type: 'checkbox',
    onChange: (e) => {
      music.setOn(e.target.checked);
      if (!e.target.checked) openList = false;
      paintAll();
    },
  });
  const labBgm = el('span', { class: 'sp-switch__lab', text: t('customBgm') });
  const djSwitch = el('label', { class: 'sp-switch', title: t('customBgm') }, [
    chkBgm,
    el('span', { class: 'sp-switch__track' }),
    labBgm,
  ]);
  const icons = el('div', { class: 'sp-icons' }, [btnCopy, djSwitch, btnClose]);
  const head = el('div', { class: 'sp-head' }, [stage, icons]);
  const chkRave = el('input', {
    type: 'checkbox',
    onChange: (e) => {
      anim.set({ on: e.target.checked });
      paintFrame(!!music.snapshot().player?.custom, !!music.snapshot().player?.playing);
    },
  });
  const chkZap = el('input', {
    type: 'checkbox',
    onChange: (e) => {
      saveZap(e.target.checked);
      paintFrame(!!music.snapshot().player?.custom, !!music.snapshot().player?.playing);
    },
  });
  const chkCue = el('input', {
    type: 'checkbox',
    onChange: (e) => {
      const want = e.target.checked;
      const ok = music.setSmartCue(want);
      if (want && ok === false) e.target.checked = false;
      paintAll();
    },
  });
  const labRave = document.createTextNode(t('rave'));
  const labZap = document.createTextNode(t('zap'));
  const labCue = document.createTextNode(t('smartCue'));
  const labSkin = document.createTextNode(t('skin'));
  const labSkinAmiya = document.createTextNode(t('skinAmiya'));
  const labSkinMmk = document.createTextNode(t('skinMmk'));
  const togCue = el('label', { class: 'sp-tog sp-tog--fx' }, [chkCue, labCue]);
  const chkSkinAmiya = el('input', { type: 'checkbox' });
  const chkSkinMmk = el('input', { type: 'checkbox' });
  const skinRow = el('div', { class: 'sp-skin' }, [
    labSkin,
    el('label', { class: 'sp-tog' }, [chkSkinAmiya, labSkinAmiya]),
    el('label', { class: 'sp-tog' }, [chkSkinMmk, labSkinMmk]),
  ]);
  const footFx = el('div', { class: 'sp-foot__fx' }, [
    togCue,
    el('label', { class: 'sp-tog sp-tog--fx' }, [chkZap, labZap]),
    el('label', { class: 'sp-tog sp-tog--fx' }, [chkRave, labRave]),
  ]);
  const btnHelp = el('button', { class: 'sp-help-btn', type: 'button', text: t('help'), title: t('help') });
  const footBot = el('div', { class: 'sp-foot__bot' }, [skinRow, btnHelp]);
  const foot = el('div', { class: 'sp-foot' }, [footFx, footBot]);
  const playBody = el('div', { class: 'sp-playbody' }, [
    el('div', { class: 'sp-ctrls' }, [btnList, btnMode, btnPlay, btnNext]),
  ]);

  const guideItems = [
    { pic: 'FAB', h: '阿米娅悬浮球', p: '拖动可改位置；点击打开/关闭本面板。Alt+L 也可切换。' },
    { pic: 'DJ', h: 'DJ 总开关', p: '右上角滑动开关。关闭后恢复原厂 BGM，并隐藏播放条与控制键。' },
    { pic: 'mix', h: 'mix', p: '开启后按 cue 智能接曲（SYNC/MIXING）。关闭后切歌直接硬切，像普通播放器。' },
    { pic: '电', h: '放电', p: '只控制播放器跳动与闪电特效；可单独开启，不必开锐舞。' },
    { pic: '舞', h: '锐舞', p: '全局跳动（含战场干员与播放器）。开锐舞等于全开相关动效。' },
    { pic: '皮', h: '皮肤', p: '阿米娅 / mmk（金鱼）二选一，点亮圆点切换。' },
    { pic: '≡', h: '播放列表', p: '上传单曲或文件夹。点曲名展开：下一首播放、现在播放、删除。打开列表会自动分析未分析曲的 BPM。' },
    { pic: '⎘', h: '曲名与复制', p: '过长曲名左右滚动显示。点 ⎘ 复制曲名（不含后缀）。' },
    { pic: '⇄', h: '循环模式', p: '列表循环 / 单曲循环 / 随机。下一首播放：列表模式会插到当前曲后继续往下；随机模式只插播一次。' },
  ];
  const helpTitleEl = el('h3', { class: 'sp-help__t', text: t('helpTitle') });
  const helpBody = el('div', { class: 'sp-help__body' });
  const helpGuide = el('div', { class: 'sp-guide' });
  for (const g of guideItems) {
    helpGuide.appendChild(el('div', { class: 'sp-guide__item' }, [
      el('div', { class: 'sp-guide__pic', text: g.pic }),
      el('div', {}, [
        el('div', { class: 'sp-guide__h', text: g.h }),
        el('div', { class: 'sp-guide__p', text: g.p }),
      ]),
    ]));
  }
  helpBody.appendChild(helpGuide);
  const helpClose = el('button', { class: 'sp-help__x', type: 'button', text: '×', title: t('close') });
  const helpPanel = el('div', { class: 'sp-help__panel' }, [
    el('div', { class: 'sp-help__hd' }, [helpTitleEl, helpClose]),
    helpBody,
  ]);
  const helpOverlay = el('div', { class: 'sp-help' }, [helpPanel]);
  const openHelp = () => { helpOverlay.classList.add('is-on'); };
  const closeHelp = () => { helpOverlay.classList.remove('is-on'); };
  btnHelp.addEventListener('click', (e) => { e.stopPropagation(); openHelp(); });
  helpClose.addEventListener('click', (e) => { e.stopPropagation(); closeHelp(); });
  helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) closeHelp();
  });
  helpPanel.addEventListener('click', (e) => e.stopPropagation());

  player.appendChild(head);
  player.appendChild(progBlock);
  player.appendChild(playBody);
  player.appendChild(foot);

  root.appendChild(player);
  root.appendChild(sheetList);
  root.appendChild(helpOverlay);
  document.body.appendChild(root);

  let fab = document.getElementById(FAB_ID);
  if (!fab) {
    fab = el('button', { id: FAB_ID, type: 'button', title: t('fab') });
    document.body.appendChild(fab);
  }
  fab.title = t('fab');
  fab.classList.remove('hidden');
  fab.removeAttribute('style');
  fab.textContent = '';
  fab.appendChild(el('img', {
    class: 'sp-lite-fabimg', alt: '', draggable: 'false', src: loadFabSkin(),
  }));

  function applyFabSkin(src) {
    const img = fab.querySelector('img.sp-lite-fabimg');
    if (img) img.src = src || loadFabSkin();
  }
  function paintSkinChecks() {
    const id = loadFabSkinId();
    chkSkinAmiya.checked = id === 'amiya';
    chkSkinMmk.checked = id === 'mmk';
  }
  function setSkin(id) {
    saveFabSkin(id);
    applyFabSkin(id === 'mmk' ? FAB_IMG_MMK : FAB_IMG_AMIYA);
    paintSkinChecks();
  }
  chkSkinAmiya.addEventListener('change', () => setSkin('amiya'));
  chkSkinMmk.addEventListener('change', () => setSkin('mmk'));
  paintSkinChecks();
  chkZap.checked = loadZap();

  const GAP = 8;
  const EDGE = 4;
  let side = 'left';
  let flipTimer = 0;
  let fabMoveTimer = 0;
  let sheetMoveTimer = 0;
  let lastSheetLeft = null;
  let lastSheetW = 0;

  function guessSheetW(playerW, vw) {
    const narrow = vw <= 900;
    return Math.min(narrow ? 250 : 240, Math.max(160, Math.min(playerW || 280, vw - EDGE * 2)));
  }
  {
    fab.classList.remove('hidden');
    fab.style.visibility = '';
    fab.style.opacity = '';
    fab.style.display = '';
    fab.style.pointerEvents = 'auto';
    const fw = fab.offsetWidth || 44;
    const fh = fab.offsetHeight || 44;
    const fp = loadFabPos();
    let fl;
    let ft;
    if (fp && Number.isFinite(fp.left) && Number.isFinite(fp.top)
      && fp.left >= 0 && fp.top >= 0
      && fp.left < window.innerWidth - 40 && fp.top < window.innerHeight - 40) {
      side = fp.side === 'right' ? 'right' : 'left';
      fl = Math.max(EDGE, Math.min(window.innerWidth - fw - EDGE, fp.left));
      ft = Math.max(EDGE, Math.min(window.innerHeight - fh - EDGE, fp.top));
    } else {
      try { localStorage.removeItem(FAB_POS_KEY); } catch {}
      fl = Math.max(EDGE, window.innerWidth - fw - 12);
      ft = Math.max(EDGE, window.innerHeight - fh - 72);
    }
    fab.style.left = fl + 'px';
    fab.style.top = ft + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    saveFabPos(fl, ft, side);
  }

  function applyLayout(fl, ft, panelLeft, panelTop, opts = {}) {
    const animate = !!opts.animate;
    const lockFab = !!opts.lockFab;
    const lockPanel = !!opts.lockPanel;
    const open = !root.classList.contains('hidden');
    // 拖动中不挂 transition；只在松手 settle 时平滑
    const wantPanelAnim = !lockPanel && animate;
    const wantFabAnim = !lockFab && animate;
    const wantSheetAnim = openList && animate && !lockPanel;

    if (wantPanelAnim) {
      root.classList.add('sp-moving');
      clearTimeout(flipTimer);
      flipTimer = setTimeout(() => root.classList.remove('sp-moving'), 460);
    } else {
      root.classList.remove('sp-moving');
      clearTimeout(flipTimer);
    }

    if (wantFabAnim) {
      fab.classList.add('sp-fab-moving');
      clearTimeout(fabMoveTimer);
      fabMoveTimer = setTimeout(() => fab.classList.remove('sp-fab-moving'), 460);
    } else {
      fab.classList.remove('sp-fab-moving');
      clearTimeout(fabMoveTimer);
    }

    if (wantSheetAnim) {
      sheetList.classList.add('sp-sheet-moving');
      clearTimeout(sheetMoveTimer);
      sheetMoveTimer = setTimeout(() => sheetList.classList.remove('sp-sheet-moving'), 460);
    } else {
      sheetList.classList.remove('sp-sheet-moving');
      clearTimeout(sheetMoveTimer);
    }

    if (wantPanelAnim || wantFabAnim || wantSheetAnim) {
      void root.offsetWidth;
      if (wantFabAnim) void fab.offsetWidth;
      if (wantSheetAnim) void sheetList.offsetWidth;
    }

    if (open) {
      root.style.left = Math.round(panelLeft) + 'px';
      root.style.top = Math.round(panelTop) + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.visibility = '';
    }
    const fw = fab.offsetWidth || 44;
    const fh = fab.offsetHeight || 44;
    const safeL = Math.max(EDGE, Math.min(window.innerWidth - fw - EDGE, Number(fl) || EDGE));
    const safeT = Math.max(EDGE, Math.min(window.innerHeight - fh - EDGE, Number(ft) || EDGE));
    fab.style.left = Math.round(safeL) + 'px';
    fab.style.top = Math.round(safeT) + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    fab.style.visibility = '';
    fab.style.opacity = '';
    fab.style.display = '';
    fab.classList.remove('hidden');
    saveFabPos(safeL, safeT, side);
  }

  function layoutPair(fabLeft, fabTop, opts = {}) {
    const fw = fab.offsetWidth || 48;
    const fh = fab.offsetHeight || 48;
    const open = !root.classList.contains('hidden');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.max(120, player.offsetWidth || 300);
    const h = Math.max(80, player.offsetHeight || 140);
    const listOn = !!(open && openList && !sheetList.classList.contains('hidden'));
    const sw = listOn ? guessSheetW(w, vw) : 0;
    const blockW = listOn ? w + GAP + sw : w;

    // 拖兔子：指尖锁定，只贴边，绝不被面板倒拽
    const fl = Math.max(EDGE, Math.min(vw - fw - EDGE, fabLeft));
    const ft = Math.max(EDGE, Math.min(vh - fh - EDGE, fabTop));
    lastSheetLeft = null;
    lastSheetW = sw;

    if (!open) {
      applyLayout(fl, ft, 0, 0, { ...opts, lockFab: true });
      return { left: fl, top: ft };
    }

    const maxL = vw - EDGE;
    const maxT = vh - EDGE;
    const canSide = blockW + fw + GAP <= maxL - EDGE;
    let panelLeft = 0;
    let panelTop = ft;
    let next = side;

    if (canSide) {
      const roomR = maxL - (fl + fw + GAP);
      const roomL = fl - EDGE - GAP;
      if (side === 'left') {
        if (roomR < blockW && roomL >= blockW) next = 'right';
        else if (roomR < blockW && roomL < blockW) next = roomR >= roomL ? 'left' : 'right';
      } else {
        if (roomL < blockW && roomR >= blockW) next = 'left';
        else if (roomR < blockW && roomL < blockW) next = roomR >= roomL ? 'left' : 'right';
      }
      side = next;

      if (side === 'left') {
        panelLeft = fl + fw + GAP;
        if (panelLeft + blockW > maxL) panelLeft = Math.max(EDGE, maxL - blockW);
      } else {
        panelLeft = fl - GAP - blockW;
        if (panelLeft < EDGE) panelLeft = EDGE;
      }
      if (listOn) lastSheetLeft = panelLeft + w + GAP;
      if (panelTop < EDGE) panelTop = EDGE;
      if (panelTop + h > maxT) panelTop = Math.max(EDGE, maxT - h);
      applyLayout(fl, ft, panelLeft, panelTop, { ...opts, lockFab: true });
      return { left: fl, top: ft };
    }

    panelLeft = Math.max(EDGE, Math.min(vw - w - EDGE, fl + (fw - w) / 2));
    const roomAbove = ft - GAP - EDGE;
    const roomBelow = maxT - (ft + fh + GAP);
    let stack = roomBelow >= roomAbove ? 'below' : 'above';
    if (roomBelow >= h) stack = 'below';
    else if (roomAbove >= h) stack = 'above';
    if (stack === 'above') {
      panelTop = ft - GAP - h;
      if (panelTop < EDGE) panelTop = EDGE;
    } else {
      panelTop = ft + fh + GAP;
      if (panelTop + h > maxT) panelTop = Math.max(EDGE, maxT - h);
    }
    applyLayout(fl, ft, panelLeft, panelTop, { ...opts, lockFab: true });
    return { left: fl, top: ft };
  }

  function fabXY() {
    const r = fab.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }

  function bindPairDrag(handle, { clickToggle = false } = {}) {
    let dragging = false;
    let moved = false;
    let suppressClick = false;
    let ox = 0;
    let oy = 0;
    let sx = 0;
    let sy = 0;
    const MOVE_PX = 10;
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      if (moved) {
        suppressClick = true;
        const p = fabXY();
        layoutPair(p.left, p.top, { animate: true });
        syncSheetPin();
      }
    };
    const onMove = (ev) => {
      if (!dragging) return;
      const cx = ev.clientX;
      const cy = ev.clientY;
      if (!moved && (Math.abs(cx - sx) > MOVE_PX || Math.abs(cy - sy) > MOVE_PX)) moved = true;
      if (!moved) return;
      layoutPair(cx - ox, cy - oy, { animate: false });
      syncSheetPin();
      if (ev.cancelable) ev.preventDefault();
    };
    handle.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      dragging = true;
      moved = false;
      const p = fabXY();
      ox = ev.clientX - p.left;
      oy = ev.clientY - p.top;
      sx = ev.clientX;
      sy = ev.clientY;
      try { handle.setPointerCapture?.(ev.pointerId); } catch {}
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    });
    if (clickToggle) {
      handle.addEventListener('click', (e) => {
        if (suppressClick) {
          suppressClick = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        toggle();
      });
    }
  }

  bindPairDrag(fab, { clickToggle: true });
  window.addEventListener('resize', () => {
    const p = fabXY();
    layoutPair(p.left, p.top, { animate: true });
    syncSheetPin();
    refreshTitleMarquees();
  });

  function paintStatic() {
    btnList.title = t('playlist');
    btnClose.title = t('close');
    btnPlay.title = t('playPause');
    btnNext.title = t('next');
    labBgm.textContent = t('customBgm');
    djSwitch.title = t('customBgm');
    btnCopy.title = t('copy');
    btnHelp.textContent = t('help');
    btnHelp.title = t('help');
    helpTitleEl.textContent = t('helpTitle');
    helpClose.title = t('close');
    labCue.textContent = t('smartCue');
    labRave.textContent = t('rave');
    labZap.textContent = t('zap');
    labSkin.textContent = t('skin');
    labSkinAmiya.textContent = t('skinAmiya');
    labSkinMmk.textContent = t('skinMmk');
    fab.title = t('fab');
  }

  function paintMode() {
    const s = music.snapshot();
    const p = s.player || {};
    const locked = !!p.modeLocked;
    const mode = locked ? 'one' : (p.mode || 'list');
    const modes = modeUi();
    const ui = modes[mode] || modes.list;
    const alone = (s.library || []).length <= 1;
    const mixing = !!(p.mix && p.mix.active);
    const noNext = locked || alone || mixing;
    btnMode.textContent = locked ? '①' : ui.text;
    btnMode.title = locked ? t('modeLock') : ui.title;
    btnMode.classList.toggle('is-on', !locked && mode !== 'list');
    btnMode.classList.toggle('is-lock', locked);
    btnMode.disabled = locked;
    btnNext.classList.toggle('is-lock', noNext);
    btnNext.disabled = noNext;
  }

  function paintIcons() {
    btnList.classList.toggle('is-on', openList);
  }

  function setTransportVisible(on) {
    btnPlay.classList.toggle('hidden', !on);
    btnNext.classList.toggle('hidden', !on);
    btnMode.classList.toggle('hidden', !on);
    progBlock.classList.toggle('hidden', !on);
    if (!on) {
      btnPlay.disabled = false;
      btnNext.disabled = false;
      btnMode.disabled = false;
      btnPlay.classList.remove('is-lock');
      btnNext.classList.remove('is-lock');
      btnMode.classList.remove('is-lock');
    }
  }

  let boltTimer = 0;
  let boltLive = false;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function edgePoint(side) {
    // viewBox 0..100，落在四边上
    if (side === 0) return { x: rand(0, 100), y: 0 };
    if (side === 1) return { x: 100, y: rand(0, 100) };
    if (side === 2) return { x: rand(0, 100), y: 100 };
    return { x: 0, y: rand(0, 100) };
  }

  function jaggedPath(x0, y0, x1, y1) {
    const n = 4 + Math.floor(Math.random() * 4);
    const pts = [`${x0.toFixed(1)},${y0.toFixed(1)}`];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const jag = (Math.random() - 0.5) * (10 + Math.random() * 14);
      const wob = (Math.random() - 0.5) * 3;
      const x = x0 + dx * t + px * jag + wob;
      const y = y0 + dy * t + py * jag + wob;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      // 偶尔分叉一小截
      if (Math.random() < 0.35 && i > 1 && i < n - 1) {
        const bx = x + px * jag * 0.55 + (Math.random() - 0.5) * 8;
        const by = y + py * jag * 0.55 + (Math.random() - 0.5) * 8;
        pts.push(`${bx.toFixed(1)},${by.toFixed(1)}`);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
    pts.push(`${x1.toFixed(1)},${y1.toFixed(1)}`);
    return pts.join(' ');
  }

  function panelOpen() {
    return !root.classList.contains('hidden');
  }

  function boltHost() {
    // 面板开着：中心在播放器；关掉：中心在阿米娅
    return panelOpen() ? player : fab;
  }

  function clearBolts(host) {
    const list = host ? [host] : [player, fab];
    for (const h of list) {
      for (const b of h.querySelectorAll('.sp-bolt')) {
        try { b.remove(); } catch {}
      }
    }
  }

  function spawnBolt() {
    if (!boltLive) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const host = boltHost();
    if (!host) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'sp-bolt');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const end = edgePoint(Math.floor(Math.random() * 4));
    const sx = 50 + rand(-8, 8);
    const sy = 50 + rand(-8, 8);
    const d = jaggedPath(sx, sy, end.x, end.y);
    const mk = (cls) => {
      const p = document.createElementNS(ns, 'polyline');
      p.setAttribute('class', cls);
      p.setAttribute('points', d);
      p.setAttribute('fill', 'none');
      return p;
    };
    svg.appendChild(mk('sp-bolt__bloom'));
    svg.appendChild(mk('sp-bolt__glow'));
    svg.appendChild(mk('sp-bolt__core'));
    const burst = document.createElementNS(ns, 'circle');
    burst.setAttribute('cx', sx.toFixed(1));
    burst.setAttribute('cy', sy.toFixed(1));
    burst.setAttribute('r', String(rand(1.2, 2.4).toFixed(1)));
    burst.setAttribute('fill', 'rgba(89,244,202,.35)');
    burst.setAttribute('opacity', '0.5');
    svg.appendChild(burst);
    host.appendChild(svg);
    requestAnimationFrame(() => svg.classList.add('is-on'));
    setTimeout(() => { try { svg.remove(); } catch {} }, 260);
  }

  function scheduleBolt() {
    clearTimeout(boltTimer);
    if (!boltLive) return;
    const wait = 220 + Math.random() * 520;
    boltTimer = setTimeout(() => {
      if (!boltLive) return;
      spawnBolt();
      if (Math.random() < 0.18) setTimeout(spawnBolt, 50);
      scheduleBolt();
    }, wait);
  }

  let playerBounceRaf = 0;

  function stopPlayerBounce() {
    if (playerBounceRaf) cancelAnimationFrame(playerBounceRaf);
    playerBounceRaf = 0;
    player.classList.remove('is-bounce');
    try { player.style.removeProperty('scale'); } catch {}
  }

  function tickPlayerBounce() {
    playerBounceRaf = requestAnimationFrame(tickPlayerBounce);
    if (!player.classList.contains('is-live')) {
      try { player.style.removeProperty('scale'); } catch {}
      return;
    }
    let r;
    try { r = music.getRhythm(); } catch { return; }
    if (!r || !r.active) {
      try { player.style.removeProperty('scale'); } catch {}
      return;
    }
    const per = (r.period > 0 ? r.period : 60 / 138);
    const a = (Math.sin((r.t / per) * Math.PI * 2) + 1) / 2;
    // 很轻：约 ±1.2%
    const sx = 1.012 * (1 - a) + 0.988 * a;
    const sy = 0.988 * (1 - a) + 1.014 * a;
    player.style.scale = sx.toFixed(4) + ' ' + sy.toFixed(4);
  }

  function startPlayerBounce() {
    if (playerBounceRaf) return;
    player.classList.add('is-bounce');
    playerBounceRaf = requestAnimationFrame(tickPlayerBounce);
  }

  function paintFrame(active, playing) {
    player.classList.toggle('is-armed', !!active);
    const live = !!(active && playing);
    player.classList.toggle('is-live', live);
    const rave = !!anim.get().on; // 锐舞：全局跳动（含播放器/闪电）
    const zap = loadZap(); // 放电：只开播放器跳动/闪电
    const playerFx = rave || zap;
    if (live && playerFx) startPlayerBounce();
    else stopPlayerBounce();
    if (live && playerFx && !boltLive) {
      boltLive = true;
      scheduleBolt();
    } else if ((!live || !playerFx) && boltLive) {
      boltLive = false;
      clearTimeout(boltTimer);
      boltTimer = 0;
      clearBolts();
    }
  }

  function paintPlayerHead() {
    const s = music.snapshot();
    const p = s.player || {};
    const active = !!p.custom;
    if (active && p.name) {
      if (p.mix && p.mix.active) paintMix(p);
      else reelToTitle(p.name, false);
    } else if (!s.on) {
      setTitleStatic(t('hostPlaying'), true);
    } else {
      setTitleStatic(s.library.length ? t('pick') : t('uploadFirst'), true);
    }
    btnPlay.textContent = p.playing ? '⏸' : '▶';
    chkBgm.checked = !!s.on;
    chkCue.checked = s.smartCue !== false;
    {
      const can = p.canEnableSmartCue !== false;
      chkCue.disabled = !chkCue.checked && !can;
      togCue.classList.toggle('is-locked', chkCue.disabled);
      togCue.title = chkCue.disabled ? '仅在安全区间内可开启 mix' : '';
    }
    chkRave.checked = !!anim.get().on;
    chkZap.checked = loadZap();
    paintSkinChecks();
    playBody.classList.toggle('hidden', !s.on);
    btnList.classList.toggle('hidden', !s.on);
    if (!s.on) openList = false;
    setTransportVisible(!!s.on && active);
    paintFrame(active, !!p.playing);
    if (active) paintMode();
  }

  const UNIT_H = 16;
  const PROG_H = 22;

  function setReelY(titlePx, progPx) {
    stageReel.style.transform = 'translate3d(0,' + (-titlePx).toFixed(2) + 'px,0)';
    const py = progPx == null ? (titlePx / UNIT_H) * PROG_H : progPx;
    progReel.style.transform = 'translate3d(0,' + (-py).toFixed(2) + 'px,0)';
  }
  function resetReels() {
    stageReel.style.transition = 'none';
    progReel.style.transition = 'none';
    stageReel.style.transform = 'translate3d(0,0,0)';
    progReel.style.transform = 'translate3d(0,0,0)';
  }
  let shownTitle = '';
  let reelTarget = '';
  let reelLock = false;
  let reelAnim = 0;

  function setUnitProg(curEl, endEl, fillEl, cur, dur) {
    curEl.textContent = fmt(cur);
    endEl.textContent = fmt(dur);
    fillEl.style.width = (dur > 0 ? Math.max(0, Math.min(1, cur / dur)) * 100 : 0).toFixed(2) + '%';
  }

  function paintTitleMarquee(node) {
    if (!node) return;
    node.classList.remove('is-marquee');
    node.style.removeProperty('--sp-shift');
    node.style.removeProperty('--sp-dur');
    node.style.maxWidth = 'none';
    if (node.classList.contains('is-empty')) {
      node.style.maxWidth = '';
      return;
    }
    const wrap = node.parentElement;
    if (!wrap) return;
    const full = node.scrollWidth;
    const box = wrap.clientWidth;
    node.style.maxWidth = '';
    const overflow = full - box;
    if (overflow > 4) {
      node.classList.add('is-marquee');
      node.style.setProperty('--sp-shift', overflow + 'px');
      node.style.setProperty('--sp-dur', Math.max(6, overflow / 24) + 's');
    }
  }

  function refreshTitleMarquees() {
    paintTitleMarquee(titleA);
    paintTitleMarquee(titleB);
  }

  function setTitleStatic(text, empty) {
    if (reelAnim) { cancelAnimationFrame(reelAnim); reelAnim = 0; }
    shownTitle = text || '';
    reelTarget = shownTitle;
    titleA.textContent = shownTitle || t('idle');
    titleA.classList.toggle('is-empty', !!empty || !shownTitle);
    titleA.style.opacity = '1';
    titleB.textContent = '';
    titleB.style.opacity = '1';
    unitA.classList.remove('is-out');
    unitB.classList.remove('is-out');
    unitProgA.classList.remove('is-out');
    unitProgB.classList.remove('is-out');
    resetReels();
    requestAnimationFrame(refreshTitleMarquees);
  }

  function reelToTitle(next, empty) {
    const to = next || '';
    if (reelLock) {
      shownTitle = to;
      reelTarget = to;
      return;
    }
    if (to === shownTitle && !reelAnim) {
      titleA.classList.toggle('is-empty', !!empty || !to);
      return;
    }
    if (reelAnim && reelTarget === to) return;
    if (!shownTitle || !to) {
      setTitleStatic(to, empty);
      return;
    }
    if (reelAnim) cancelAnimationFrame(reelAnim);
    reelTarget = to;
    titleA.textContent = shownTitle;
    titleA.classList.remove('is-empty');
    unitA.classList.add('is-out');
    titleB.textContent = to;
    titleB.classList.toggle('is-empty', !!empty);
    unitB.classList.remove('is-out');
    resetReels();
    const t0 = performance.now();
    const durMs = 420;
    const step = (now) => {
      const u = Math.max(0, Math.min(1, (now - t0) / durMs));
      const ease = 1 - Math.pow(1 - u, 1.35);
      setReelY(ease * UNIT_H);
      if (u < 1) {
        reelAnim = requestAnimationFrame(step);
        return;
      }
      reelAnim = 0;
      shownTitle = to;
      titleA.textContent = to;
      titleA.classList.toggle('is-empty', !!empty);
      unitA.classList.remove('is-out');
      titleB.textContent = '';
      resetReels();
      requestAnimationFrame(refreshTitleMarquees);
    };
    reelAnim = requestAnimationFrame(step);
  }

  function paintMix(st) {
    const mx = st?.mix;
    const on = !!(mx && mx.active);
    player.classList.toggle('is-mixing', on);
    if (on) mixTag.textContent = mx.phase === 'sync' ? 'SYNC' : 'MIXING';
    if (!on) {
      if (reelLock) {
        reelLock = false;
        const name = st?.name || shownTitle;
        setTitleStatic(name, !name);
      }
      return;
    }
    reelLock = true;
    if (reelAnim) { cancelAnimationFrame(reelAnim); reelAnim = 0; }
    const out = mx.out || {};
    const inn = mx.in || {};
    const od = out.duration || 0;
    const id = inn.duration || 0;
    const oc = out.currentTime || 0;
    const ic = inn.currentTime || 0;
    const pr = Math.max(0, Math.min(1, Number(mx.progress) || 0));
    const ease = 1 - Math.pow(1 - pr, 1.35);
    titleA.textContent = out.name || '—';
    titleA.classList.remove('is-empty');
    titleB.textContent = inn.name || '—';
    titleB.classList.remove('is-empty');
    unitA.classList.add('is-out');
    unitB.classList.remove('is-out');
    unitProgA.classList.add('is-out');
    unitProgB.classList.remove('is-out');
    setUnitProg(timeCur, timeEnd, fillA, oc, od);
    setUnitProg(timeCurB, timeEndB, fillB, ic, id);
    requestAnimationFrame(refreshTitleMarquees);
    stageReel.style.transition = 'none';
    progReel.style.transition = 'none';
    setReelY(ease * UNIT_H);
    shownTitle = inn.name || shownTitle;
  }

  function paintCueMask(st) {
    const dur = st?.duration || 0;
    const mixing = !!(st?.mix && st.mix.active);
    const cin = Math.max(0, Number(st?.cueIn) || 0);
    const cout = Number(st?.cueOut) || 0;
    const on = !!(st?.smartCue && dur > 0 && (cin > 0.04 || (cout > 0 && cout < dur - 0.04)));
    player.classList.toggle('has-cue', on && !mixing);
    if (!on || !dur) {
      cueDimIn.style.width = '0%';
      cueDimOut.style.left = '100%';
      cueDimOut.style.width = '0%';
      return;
    }
    const outAt = cout > 0 ? cout : dur;
    const inPct = Math.max(0, Math.min(100, (cin / dur) * 100));
    const outPct = Math.max(0, Math.min(100, (outAt / dur) * 100));
    cueDimIn.style.width = inPct.toFixed(2) + '%';
    cueDimOut.style.left = outPct.toFixed(2) + '%';
    cueDimOut.style.width = Math.max(0, 100 - outPct).toFixed(2) + '%';
  }

  function paintTick(p) {
    if (seeking) return;
    const st = p || music.snapshot().player;
    const active = !!st.custom;
    if (!active) {
      timeCur.textContent = '0:00';
      timeEnd.textContent = '0:00';
      bar.value = '0';
      btnPlay.textContent = '▶';
      player.classList.remove('is-mixing');
      player.classList.remove('has-cue');
      reelLock = false;
      setTransportVisible(false);
      paintFrame(false, false);
      return;
    }
    paintMix(st);
    paintCueMask(st);
    if (!(st.mix && st.mix.active)) {
      const dur = st.duration || 0;
      const cur = st.currentTime || 0;
      timeCur.textContent = fmt(cur);
      timeEnd.textContent = fmt(dur);
      bar.value = String(dur > 0 ? Math.round((cur / dur) * 1000) : 0);
      clampBarVal(bar);
      fillA.style.width = (dur > 0 ? Math.max(0, Math.min(1, cur / dur)) * 100 : 0).toFixed(2) + '%';
      if (st.name) reelToTitle(st.name, false);
    }
    btnPlay.textContent = st.playing ? '⏸' : '▶';
    {
      const on = st.smartCue !== false;
      chkCue.checked = on;
      const can = st.canEnableSmartCue !== false;
      chkCue.disabled = !on && !can;
      togCue.classList.toggle('is-locked', chkCue.disabled);
      togCue.title = chkCue.disabled ? '仅在安全区间内可开启智能 Cue' : '';
    }
    setTransportVisible(true);
    paintFrame(true, !!st.playing);
    paintMode();
  }

  function syncListEls() {
    if (!listBodyEl || !sheetList.contains(listBodyEl)) {
      listBodyEl = sheetList.querySelector('.sp-sheet__body');
    }
    if (!listSearchEl || !sheetList.contains(listSearchEl)) {
      listSearchEl = sheetList.querySelector('.sp-search');
    }
  }

  function scrollListToCurrent() {
    if (!listBodyEl) return;
    const curEl = listBodyEl.querySelector('.sp-item.is-cur');
    if (!curEl) return;
    try {
      curEl.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    } catch {
      try { curEl.scrollIntoView(true); } catch {}
    }
  }

  function refreshList(s, opts = {}) {
    if (!openList) return;
    ensureListShell();
    paintListBody(s || music.snapshot());
    if (opts.scrollCur) {
      requestAnimationFrame(() => {
        syncSheetPin();
        scrollListToCurrent();
      });
    }
  }

  function autoAnalyzeBpms() {
    if (!openList || bpmScanBusy || typeof music.analyzeBpms !== 'function') return;
    const lib = music.snapshot().library || [];
    const need = lib.filter((t) => !(Number(t.bpm) > 0)).length;
    if (!need) return;
    bpmScanBusy = true;
    bpmScanDone = 0;
    bpmScanTotal = lib.length;
    paintListMeta(lib.length);
    const gen = ++bpmScanGen;
    let lastPaint = 0;
    void music.analyzeBpms((p) => {
      if (gen !== bpmScanGen) return;
      bpmScanDone = Number(p?.done) || 0;
      bpmScanTotal = Number(p?.total) || bpmScanTotal;
      if (bpmScanDone - lastPaint >= 4 || bpmScanDone >= bpmScanTotal) {
        lastPaint = bpmScanDone;
        paintListMeta((music.snapshot().library || []).length);
      }
    }, { force: false }).then(() => {
      if (gen !== bpmScanGen) return;
      bpmScanBusy = false;
      bpmScanDone = bpmScanTotal;
      if (!openList) return;
      refreshList();
    }).catch(() => {
      if (gen !== bpmScanGen) return;
      bpmScanBusy = false;
      paintListMeta((music.snapshot().library || []).length);
    });
  }

  function sortArrow() {
    return listSortDir === 'asc' ? '↑' : '↓';
  }

  function paintListMeta(n) {
    if (listCountEl) listCountEl.textContent = t('tracksN').replace('{n}', String(n || 0));
    if (listSortNameBtn) {
      const on = listSortKey === 'name';
      listSortNameBtn.classList.toggle('is-on', on);
      listSortNameBtn.textContent = t('sortName') + (on ? sortArrow() : '');
      listSortNameBtn.title = t('sortName');
    }
    if (listSortBpmBtn) {
      const on = listSortKey === 'bpm';
      listSortBpmBtn.classList.toggle('is-on', on);
      listSortBpmBtn.textContent = t('sortBpm') + (on ? sortArrow() : '');
      listSortBpmBtn.title = t('sortBpm');
    }
    if (listBpmProgEl) {
      listBpmProgEl.classList.toggle('is-on', bpmScanBusy);
      const tot = Math.max(0, bpmScanTotal | 0);
      const done = Math.max(0, Math.min(tot, bpmScanDone | 0));
      const pct = tot > 0 ? Math.round((done / tot) * 100) : 0;
      if (listBpmProgFillEl) listBpmProgFillEl.style.width = pct + '%';
      if (listBpmProgTxtEl) listBpmProgTxtEl.textContent = tot > 0 ? (done + '/' + tot) : '0/0';
    }
  }

  function cmpName(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
  }

  function paintListBody(s) {
    syncListEls();
    if (!listBodyEl) return;
    const snap = s || music.snapshot();
    listBodyEl.textContent = '';
    const q = listQuery.trim().toLowerCase();
    const lib = snap.library || [];
    paintListMeta(lib.length);
    let tracks = !q
      ? lib.slice()
      : lib.filter((t) => String(t.name || '').toLowerCase().includes(q));
    const dir = listSortDir === 'desc' ? -1 : 1;
    tracks.sort((a, b) => {
      if (listSortKey === 'bpm') {
        const ba = Number(a.bpm) || 0;
        const bb = Number(b.bpm) || 0;
        if (ba <= 0 && bb <= 0) return cmpName(a, b);
        if (ba <= 0) return 1;
        if (bb <= 0) return -1;
        if (ba !== bb) return (ba - bb) * dir;
        return cmpName(a, b);
      }
      return cmpName(a, b) * dir;
    });
    if (!lib.length) {
      listBodyEl.appendChild(el('div', { class: 'sp-empty', text: t('empty') }));
      return;
    }
    if (!tracks.length) {
      listBodyEl.appendChild(el('div', { class: 'sp-empty', text: t('noMatch') }));
      return;
    }
    const curId = snap.player?.currentId || null;
    const mixing = !!(snap.player?.mix && snap.player.mix.active);
    if (listMenuId && !tracks.some((t) => t.id === listMenuId)) listMenuId = null;
    for (const track of tracks) {
      const cur = curId === track.id;
      const locked = mixing && !cur;
      const open = !locked && listMenuId === track.id;
      const item = el('div', {
        class: `sp-item${cur ? ' is-cur' : ''}${locked ? ' is-locked' : ''}${open ? ' is-open' : ''}`,
      });
      const meta = el('div', { class: 'sp-item__meta' });
      meta.appendChild(el('div', { class: 'sp-item__name', text: (cur ? '▶ ' : '') + track.name }));
      const bpm = Number(track.bpm) || 0;
      const bpmTxt = bpm > 0
        ? (track.bpmApprox ? ('≈' + Math.round(bpm)) : String(Math.round(bpm)))
        : '—';
      meta.appendChild(el('div', { class: 'sp-item__bpm', text: bpmTxt }));
      meta.addEventListener('click', (e) => {
        e.stopPropagation();
        if (locked) return;
        listMenuId = listMenuId === track.id ? null : track.id;
        paintListBody(snap);
      });
      item.appendChild(meta);
      if (open) {
        const acts = el('div', { class: 'sp-item__acts' });
        const btnNext = el('button', {
          class: 'sp-item__act', type: 'button', text: t('playNext'), title: t('playNext'),
        });
        const btnNow = el('button', {
          class: 'sp-item__act', type: 'button', text: t('playNow'), title: t('playNow'),
        });
        const btnDel = el('button', {
          class: 'sp-item__act sp-item__act--del', type: 'button', text: '×', title: t('del'),
        });
        btnNext.addEventListener('click', (e) => {
          e.stopPropagation();
          music.queueNext(track.id);
          listMenuId = null;
          refreshList();
        });
        btnNow.addEventListener('click', (e) => {
          e.stopPropagation();
          listMenuId = null;
          void music.play(track.id);
          refreshList(undefined, { scrollCur: true });
        });
        btnDel.addEventListener('click', (e) => {
          e.stopPropagation();
          listMenuId = null;
          music.removeTrack(track.id);
          refreshList();
          paintMode();
        });
        acts.appendChild(btnNext);
        acts.appendChild(btnNow);
        acts.appendChild(btnDel);
        item.appendChild(acts);
      }
      listBodyEl.appendChild(item);
    }
  }

  function ensureListShell() {
    syncListEls();
    if (sheetList.querySelector('.sp-sheet__hd') && listBodyEl && listMetaEl) return;
    sheetList.textContent = '';
    listBodyEl = null;
    listSearchEl = null;
    listCountEl = null;
    listSortNameBtn = null;
    listSortBpmBtn = null;
    listBpmProgEl = null;
    listBpmProgFillEl = null;
    listBpmProgTxtEl = null;
    listMetaEl = null;
    const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
    const SKIP_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|ico|txt|md|json|xml|html?|css|js|ts|map|zip|rar|7z|gz|exe|dll|pdf|docx?|xlsx?|pptx?|nfo|log|ini|db|cue|m3u8?|pls|ds_store|torrent|url|lnk)$/i;
    const MEDIA_EXT = /\.(mp3|ogg|oga|opus|wav|wave|flac|aac|m4a|m4b|mp4|m4v|webm|wma|aiff?|caf|ape|wv|tak|dsf|dff|ac3|eac3|dts|amr|3gp|mov|mkv)$/i;
    const isAudioFile = (f) => {
      if (!f || !(f.size > 0) || f.size > MAX_UPLOAD_BYTES) return false;
      const name = f.name || '';
      if (SKIP_EXT.test(name)) return false;
      const typ = String(f.type || '');
      if (typ.startsWith('audio/') || typ.startsWith('video/')) return true;
      if (typ.startsWith('image/') || typ.startsWith('text/') || typ.startsWith('application/json')) return false;
      return MEDIA_EXT.test(name);
    };
    const ingestFiles = async (fileList) => {
      const files = [...(fileList || [])].filter(isAudioFile)
        .sort((a, b) => String(a.webkitRelativePath || a.name).localeCompare(String(b.webkitRelativePath || b.name), undefined, { numeric: true }));
      for (const f of files) await music.addTrack(f);
      autoAnalyzeBpms();
    };
    const ACCEPT = 'audio/*,.mp3,.ogg,.oga,.opus,.wav,.wave,.flac,.aac,.m4a,.m4b,.webm,.wma,.aiff,.aif';
    const fileInput = el('input', {
      type: 'file', accept: ACCEPT, multiple: true,
      onChange: async (e) => {
        await ingestFiles(e.target.files);
        try { e.target.value = ''; } catch {}
        refreshList();
        paintMode();
      },
    });
    const folderInput = el('input', {
      type: 'file', accept: ACCEPT, multiple: true,
      onChange: async (e) => {
        await ingestFiles(e.target.files);
        try { e.target.value = ''; } catch {}
        refreshList();
        paintMode();
      },
    });
    try { folderInput.setAttribute('webkitdirectory', ''); } catch {}
    try { folderInput.setAttribute('directory', ''); } catch {}
    const btnDelAll = el('button', {
      class: 'sp-btn sp-btn--danger', type: 'button', text: t('delAll'), title: t('delAll'),
      onClick: (e) => {
        e.stopPropagation();
        const n = (music.snapshot().library || []).length;
        if (!n) return;
        if (!window.confirm(t('delAllAsk'))) return;
        music.clearTracks();
        listMenuId = null;
        refreshList();
        paintAll();
      },
    });
    sheetList.appendChild(el('div', { class: 'sp-sheet__hd' }, [
      el('h4', { class: 'sp-sheet__t', text: t('playlist') }),
      el('div', { class: 'sp-upload-acts' }, [
        el('label', { class: 'sp-btn sp-btn--main sp-file', title: t('upload') }, [fileInput, t('upload')]),
        el('label', { class: 'sp-btn sp-file', title: t('uploadFolder') }, [folderInput, t('uploadFolder')]),
        btnDelAll,
      ]),
    ]));
    listSearchEl = el('input', {
      class: 'sp-search',
      type: 'search',
      placeholder: t('search'),
      enterkeyhint: 'search',
      autocomplete: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      onInput: (e) => {
        listQuery = e.target.value || '';
        paintListBody(music.snapshot());
      },
    });
    listSearchEl.value = listQuery;
    sheetList.appendChild(listSearchEl);
    listCountEl = el('span', { class: 'sp-list-count', text: '' });
    listSortNameBtn = el('button', {
      class: 'sp-btn', type: 'button', text: t('sortName'), title: t('sortName'),
      onClick: () => {
        if (listSortKey === 'name') listSortDir = listSortDir === 'asc' ? 'desc' : 'asc';
        else { listSortKey = 'name'; listSortDir = 'asc'; }
        paintListBody();
      },
    });
    listSortBpmBtn = el('button', {
      class: 'sp-btn', type: 'button', text: t('sortBpm'), title: t('sortBpm'),
      onClick: () => {
        if (listSortKey === 'bpm') listSortDir = listSortDir === 'asc' ? 'desc' : 'asc';
        else { listSortKey = 'bpm'; listSortDir = 'asc'; }
        paintListBody();
      },
    });
    listBpmProgFillEl = el('div', { class: 'sp-bpm-prog__fill' });
    listBpmProgTxtEl = el('div', { class: 'sp-bpm-prog__txt', text: '0/0' });
    listBpmProgEl = el('div', { class: 'sp-bpm-prog' }, [
      el('div', { class: 'sp-bpm-prog__bar' }, [listBpmProgFillEl]),
      listBpmProgTxtEl,
    ]);
    listMetaEl = el('div', { class: 'sp-list-meta' }, [
      listCountEl,
      el('div', { class: 'sp-list-acts' }, [listSortNameBtn, listSortBpmBtn]),
      listBpmProgEl,
    ]);
    sheetList.appendChild(listMetaEl);
    listBodyEl = el('div', { class: 'sp-sheet__body' });
    sheetList.appendChild(listBodyEl);
  }

  function clearSheetPin() {
    sheetList.style.position = '';
    sheetList.style.left = '';
    sheetList.style.top = '';
    sheetList.style.right = '';
    sheetList.style.bottom = '';
    sheetList.style.width = '';
    sheetList.style.height = '';
    sheetList.style.maxHeight = '';
    sheetList.style.marginTop = '';
    sheetList.style.zIndex = '';
    sheetList.style.opacity = '';
    sheetList.style.pointerEvents = '';
  }

  function syncSheetPin() {
    if (!openList || sheetList.classList.contains('hidden') || root.classList.contains('hidden')) {
      clearSheetPin();
      lastSheetLeft = null;
      return;
    }
    const edge = EDGE;
    const vw = window.innerWidth || document.documentElement.clientWidth || 800;
    const vh = window.innerHeight || document.documentElement.clientHeight || 600;
    const pr = player.getBoundingClientRect();
    const fr = fab.getBoundingClientRect();
    let sw = lastSheetW > 0 ? lastSheetW : guessSheetW(pr.width || 240, vw);
    const h = Math.max(160, vh - edge * 2);
    let left;
    if (lastSheetLeft != null) {
      left = lastSheetLeft;
    } else {
      left = pr.right + GAP;
      if (left + sw > vw - edge) left = pr.left - GAP - sw;
      if (left < edge) left = edge;
      if (left + sw > vw - edge) left = Math.max(edge, vw - edge - sw);
      // 竖排时也避开兔子
      const hitFab = !(left + sw <= fr.left - GAP || left >= fr.right + GAP);
      if (hitFab) {
        const altL = pr.left - GAP - sw;
        const altR = pr.right + GAP;
        if (altL >= edge && (altL + sw <= fr.left - GAP || altL >= fr.right + GAP)) left = altL;
        else if (altR + sw <= vw - edge && (altR + sw <= fr.left - GAP || altR >= fr.right + GAP)) left = altR;
        else left = fr.left + fr.width / 2 < vw / 2 ? Math.max(edge, vw - edge - sw) : edge;
      }
    }

    if (sheetList.classList.contains('sp-sheet-moving')) {
      void sheetList.offsetWidth;
    }
    sheetList.style.position = 'fixed';
    sheetList.style.zIndex = '2147483646';
    sheetList.style.top = edge + 'px';
    sheetList.style.left = Math.floor(left) + 'px';
    sheetList.style.width = Math.floor(sw) + 'px';
    sheetList.style.height = Math.floor(h) + 'px';
    sheetList.style.maxHeight = Math.floor(h) + 'px';
    sheetList.style.right = 'auto';
    sheetList.style.bottom = 'auto';
    sheetList.style.marginTop = '0';
    sheetList.style.opacity = '1';
    sheetList.style.pointerEvents = 'auto';
  }

  function paintSheets() {
    const s = music.snapshot();
    const wasList = !sheetList.classList.contains('hidden');
    root.classList.toggle('is-list', openList);
    sheetList.classList.toggle('hidden', !openList);
    const listJustOpened = openList && !wasList;
    const listJustClosed = !openList && wasList;
    if (!openList) {
      sheetList.textContent = '';
      listBodyEl = null;
      listSearchEl = null;
      clearSheetPin();
    } else {
      refreshList(s, { scrollCur: listJustOpened });
      if (listSearchEl && document.activeElement !== listSearchEl) {
        listSearchEl.value = listQuery;
      }
      autoAnalyzeBpms();
    }
    if (root.classList.contains('hidden')) return;
    if (listJustOpened || listJustClosed) {
      requestAnimationFrame(() => {
        const p = fabXY();
        layoutPair(p.left, p.top, { animate: listJustOpened });
        syncSheetPin();
        if (listJustOpened) scrollListToCurrent();
      });
    } else if (openList) {
      syncSheetPin();
    }
  }

  function paintAll() {
    paintStatic();
    paintPlayerHead();
    paintTick();
    paintIcons();
    paintSheets();
  }

  function onLangChange() {
    if (openList) {
      sheetList.textContent = '';
      listBodyEl = null;
      listSearchEl = null;
      clearSheetPin();
    }
    paintAll();
  }

  watchHostLang(onLangChange);

  function closeList() {
    openList = false;
    root.classList.remove('is-list');
    sheetList.classList.add('hidden');
    sheetList.textContent = '';
    listBodyEl = null;
    listSearchEl = null;
    lastSheetLeft = null;
    lastSheetW = 0;
    clearSheetPin();
    btnList.classList.remove('is-on');
  }

  function show() {
    clearBolts(fab);
    fab.classList.remove('hidden');
    fab.style.visibility = '';
    fab.style.opacity = '';
    fab.style.display = '';
    fab.style.pointerEvents = 'auto';
    closeList();
    const p = fabXY();
    const fl = Number.isFinite(p.left) ? p.left : EDGE;
    const ft = Number.isFinite(p.top) ? p.top : EDGE;
    fab.style.left = fl + 'px';
    fab.style.top = ft + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    root.style.visibility = '';
    root.style.opacity = '';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.classList.remove('hidden');
    layoutPair(fl, ft, { animate: false });
    syncSheetPin();
    paintStatic();
    paintPlayerHead();
    paintTick();
    paintIcons();
    paintSheets();
  }
  function hide() {
    closeList();
    closeHelp();
    root.style.visibility = '';
    root.style.opacity = '';
    root.classList.add('hidden');
    clearBolts(player);
  }
  function toggle() {
    if (root.classList.contains('hidden')) show();
    else hide();
  }

  let listCurId = null;
  music.subscribe(() => {
    const s = music.snapshot();
    paintFrame(!!s.player?.custom, !!s.player?.playing);
    if (root.classList.contains('hidden')) {
      if (openList) refreshList(s);
      return;
    }
    paintAll();
    listCurId = s.player?.currentId || null;
  });
  music.subscribeTick((p) => {
    paintFrame(!!p.custom, !!p.playing);
    if (root.classList.contains('hidden')) return;
    paintTick(p);
    const cur = p?.currentId || null;
    if (openList && cur !== listCurId) {
      listCurId = cur;
      refreshList(undefined, { scrollCur: true });
    }
  });
  anim.subscribe(() => {
    if (!root.classList.contains('hidden')) chkRave.checked = !!anim.get().on;
    const s = music.snapshot();
    paintFrame(!!s.player?.custom, !!s.player?.playing);
  });
  // 初始若已在播，面板关着也要挂闪电到阿米娅
  {
    const s = music.snapshot();
    paintFrame(!!s.player.custom, !!s.player.playing);
  }

  return { show, hide, toggle, root };
}

async function start() {
  if (globalThis.__SP_LITE__?.anim) return;
  globalThis.__SP_LITE__ = { booting: true };
  try {
    injectStyle();
    const anim = createAnim();
    const music = await createMusic();
    anim.bindRhythm(() => music.getRhythm());
    const ui = createUi(anim, music);

    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L')) ui.toggle();
    });

    globalThis.__SP_LITE__ = {
      anim, music,
      open: () => ui.show(),
      close: () => ui.hide(),
      toggle: () => ui.toggle(),
    };
  } catch (e) {
    try { globalThis.__SP_LITE_ERR__ = String(e && (e.stack || e.message || e)); } catch {}
    try { console.warn('[sp-lite] boot failed', e); } catch {}
    try { globalThis.__SP_LITE__ = { booting: false, error: String(e && (e.message || e)) }; } catch {}
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { void start(); }, { once: true });
} else {
  void start();
}
