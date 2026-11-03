const CFG_KEY = 'sp.pref.splite.music.v3';
const CFG_KEY_V2 = 'sp.pref.splite.music.v2';
const CFG_KEY_OLD = 'sp.pref.splite.music';
const DB_NAME = 'sp.lite-music';
const DB_STORE = 'clips';
const AUDIO_URL = '/js/audio.js';

function newLibId() {
  return 'lib_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const PLAY_MODES = ['list', 'one', 'shuffle'];

function sanitizeCfg(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const mode = PLAY_MODES.includes(o.mode) ? o.mode : 'list';
  return {
    on: o.on === true,
    mode,
    smartCue: o.smartCue !== false,
  };
}

function loadCfg() {
  for (const key of [CFG_KEY, CFG_KEY_V2, CFG_KEY_OLD]) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (raw && typeof raw === 'object') {
        const cfg = sanitizeCfg({
          on: raw.on === true,
          mode: raw.mode,
          smartCue: raw.smartCue,
        });
        saveCfg(cfg);
        return cfg;
      }
    } catch {}
  }
  return sanitizeCfg(null);
}

function saveCfg(cfg) {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    localStorage.removeItem(CFG_KEY_V2);
    localStorage.removeItem(CFG_KEY_OLD);
  } catch {}
}

/** 单曲上传上限（字节）；放宽至约 1GB，够长曲/无损 */
const MAX_CLIP_BYTES = 1024 * 1024 * 1024;

function createClipStore() {
  const mem = new Map();
  let db = null;

  function open() {
    return new Promise((resolve) => {
      if (!indexedDB) { resolve(null); return; }
      let done = false;
      const finish = (v) => { if (done) return; done = true; resolve(v); };
      const timer = setTimeout(() => finish(null), 2500);
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => { clearTimeout(timer); db = req.result; finish(db); };
        req.onerror = () => { clearTimeout(timer); finish(null); };
        req.onblocked = () => { clearTimeout(timer); finish(null); };
      } catch {
        clearTimeout(timer);
        finish(null);
      }
    });
  }

  async function load() {
    await open();
    try { await navigator.storage?.persist?.(); } catch {}
    if (!db) return;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2500);
      try {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => {
          clearTimeout(timer);
          for (const row of req.result || []) if (row && row.id && row.blob) mem.set(row.id, row);
          resolve();
        };
        req.onerror = () => { clearTimeout(timer); resolve(); };
      } catch { clearTimeout(timer); resolve(); }
    });
  }

  function persist(row) {
    if (!db) return;
    try { db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(row); } catch {}
  }

  function removeDb(id) {
    if (!db) return;
    try { db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(id); } catch {}
  }

  return {
    load,
    get: (id) => mem.get(id) || null,
    has: (id) => mem.has(id),
    list() {
      return [...mem.values()]
        .map((r) => ({
          id: r.id, name: r.name || 'audio', size: r.size || 0, at: r.at || 0,
          ord: Number.isFinite(r.ord) ? r.ord : (r.at || 0),
          type: r.type || '',
        }))
        .sort((a, b) => (a.ord - b.ord) || ((a.at || 0) - (b.at || 0)));
    },
    async put(id, file) {
      const blob = file instanceof Blob ? file : null;
      if (!blob || !id) return null;
      if (!(blob.size > 0) || blob.size > MAX_CLIP_BYTES) return null;
      const name = (file && file.name) || blob.name || 'audio';
      let maxOrd = 0;
      for (const r of mem.values()) {
        const o = Number.isFinite(r.ord) ? r.ord : (r.at || 0);
        if (o > maxOrd) maxOrd = o;
      }
      const row = {
        id, blob, name, type: blob.type || 'audio/*', size: blob.size,
        at: Date.now(), ord: maxOrd + 10,
      };
      mem.set(id, row);
      persist(row);
      return row;
    },
    async add(file) {
      return this.put(newLibId(), file);
    },
    moveAfter(id, afterId) {
      if (!id || !mem.has(id)) return false;
      const ids = this.list().map((x) => x.id).filter((x) => x !== id);
      let at = afterId ? ids.indexOf(afterId) : -1;
      if (afterId && at < 0) at = ids.length - 1;
      ids.splice(at + 1, 0, id);
      ids.forEach((tid, i) => {
        const row = mem.get(tid);
        if (!row) return;
        row.ord = (i + 1) * 10;
        persist(row);
      });
      return true;
    },
    maxBytes: MAX_CLIP_BYTES,
    remove(id) {
      mem.delete(id);
      removeDb(id);
    },
  };
}

function createHostMute() {
  let audio = null;
  let origPlayBgm = null;
  let origStartBgm = null;
  let origApplyVol = null;
  let muted = false;
  let savedBgmVol = null;
  let guardTimer = 0;

  function killHostBgm() {
    if (!audio) return;
    try { audio.bgmToken = (audio.bgmToken || 0) + 1; } catch {}
    try { audio._fadeOutBgm?.(); } catch {}
    try { audio.bgm = null; } catch {}
    try {
      const g = audio.bgmGain?.gain;
      const t = audio.ctx?.currentTime || 0;
      if (g) {
        g.cancelScheduledValues?.(t);
        g.setValueAtTime(0, t);
      }
        } catch {}
      }

  function installHooks() {
    if (!audio) return;
    if (!origPlayBgm && typeof audio.playBgm === 'function') {
      origPlayBgm = audio.playBgm.bind(audio);
      audio.playBgm = (key) => {
        try {
          audio.lastBgmKey = key;
          audio.wantBgm = key;
        } catch {}
        if (muted) {
          killHostBgm();
          return;
        }
        return origPlayBgm(key);
      };
    }
    if (!origStartBgm && typeof audio._startBgm === 'function') {
      origStartBgm = audio._startBgm.bind(audio);
      audio._startBgm = async (...args) => {
        if (muted) return;
        return origStartBgm(...args);
      };
    }
    if (!origApplyVol && typeof audio._applyVolumes === 'function') {
      origApplyVol = audio._applyVolumes.bind(audio);
      audio._applyVolumes = (...args) => {
        const r = origApplyVol(...args);
        if (muted) {
          try {
            const g = audio.bgmGain?.gain;
            const t = audio.ctx?.currentTime || 0;
            if (g) {
              g.cancelScheduledValues?.(t);
              g.setValueAtTime(0, t);
            }
          } catch {}
        }
        return r;
      };
    }
  }

  function startGuard() {
    clearInterval(guardTimer);
    guardTimer = setInterval(() => {
      if (!muted || !audio) return;
      try {
        if (audio.bgm) killHostBgm();
        else {
          const g = audio.bgmGain?.gain;
          const t = audio.ctx?.currentTime || 0;
          if (g && g.value > 0.001) g.setValueAtTime(0, t);
        }
      } catch {}
    }, 400);
  }

  function stopGuard() {
    clearInterval(guardTimer);
    guardTimer = 0;
  }

  return {
    async boot() {
      try {
        const m = await Promise.race([
          import(AUDIO_URL),
          new Promise((_, rej) => setTimeout(() => rej(new Error('audio import timeout')), 4000)),
        ]);
        audio = m && m.audio && typeof m.audio._buffer === 'function' ? m.audio : null;
      } catch { audio = null; }
      return !!audio;
    },
    ctx: () => audio?.ctx || null,
    async ensureCtx() {
      if (!audio) return null;
      try {
        if (!audio.ctx && typeof audio.unlock === 'function') await audio.unlock();
        else if (audio.ctx?.state === 'suspended') await audio.ctx.resume();
      } catch {}
      return audio.ctx || null;
    },
    setMuted(on) {
      if (!audio) return;
      muted = !!on;
      installHooks();
      if (muted) {
        try {
          if (savedBgmVol == null && audio.volumes) savedBgmVol = audio.volumes.bgm;
          if (audio.volumes) audio.volumes.bgm = 0;
          audio._applyVolumes?.();
        } catch {}
        killHostBgm();
        startGuard();
      } else {
        stopGuard();
        try {
          if (audio.volumes && savedBgmVol != null) audio.volumes.bgm = savedBgmVol;
          savedBgmVol = null;
          audio._applyVolumes?.();
        } catch {}
        try {
          const key = audio.lastBgmKey ?? audio.wantBgm ?? 'lobby';
          audio.wantBgm = null;
          if (origPlayBgm) origPlayBgm(key);
          else audio.playBgm(key);
        } catch {}
      }
    },
    dispose() {
      stopGuard();
      this.setMuted(false);
      if (origPlayBgm && audio) {
        try { audio.playBgm = origPlayBgm; } catch {}
      }
      if (origStartBgm && audio) {
        try { audio._startBgm = origStartBgm; } catch {}
      }
      if (origApplyVol && audio) {
        try { audio._applyVolumes = origApplyVol; } catch {}
      }
      origPlayBgm = null;
      origStartBgm = null;
      origApplyVol = null;
      audio = null;
    },
  };
}

const LOUD_TARGET_RMS = 0.11;
const LOUD_MAX_GAIN = 3.5;
const LOUD_MIN_GAIN = 0.2;

/** 抽样测响度，用于自动增益 */
function measureLoudness(buffer) {
  if (!buffer || !buffer.length) return { rms: 0, peak: 0 };
  const chs = buffer.numberOfChannels || 1;
  const len = buffer.length;
  const step = Math.max(1, Math.floor(len / 200000));
  let sumSq = 0;
  let peak = 0;
  let n = 0;
  for (let c = 0; c < chs; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i += step) {
      const v = data[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      sumSq += v * v;
      n += 1;
    }
  }
  return { rms: n ? Math.sqrt(sumSq / n) : 0, peak };
}

function loudnessGain(buffer) {
  const { rms, peak } = measureLoudness(buffer);
  if (rms < 1e-5) return 1;
  let g = LOUD_TARGET_RMS / rms;
  if (peak > 1e-5 && peak * g > 0.92) g = 0.92 / peak;
  if (g > LOUD_MAX_GAIN) g = LOUD_MAX_GAIN;
  if (g < LOUD_MIN_GAIN) g = LOUD_MIN_GAIN;
  return g;
}

/**
 * 一次扫描：BPM + 智能 cue
 * cueIn  = 拍网格上第一个强鼓点（网格原点）
 * cueOut = 尾奏前出点：须留给「对齐小节 + SYNC预跑 + 48拍混音」
 */
function analyzeTrack(buffer) {
  const fallback = { bpm: 138, cueIn: 0, cueOut: 0 };
  if (!buffer || !buffer.length) return fallback;
  const sr = buffer.sampleRate || 44100;
  const ch0 = buffer.getChannelData(0);
  const dur = buffer.duration || (ch0.length / sr);
  const hop = Math.max(1, Math.floor(sr * 0.01));
  const win = Math.max(hop, Math.floor(sr * 0.02));
  const nFrames = Math.max(0, Math.floor((ch0.length - win) / hop));
  if (nFrames < 40) return { ...fallback, cueOut: Math.max(0, dur - 28) };

  const energies = new Float64Array(nFrames);
  const lowE = new Float64Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    const at = i * hop;
    let s = 0;
    let low = 0;
    let prev = 0;
    const lim = Math.min(win, ch0.length - at);
    for (let j = 0; j < lim; j += 4) {
      const v = ch0[at + j];
      s += v * v;
      const sm = prev * 0.92 + v * 0.08;
      low += sm * sm;
      prev = sm;
    }
    energies[i] = s;
    lowE[i] = low;
  }

  let peak = 0;
  let lowPeak = 0;
  for (let i = 0; i < nFrames; i++) {
    if (energies[i] > peak) peak = energies[i];
    if (lowE[i] > lowPeak) lowPeak = lowE[i];
  }
  if (peak < 1e-12) return { ...fallback, cueOut: Math.max(0, dur - 28) };

  const onset = new Float64Array(nFrames);
  let onsetPeak = 0;
  for (let i = 1; i < nFrames; i++) {
    const rise = Math.max(0, energies[i] - energies[i - 1]);
    const lowRise = Math.max(0, lowE[i] - lowE[i - 1]);
    const o = rise * (0.55 + 0.45 * (lowPeak > 0 ? lowE[i] / lowPeak : 0)) + lowRise * 1.4;
    onset[i] = o;
    if (o > onsetPeak) onsetPeak = o;
  }
  if (onsetPeak < 1e-12) return { ...fallback, cueOut: Math.max(0, dur - 28) };

  // BPM：onset 自相关
  const nAc = Math.min(nFrames, Math.floor(75 * sr / hop));
  let oMean = 0;
  for (let i = 0; i < nAc; i++) oMean += onset[i];
  oMean /= Math.max(1, nAc);
  const minLag = Math.max(2, Math.floor((60 / 178) * sr / hop));
  const maxLag = Math.min(nAc - 2, Math.floor((60 / 74) * sr / hop));
  let bestLag = Math.round((60 / 138) * sr / hop);
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    const lim = nAc - lag;
    for (let i = 0; i < lim; i++) c += (onset[i] - oMean) * (onset[i + lag] - oMean);
    const bpmCand = 60 / (lag * hop / sr);
    const pref = (bpmCand >= 118 && bpmCand <= 148) ? 1.15
      : (bpmCand >= 100 && bpmCand <= 160) ? 1.06 : 1;
    const score = c * pref;
    if (score > bestCorr) { bestCorr = score; bestLag = lag; }
  }
  const consider = [bestLag];
  if (bestLag * 2 <= maxLag) consider.push(bestLag * 2);
  if (Math.floor(bestLag / 2) >= minLag) consider.push(Math.floor(bestLag / 2));
  let pick = bestLag;
  let top = -Infinity;
  for (const lag of consider) {
    let c = 0;
    const lim = nAc - lag;
    for (let i = 0; i < lim; i++) c += (onset[i] - oMean) * (onset[i + lag] - oMean);
    const bpmCand = 60 / (lag * hop / sr);
    const pref = (bpmCand >= 118 && bpmCand <= 148) ? 1.2
      : (bpmCand >= 100 && bpmCand <= 160) ? 1.08 : 1;
    const s = c * pref;
    if (s > top) { top = s; pick = lag; }
  }
  // 抛物线插值细化 lag → BPM
  const corrAt = (lag) => {
    const L = Math.max(minLag, Math.min(maxLag, lag | 0));
    let c = 0;
    const lim = nAc - L;
    for (let i = 0; i < lim; i++) c += (onset[i] - oMean) * (onset[i + L] - oMean);
    return c;
  };
  const c0 = corrAt(pick);
  const cm = corrAt(pick - 1);
  const cp = corrAt(pick + 1);
  const denom = (cm - 2 * c0 + cp);
  const delta = Math.abs(denom) > 1e-12 ? Math.max(-0.49, Math.min(0.49, 0.5 * (cm - cp) / denom)) : 0;
  const lagF = pick + delta;
  let bpm = Math.max(72, Math.min(180, Math.round((60 / (lagF * hop / sr)) * 1000) / 1000));
  const per = 60 / bpm;
  const bar = 4 * per;
  const phrase = 2 * bar;
  const mixWin = 16 * bar;

  // 拍网格相位：加密步进 + 小节重拍加权 + 低频 onset
  const gridScan = Math.min(nFrames, Math.floor(Math.min(dur, 96) * sr / hop));
  const steps = 96;
  let bestOff = 0;
  let bestGrid = -Infinity;
  for (let s = 0; s < steps; s++) {
    const off = (s / steps) * per;
    let score = 0;
    const maxBeats = Math.floor((gridScan * hop / sr - off) / per);
    for (let b = 0; b < maxBeats; b++) {
      const t = off + b * per;
      const fi = Math.round(t * sr / hop);
      if (fi < 0 || fi >= nFrames) continue;
      const w = (b % 4 === 0) ? 2.4 : (b % 2 === 0) ? 1.15 : 0.65;
      const lowW = lowPeak > 0 ? (lowE[fi] / lowPeak) : 0;
      score += (onset[fi] * (0.7 + 0.3 * lowW)) * w;
      if (fi + 1 < nFrames) score += onset[fi + 1] * 0.25 * w;
      if (fi > 0) score += onset[fi - 1] * 0.25 * w;
    }
    if (score > bestGrid) { bestGrid = score; bestOff = off; }
  }

  // cueIn：网格上第一个强底鼓；再微移整网使该点贴 onset 峰
  let cueIn = bestOff;
  const maxInT = Math.min(dur * 0.35, 48);
  const oGate = onsetPeak * 0.16;
  const eGate = peak * 0.05;
  let found = false;
  for (let b = 0; b < 256; b++) {
    const t = bestOff + b * per;
    if (t > maxInT) break;
    if (t < 0.04) continue;
    const fi = Math.round(t * sr / hop);
    if (fi < 1 || fi >= nFrames - 1) continue;
    const o = onset[fi] + onset[fi - 1] * 0.35 + onset[fi + 1] * 0.35;
    const lowOk = lowPeak <= 0 || lowE[fi] >= lowPeak * 0.08;
    if (o >= oGate && energies[fi] >= eGate && lowOk) {
      cueIn = t;
      found = true;
      break;
    }
  }
  if (!found) {
    let ki = 1;
    const limK = Math.min(nFrames, Math.floor(maxInT * sr / hop));
    for (let i = 2; i < limK; i++) if (onset[i] > onset[ki]) ki = i;
    const tRaw = (ki * hop) / sr;
    const n = Math.round((tRaw - bestOff) / per);
    cueIn = Math.max(0, bestOff + n * per);
  }
  // 微对齐：在 ±30ms 内吸到最强 onset，并反推网格原点
  {
    const fi0 = Math.round(cueIn * sr / hop);
    let bestFi = fi0;
    let bestO = -1;
    const r = Math.max(1, Math.floor(0.03 * sr / hop));
    for (let fi = Math.max(1, fi0 - r); fi <= Math.min(nFrames - 2, fi0 + r); fi++) {
      if (onset[fi] >= onset[fi - 1] && onset[fi] >= onset[fi + 1] && onset[fi] > bestO) {
        bestO = onset[fi];
        bestFi = fi;
      }
    }
    if (bestO > 0) {
      const tKick = (bestFi * hop) / sr;
      const n = Math.round((tKick - bestOff) / per);
      bestOff = tKick - n * per;
      if (bestOff < 0) bestOff += per;
      cueIn = bestOff + Math.max(0, Math.round((tKick - bestOff) / per)) * per;
    }
  }

  let outIdx = nFrames - 1;
  const thrOut = peak * 0.035;
  for (let i = nFrames - 1; i >= 0; i--) {
    if (energies[i] >= thrOut) { outIdx = i; break; }
  }
  const endHot = (outIdx * hop) / sr;

  let cueOut = 0;
  if (dur >= mixWin + phrase * 2) {
    // 优先按「尾前 mixWin」早打点，不把 floor 抬到 55% 把出点挤晚
    cueOut = Math.min(endHot, dur) - mixWin;
    const floor = Math.max(cueIn + phrase * 2, dur * 0.38);
    if (cueOut < floor) cueOut = floor;
    const maxOut = Math.min(endHot, dur) - mixWin * 0.85;
    if (cueOut > maxOut) cueOut = maxOut;
    if (cueOut < 0) cueOut = 0;
    const origin = cueIn > 0 ? cueIn : bestOff;
    cueOut = origin + Math.floor((cueOut - origin) / bar) * bar;
    if (cueOut <= cueIn + phrase) cueOut = 0;
    if (cueOut > 0 && Math.min(endHot, dur) - cueOut < mixWin * 0.75) {
      cueOut = origin + Math.floor(((Math.min(endHot, dur) - mixWin) - origin) / bar) * bar;
      if (cueOut <= cueIn + phrase) cueOut = 0;
    }
  }

  return { bpm, cueIn, cueOut };
}

/** 粗扫响度峰值，用于判断片段是否太静 */
function bufferEnergyPeak(buffer) {
  if (!buffer || !buffer.length) return 0;
  const ch0 = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(ch0.length / 4000));
  let peak = 0;
  for (let i = 0; i < ch0.length; i += step) {
    const a = Math.abs(ch0[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

const BPM_FUZZY_GRID = [120, 124, 126, 128, 130, 132, 135, 138, 140, 142, 145, 148, 150, 155, 160];

function snapBpmFuzzy(bpm) {
  const b = Number(bpm) || 0;
  if (!(b > 0)) return 0;
  let pick = BPM_FUZZY_GRID[0];
  let d0 = Infinity;
  for (const g of BPM_FUZZY_GRID) {
    const d = Math.abs(g - b);
    if (d < d0) { d0 = d; pick = g; }
  }
  return pick;
}

/** 极速模糊 BPM：细 hop 连续搜 lag，再贴密网格（含 138） */
function analyzeBpmFuzzy(buffer) {
  if (!buffer || !buffer.length) return 0;
  const sr = buffer.sampleRate || 44100;
  const ch0 = buffer.getChannelData(0);
  const total = ch0.length;
  if (total < sr * 2) return 0;
  const dur = total / sr;
  const skip = dur >= 12 ? Math.min(dur * 0.35, 8) : (dur >= 6 ? dur * 0.2 : 0);
  const a0 = Math.floor(skip * sr);
  const a1 = Math.min(total, a0 + Math.floor(sr * 8));
  if (a1 - a0 < sr * 2) return 0;

  const hop = Math.max(1, Math.floor(sr * 0.02));
  const win = hop;
  const n = Math.floor((a1 - a0 - win) / hop);
  if (n < 40) return 0;
  const onset = new Float64Array(n);
  let prev = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const at = a0 + i * hop;
    let s = 0;
    const lim = Math.min(win, total - at);
    for (let j = 0; j < lim; j += 16) {
      const v = ch0[at + j];
      s += v * v;
    }
    const o = i ? Math.max(0, s - prev) : 0;
    onset[i] = o;
    mean += o;
    prev = s;
  }
  mean /= n;
  const demean = new Float64Array(n);
  for (let i = 0; i < n; i++) demean[i] = onset[i] - mean;

  const corrAt = (lag) => {
    const L = Math.max(1, Math.min(n - 2, lag | 0));
    let c = 0;
    const lim = n - L;
    for (let i = 0; i < lim; i++) c += demean[i] * demean[i + L];
    return c / Math.max(1, lim);
  };

  const minLag = Math.max(2, Math.floor((60 / 168) * sr / hop));
  const maxLag = Math.min(n - 2, Math.floor((60 / 112) * sr / hop));
  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpmCand = 60 / (lag * hop / sr);
    const pref = (bpmCand >= 126 && bpmCand <= 145) ? 1.12
      : (bpmCand >= 118 && bpmCand <= 158) ? 1.04 : 1;
    const score = corrAt(lag) * pref + corrAt(lag * 2) * 0.18;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (!(bestScore > 0) || !bestLag) return 0;

  const c0 = corrAt(bestLag);
  const cm = corrAt(bestLag - 1);
  const cp = corrAt(bestLag + 1);
  const denom = (cm - 2 * c0 + cp);
  const delta = Math.abs(denom) > 1e-12 ? Math.max(-0.49, Math.min(0.49, 0.5 * (cm - cp) / denom)) : 0;
  const bpm = 60 / ((bestLag + delta) * hop / sr);
  return snapBpmFuzzy(bpm);
}

/** 在 buffer 局部窗做低频 onset，返回 {sr,hop,t0,onset,peak} */
function localOnset(buffer, t0, t1) {
  if (!buffer || !buffer.length) return null;
  const sr = buffer.sampleRate || 44100;
  const ch0 = buffer.getChannelData(0);
  const hop = Math.max(1, Math.floor(sr * 0.01));
  const win = Math.max(hop, Math.floor(sr * 0.02));
  const a0 = Math.max(0, Math.floor(t0 * sr));
  const a1 = Math.min(ch0.length - win, Math.floor(t1 * sr));
  if (a1 - a0 < hop * 8) return null;
  const n = Math.floor((a1 - a0 - win) / hop);
  if (n < 8) return null;
  const onset = new Float64Array(n);
  let peak = 0;
  let prevE = 0;
  let prevLow = 0;
  for (let i = 0; i < n; i++) {
    const at = a0 + i * hop;
    let s = 0;
    let low = 0;
    let prev = 0;
    const lim = Math.min(win, ch0.length - at);
    for (let j = 0; j < lim; j += 4) {
      const v = ch0[at + j];
      s += v * v;
      const sm = prev * 0.92 + v * 0.08;
      low += sm * sm;
      prev = sm;
    }
    const rise = Math.max(0, s - prevE);
    const lowRise = Math.max(0, low - prevLow);
    const o = rise * 0.45 + lowRise * 1.6;
    onset[i] = o;
    if (o > peak) peak = o;
    prevE = s;
    prevLow = low;
  }
  if (peak < 1e-12) return null;
  return { sr, hop, t0: a0 / sr, onset, peak };
}

/** 当前位置附近重估 BPM（抗整曲网格漂移） */
function refineBpmNear(buffer, pos, hint) {
  const h = Math.max(72, Math.min(180, Number(hint) || 138));
  const win = localOnset(buffer, Math.max(0, pos - 12), pos + 12);
  if (!win) return h;
  const { sr, hop, onset } = win;
  const n = onset.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += onset[i];
  mean /= n;
  const minLag = Math.max(2, Math.floor((60 / 178) * sr / hop));
  const maxLag = Math.min(n - 2, Math.floor((60 / 74) * sr / hop));
  let bestLag = Math.round((60 / h) * sr / hop);
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += (onset[i] - mean) * (onset[i + lag] - mean);
    const bpm = 60 / (lag * hop / sr);
    const pref = Math.abs(bpm - h) < 8 ? 1.25 : Math.abs(bpm - h) < 16 ? 1.08 : 1;
    // 半/倍靠近 hint 也加权
    const half = Math.abs(bpm * 2 - h) < 8 || Math.abs(bpm / 2 - h) < 8 ? 1.1 : 1;
    const s = c * pref * half;
    if (s > best) { best = s; bestLag = lag; }
  }
  let bpm = 60 / (bestLag * hop / sr);
  // 折到 hint 附近八度
  for (let i = 0; i < 3; i++) {
    if (bpm > h * 1.42) bpm /= 2;
    else if (bpm < h / 1.42) bpm *= 2;
    else break;
  }
  return Math.max(72, Math.min(180, Math.round(bpm * 100) / 100));
}

/** 找 pos 之后最近的真鼓点（文件时间） */
function findNextKick(buffer, pos, bpm) {
  const per = 60 / Math.max(72, Math.min(180, bpm || 138));
  const win = localOnset(buffer, Math.max(0, pos - 0.05), pos + per * 2.5);
  if (!win) return pos + per;
  const { hop, sr, t0, onset, peak } = win;
  const thr = peak * 0.2;
  const minGap = Math.max(2, Math.floor(0.18 * sr / hop));
  let last = -999;
  let firstT = -1;
  let firstO = 0;
  for (let i = 2; i < onset.length - 2; i++) {
    if (onset[i] < thr) continue;
    if (onset[i] <= onset[i - 1] || onset[i] <= onset[i + 1]) continue;
    if (i - last < minGap) {
      if (firstT >= 0 && onset[i] > firstO) {
        firstO = onset[i];
        firstT = t0 + (i * hop) / sr;
      }
      last = i;
      continue;
    }
    const t = t0 + (i * hop) / sr;
    last = i;
    if (t < pos + 0.008) continue;
    if (t > pos + per * 2.3) break;
    if (firstT < 0) {
      firstT = t;
      firstO = onset[i];
    } else if (t - firstT < per * 0.3 && onset[i] > firstO * 1.08) {
      firstT = t;
      firstO = onset[i];
    } else {
      break;
    }
  }
  if (firstT < 0) return pos + per;
  return firstT;
}

/** 在目标点附近吸到最强 onset（不跳拍） */
function nearestKick(buffer, t, bpm, radius = 0.045) {
  const per = 60 / Math.max(72, Math.min(180, bpm || 138));
  const r = Math.max(0.02, Math.min(per * 0.35, Number(radius) || 0.045));
  const win = localOnset(buffer, Math.max(0, t - r), t + r);
  if (!win) return t;
  const { hop, sr, t0, onset, peak } = win;
  if (!(peak > 0)) return t;
  const thr = peak * 0.22;
  let bestT = t;
  let bestScore = -Infinity;
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i] < thr) continue;
    if (onset[i] < onset[i - 1] || onset[i] < onset[i + 1]) continue;
    const tt = t0 + (i * hop) / sr;
    const d = Math.abs(tt - t);
    if (d > r) continue;
    const score = onset[i] * (1 - d / r);
    if (score > bestScore) {
      bestScore = score;
      bestT = tt;
    }
  }
  return bestT;
}

/** 下一小节（4 拍）文件时间 */
function nextBarFileTime(origin, pos, bpm) {
  const per = 60 / Math.max(72, Math.min(180, bpm || 138));
  const o = Math.max(0, Number(origin) || 0);
  const beats = (Math.max(0, pos) - o) / per;
  const bar = Math.ceil((beats + 0.02) / 4) * 4;
  return o + Math.max(0, bar) * per;
}

/** 把时间吸到以 origin 为原点、period 为步长的网格 */
function snapToGrid(t, origin, period) {
  if (!(period > 0)) return t;
  const o = Number(origin) || 0;
  return o + Math.round((t - o) / period) * period;
}

/** 在播放头附近重估网格相位（±半拍），加重小节重拍 */
function refineBeatOrigin(buffer, bpm, hintOrigin, aroundPos) {
  const per = 60 / Math.max(72, Math.min(180, bpm || 138));
  const o0 = Math.max(0, Number(hintOrigin) || 0);
  const center = Number.isFinite(aroundPos) ? aroundPos : o0;
  const win = localOnset(buffer, Math.max(0, center - 10), center + 14);
  if (!win) return o0;
  const { hop, sr, t0, onset, peak } = win;
  if (!(peak > 0)) return o0;
  const tEnd = t0 + (onset.length * hop) / sr;
  let bestD = 0;
  let bestS = -Infinity;
  const steps = 80;
  for (let s = 0; s < steps; s++) {
    const d = ((s / steps) - 0.5) * per;
    const origin = o0 + d;
    let score = 0;
    let b0 = Math.floor((t0 - origin) / per) - 1;
    for (let b = b0; b < b0 + 120; b++) {
      const t = origin + b * per;
      if (t < t0 || t > tEnd) continue;
      const fi = Math.round((t - t0) * sr / hop);
      if (fi < 0 || fi >= onset.length) continue;
      const w = ((b % 4) + 4) % 4 === 0 ? 2.6 : ((b % 2) + 2) % 2 === 0 ? 1.2 : 0.6;
      score += onset[fi] * w;
      if (fi + 1 < onset.length) score += onset[fi + 1] * 0.2 * w;
      if (fi > 0) score += onset[fi - 1] * 0.2 * w;
    }
    if (score > bestS) { bestS = score; bestD = d; }
  }
  let origin = o0 + bestD;
  if (origin < 0) origin += per;
  return origin;
}

/** 小节线微吸到附近底鼓（半径宜小，防吸到军鼓） */
function snapBarToKick(buffer, t, bpm) {
  return nearestKick(buffer, t, bpm, 0.028);
}


function createDeck(host) {
  let master = null;
  let comp = null;
  let analyser = null;
  let freq = null;
  let active = 0;
  let mixToken = 0;
  let mixClock = null; // { t0, t1 } 混音时间窗
  let onEnded = null;
  let loopMode = false;
  let prevBass = 0;
  let lastKickAt = 0;
  let bpmEst = 138;
  let bpmSmooth = 138;
  let phase = 0;
  let lastWall = 0;
  const gaps = [];
  const lanes = [null, null];

  function resetRhythm(keepBpm) {
    prevBass = 0;
    lastKickAt = 0;
    if (!keepBpm) {
      bpmEst = 138;
      bpmSmooth = 138;
    }
    phase = 0;
    lastWall = 0;
    gaps.length = 0;
  }

  function ensureMaster(ctx) {
    if (master && comp && analyser) return;
    master = ctx.createGain();
    master.gain.value = 1;
    comp = ctx.createDynamicsCompressor();
    try {
      comp.threshold.value = -20;
      comp.knee.value = 14;
      comp.ratio.value = 2.8;
      comp.attack.value = 0.01;
      comp.release.value = 0.22;
    } catch {}
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    freq = new Uint8Array(analyser.frequencyBinCount);
    master.connect(analyser);
    analyser.connect(comp);
    comp.connect(ctx.destination);
  }

  function killLane(i) {
    const L = lanes[i];
    if (!L) return;
    try { if (L._startTimer) { clearTimeout(L._startTimer); L._startTimer = 0; } } catch {}
    try { if (L._rateTimers) { for (const id of L._rateTimers) clearTimeout(id); L._rateTimers = []; } } catch {}
    try { if (L.src) L.src.onended = null; } catch {}
    try { L.src?.stop?.(); } catch {}
    try {
      if (L.media) {
        L.media.onended = null;
        L.media.pause();
        L.media.removeAttribute('src');
        L.media.load();
      }
    } catch {}
    try { if (L.objectUrl) URL.revokeObjectURL(L.objectUrl); } catch {}
    for (const n of L.nodes || []) {
      try { n.disconnect(); } catch {}
    }
    lanes[i] = null;
  }

  function stop() {
    mixToken += 1;
    mixClock = null;
    killLane(0);
    killLane(1);
    resetRhythm(false);
  }

  function mixSnapshot() {
    const inn = lanes[active];
    const out = lanes[active ^ 1];
    if (!inn?.src || !out?.src) return null;
    const ctx = host.ctx();
    let progress = 0;
    let phase = 'mix';
    if (mixClock && ctx) {
      const now = ctx.currentTime;
      const prep0 = mixClock.prep0 != null ? mixClock.prep0 : mixClock.t0;
      const sync0 = mixClock.sync0 != null ? mixClock.sync0 : prep0;
      if (now < mixClock.t0) {
        phase = 'sync';
        const prepSpan = Math.max(0.001, mixClock.t0 - prep0);
        progress = Math.max(0, Math.min(0.12, ((now - prep0) / prepSpan) * 0.12));
        if (now >= sync0) progress = Math.max(progress, 0.06);
      } else {
        phase = 'mix';
        const span = Math.max(0.001, mixClock.t1 - mixClock.t0);
        progress = Math.max(0.12, Math.min(1, 0.12 + 0.88 * ((now - mixClock.t0) / span)));
      }
    }
    return {
      progress,
      phase,
      out: { currentTime: lanePos(out), duration: out.dur || 0 },
      in: { currentTime: lanePos(inn), duration: inn.dur || 0 },
    };
  }

  function lanePos(L) {
    const ctx = host.ctx();
    if (!ctx || !L || !L.dur) return 0;
    if (L.media) {
      try {
        const t = Number(L.media.currentTime);
        if (Number.isFinite(t)) return Math.max(0, Math.min(L.dur, t));
      } catch {}
      return L.offset || 0;
    }
    if (!L.src) return L.offset || 0;
    const now = ctx.currentTime;
    let played = 0;
    if (L.rateRamp) {
      const { r0, r1, t0, t1 } = L.rateRamp;
      const base = L.ratePre != null ? L.ratePre : r0;
      if (now <= t0) {
        played = Math.max(0, now - L.t0) * base;
      } else {
        played = Math.max(0, t0 - L.t0) * base;
        const T = Math.max(0.001, t1 - t0);
        const e = Math.max(0, Math.min(T, now - t0));
        played += r0 * e + (r1 - r0) * e * e / (2 * T);
        if (now > t1) played += (now - t1) * r1;
      }
    } else {
      played = Math.max(0, now - L.t0) * (L.rate || 1);
    }
    const p = (played + (L.offset || 0)) % L.dur;
    return p < 0 ? p + L.dur : p;
  }

  function clearRateTimers(L) {
    if (!L?._rateTimers) return;
    for (const id of L._rateTimers) clearTimeout(id);
    L._rateTimers = [];
  }

  function openLaneFull(L, g, when) {
    if (!L) return;
    const t = when != null ? when : (host.ctx()?.currentTime || 0);
    const gain = Number.isFinite(g) ? g : (Number.isFinite(L.gain) ? L.gain : 1);
    try {
      L.lowG?.gain.cancelScheduledValues(t);
      L.midG?.gain.cancelScheduledValues(t);
      L.highG?.gain.cancelScheduledValues(t);
      L.lowG.gain.setValueAtTime(1, t);
      L.midG.gain.setValueAtTime(1, t);
      L.highG.gain.setValueAtTime(1, t);
      L.bus.gain.cancelScheduledValues(t);
      L.bus.gain.setValueAtTime(Math.max(0.001, gain), t);
    } catch {}
  }

  function applyRate(L, rate, opts = {}) {
    if (!L) return;
    const r = Math.max(0.5, Math.min(2, Number(rate) || 1));
    const to = opts.rampTo != null ? Math.max(0.5, Math.min(2, Number(opts.rampTo) || 1)) : null;
    const dur = opts.rampDur > 0.02 ? opts.rampDur : 0;
    const now = opts.when != null ? opts.when : (host.ctx()?.currentTime || 0);
    L.rate = r;
    if (L.media) {
      const setMedia = (v) => {
        try {
          L.media.preservesPitch = true;
          if ('mozPreservesPitch' in L.media) L.media.mozPreservesPitch = true;
          if ('webkitPreservesPitch' in L.media) L.media.webkitPreservesPitch = true;
          L.media.playbackRate = v;
        } catch {}
        L.rate = v;
        if (L.src?.playbackRate) L.src.playbackRate.value = v;
      };
      if (to == null || !(dur > 0) || Math.abs(to - r) < 0.0008) {
        clearRateTimers(L);
        setMedia(to != null ? to : r);
        return;
      }
      clearRateTimers(L);
      // 匀速线性步进（避免 setValueCurve 抛错导致整段混音静音）
      const steps = Math.max(20, Math.min(100, Math.round(dur * 40)));
      L._rateTimers = [];
      setMedia(r);
      for (let i = 1; i <= steps; i++) {
        const id = setTimeout(() => {
          if (!L.media) return;
          setMedia(r + (to - r) * (i / steps));
        }, (dur * 1000 * i) / steps);
        L._rateTimers.push(id);
      }
      return;
    }
    if (!L.src?.playbackRate) return;
    try {
      L.src.playbackRate.cancelScheduledValues(now);
      L.rateRamp = null;
      L.ratePre = null;
      if (to == null || !(dur > 0) || Math.abs(to - r) < 0.0008) {
        L.src.playbackRate.setValueAtTime(to != null ? to : r, now);
        L.rate = to != null ? to : r;
      } else {
        L.src.playbackRate.setValueAtTime(r, now);
        L.src.playbackRate.linearRampToValueAtTime(to, now + dur);
        L.rate = to;
        L.rateRamp = { r0: r, r1: to, t0: now, t1: now + dur };
        L.ratePre = r;
      }
    } catch {
      try {
        L.src.playbackRate.setValueAtTime(to != null ? to : r, now);
        L.rate = to != null ? to : r;
      } catch {}
    }
  }

  function position() {
    const L = lanes[active];
    return L ? lanePos(L) : 0;
  }

  function duration() {
    const L = lanes[active];
    return L?.dur || 0;
  }

  function isPlaying() {
    return !!(lanes[active]?.src);
  }

  async function decode(blob) {
    const ctx = await host.ensureCtx();
    if (!ctx || !blob) return null;
    const ab = await blob.arrayBuffer();
    return new Promise((resolve) => {
          try {
            const r = ctx.decodeAudioData(ab.slice(0), resolve, () => resolve(null));
            if (r && typeof r.then === 'function') r.then(resolve, () => resolve(null));
          } catch { resolve(null); }
        });
  }

  async function decodeHead(blob, maxBytes) {
    if (!blob) return null;
    const cap = Math.max(64 * 1024, maxBytes | 0);
    // 只从文件头解：压缩格式中间切片常解出乱波形，BPM 会飞
    let buf = await decode(blob.size > cap ? blob.slice(0, cap) : blob);
    if (!buf && blob.size > cap) {
      buf = await decode(blob.slice(0, Math.min(blob.size, cap * 2)));
    }
    if ((!buf || (buf.duration || 0) < 3) && blob.size > cap * 2) {
      const mid = await decode(blob.slice(0, Math.min(blob.size, Math.max(cap * 3, 2.5 * 1024 * 1024))));
      if (mid && (mid.duration || 0) >= (buf?.duration || 0)) buf = mid;
    }
    if ((!buf || (buf.duration || 0) < 3) && blob.size > 3 * 1024 * 1024) {
      const full = await decode(blob);
      if (full) buf = full;
    }
    if (!buf) return null;
    if ((buf.duration || 0) < 2.5) return null;
    return buf;
  }

  /** BPM 用：尽量解出足够长以越过 intro（压缩格式仍只能从头解） */
  async function decodeForBpm(blob) {
    if (!blob) return null;
    const size = blob.size || 0;
    // ~90s@256kbps ≈ 2.8MB；优先够长再丢 intro
    const targets = [
      Math.min(size, 3 * 1024 * 1024),
      Math.min(size, 5 * 1024 * 1024),
      size,
    ];
    let best = null;
    for (const cap of targets) {
      if (cap < 64 * 1024) continue;
      if (best && (best.duration || 0) >= 55) break;
      const buf = await decode(size > cap ? blob.slice(0, cap) : blob);
      if (!buf) continue;
      if (!best || (buf.duration || 0) > (best.duration || 0)) best = buf;
      if ((buf.duration || 0) >= 55) break;
    }
    if (!best || (best.duration || 0) < 2.5) return null;
    return best;
  }

  function buildLane(ctx, decoded, autoG, opts = {}) {
    const g0 = Number.isFinite(autoG) ? autoG : 1;
    const rate = opts.exactRate
      ? Math.max(0.5, Math.min(2, Number(opts.rate) || 1))
      : Math.max(0.92, Math.min(1.08, Number(opts.rate) || 1));
    const bus = ctx.createGain();
    bus.gain.value = opts.busGain != null ? opts.busGain : g0;

    const lowG = ctx.createGain();
    const midG = ctx.createGain();
    const highG = ctx.createGain();
    lowG.gain.value = opts.low != null ? opts.low : 1;
    midG.gain.value = opts.mid != null ? opts.mid : 1;
    highG.gain.value = opts.high != null ? opts.high : 1;

    const lowLP = ctx.createBiquadFilter();
    lowLP.type = 'lowpass';
    lowLP.frequency.value = 250;
    lowLP.Q.value = 0.7;

    const midHP = ctx.createBiquadFilter();
    midHP.type = 'highpass';
    midHP.frequency.value = 250;
    midHP.Q.value = 0.7;
    const midLP = ctx.createBiquadFilter();
    midLP.type = 'lowpass';
    midLP.frequency.value = 3200;
    midLP.Q.value = 0.7;

    const highHP = ctx.createBiquadFilter();
    highHP.type = 'highpass';
    highHP.frequency.value = 3200;
    highHP.Q.value = 0.7;

    lowLP.connect(lowG);
    midHP.connect(midLP);
    midLP.connect(midG);
    highHP.connect(highG);
    lowG.connect(bus);
    midG.connect(bus);
    highG.connect(bus);
    bus.connect(master);

    const dur = decoded.duration || 0;
    const off = Math.max(0, Math.min(Number(opts.offset) || 0, Math.max(0, dur - 0.05)));
    const when = opts.when != null ? opts.when : (ctx.currentTime + 0.02);
    const my = opts.token;
    const blob = opts.blob || null;

    let src = null;
    let media = null;
    let mediaSrc = null;
    let objectUrl = null;
    let startTimer = 0;
    const nodes = [bus, lowG, midG, highG, lowLP, midHP, midLP, highHP];
    const needStretch = !!(blob && Math.abs(rate - 1) > 0.008);
    const lane = {
      src: null, media: null, objectUrl: null, bus, lowG, midG, highG, nodes,
      buf: decoded, dur, offset: off, t0: when, rate, gain: g0, token: my,
      bpm: Math.max(72, Math.min(180, Number(opts.bpmHint) || 0)) || 0,
      beatOrigin: off,
      _startTimer: 0,
      _rateTimers: [],
    };

    if (needStretch) {
      objectUrl = URL.createObjectURL(blob);
      media = new Audio();
      media.preload = 'auto';
      media.src = objectUrl;
      media.preservesPitch = true;
      try { media.mozPreservesPitch = true; } catch {}
      try { media.webkitPreservesPitch = true; } catch {}
      media.playbackRate = rate;
      media.loop = !!opts.loop;
      mediaSrc = ctx.createMediaElementSource(media);
      mediaSrc.connect(lowLP);
      mediaSrc.connect(midHP);
      mediaSrc.connect(highHP);
      nodes.push(mediaSrc);

      const rateObj = {
        value: rate,
        setValueAtTime(v) { rateObj.value = v; try { media.preservesPitch = true; media.playbackRate = v; } catch {} },
        linearRampToValueAtTime(v) { rateObj.value = v; try { media.preservesPitch = true; media.playbackRate = v; } catch {} },
        cancelScheduledValues() {},
      };
      src = {
        playbackRate: rateObj,
        stop() {
          try { if (lane._startTimer) { clearTimeout(lane._startTimer); lane._startTimer = 0; } } catch {}
          try { media.pause(); } catch {}
        },
        onended: null,
      };
      media.onended = () => { try { src.onended?.(); } catch {} };
      if (!opts.loop) {
        src.onended = () => {
          if (my !== mixToken) return;
          if (lanes[active]?.src !== src) return;
          try { onEnded?.(); } catch {}
        };
      }
      const prepSeek = () => {
        try {
          media.preservesPitch = true;
          media.playbackRate = rate;
          media.currentTime = off;
        } catch {}
      };
      if (media.readyState >= 1) prepSeek();
      else media.addEventListener('loadedmetadata', prepSeek, { once: true });

      const firePlay = () => {
        lane._startTimer = 0;
        try {
          const late = ctx.currentTime - when;
          const r = lane.rate || rate;
          media.preservesPitch = true;
          media.playbackRate = r;
          const adj = off + Math.max(0, late) * r;
          if (Math.abs((media.currentTime || 0) - adj) > 0.008) media.currentTime = adj;
          void media.play();
        } catch {}
      };
      const arm = () => {
        const left = when - ctx.currentTime;
        if (left > 0.06) {
          lane._startTimer = setTimeout(arm, Math.max(12, (left - 0.04) * 1000));
          return;
        }
        if (left > 0.008) {
          lane._startTimer = setTimeout(arm, 4);
          return;
        }
        firePlay();
      };
      startTimer = setTimeout(arm, Math.max(0, (when - ctx.currentTime) * 1000 - 80));
      lane._startTimer = startTimer;
      lane.src = src;
      lane.media = media;
      lane.objectUrl = objectUrl;
    } else {
      src = ctx.createBufferSource();
      src.buffer = decoded;
      src.playbackRate.value = rate;
      src.loop = !!opts.loop;
      src.connect(lowLP);
      src.connect(midHP);
      src.connect(highHP);
      nodes.push(src);
      if (!opts.loop) {
        src.onended = () => {
          if (my !== mixToken) return;
          if (lanes[active]?.src !== src) return;
          try { onEnded?.(); } catch {}
        };
      }
      src.start(when, off);
      lane.src = src;
    }

    return lane;
  }

  function startDecoded(decoded, autoG, opts = {}) {
    const ctx = host.ctx();
    if (!ctx || !decoded) return false;
    ensureMaster(ctx);
    mixToken += 1;
    mixClock = null;
    const my = mixToken;
    killLane(0);
    killLane(1);
    active = 0;
    onEnded = typeof opts.onEnded === 'function' ? opts.onEnded : null;
    loopMode = !!opts.loop;
    resetRhythm(false);
    if (Number.isFinite(opts.bpmHint) && opts.bpmHint > 0) {
      bpmEst = opts.bpmHint;
      bpmSmooth = opts.bpmHint;
    }
    let off = Number(opts.offset);
    if (!Number.isFinite(off) || off < 0) off = 0;
    if (!(off > 0) && (Number(opts.cueIn) || 0) > 0) off = Number(opts.cueIn);
    lanes[0] = buildLane(ctx, decoded, autoG, {
      ...opts,
      offset: off,
      blob: opts.blob || null,
      low: 1, mid: 1, high: 1,
      busGain: Number.isFinite(autoG) ? autoG : 1,
      token: my,
    });
    if (lanes[0]) {
      const b = Math.max(72, Math.min(180, Number(opts.bpmHint) || bpmSmooth || 138));
      lanes[0].bpm = b;
      lanes[0].wallBpm = b * (Number(lanes[0].rate) || 1);
    }
    return true;
  }

  function transitionTo(decoded, autoG, opts = {}) {
    const ctx = host.ctx();
    if (!ctx || !decoded) return false;
    ensureMaster(ctx);
    let out = lanes[active];
    if (!out?.src) return startDecoded(decoded, autoG, opts);

    // 路径：①SYNC锁速 → ②小节网格对齐 → ③EQ混音(BufferSource) → ④出轨离开后拉回原速
    // 混音禁用 MediaElement：preservesPitch 与 Buffer 对打会严重跑马
    const tNow = ctx.currentTime;
    let pos0 = lanePos(out);
    let outRateNow = 1;
    try {
      outRateNow = out.media
        ? (Number(out.media.playbackRate) || Number(out.rate) || 1)
        : (Number(out.src.playbackRate.value) || Number(out.rate) || 1);
    } catch { outRateNow = Number(out.rate) || 1; }
    outRateNow = Math.max(0.5, Math.min(2, outRateNow));
    const outRate0 = Math.abs(outRateNow - 1) <= 0.008
      ? 1
      : Math.max(0.82, Math.min(1.22, outRateNow));

    // 出轨若是 MediaElement，先切成 BufferSource，避免混音双引擎跑马
    if (out.media && out.buf) {
      const keepG = Number.isFinite(out.gain) ? out.gain : 1;
      const keepBpm = out.bpm;
      const keepOrigin = out.beatOrigin;
      const keepTok = out.token || mixToken;
      const keepBuf = out.buf;
      const slot = active;
      killLane(slot);
      lanes[slot] = buildLane(ctx, keepBuf, keepG, {
        offset: pos0,
        rate: outRate0,
        exactRate: true,
        bpmHint: keepBpm,
        loop: false,
        when: tNow,
        blob: null,
        low: 1, mid: 1, high: 1,
        busGain: keepG,
        token: keepTok,
      });
      out = lanes[slot];
      if (!out?.src) return startDecoded(decoded, autoG, opts);
      out.bpm = keepBpm;
      out.beatOrigin = keepOrigin;
      out.wallBpm = (keepBpm || 138) * outRate0;
    } else {
      out.rateRamp = null;
      out.ratePre = null;
      out.offset = pos0;
      out.t0 = tNow;
      try { applyRate(out, outRate0, { when: tNow }); } catch {}
      out.offset = pos0;
      out.t0 = tNow;
      out.rate = outRate0;
    }
    pos0 = lanePos(out);

    // ── ① SYNC：用曲目分析 BPM（不现场 refine，防两边漂）──
    let outBpm = Math.max(72, Math.min(180,
      Number(out.bpm) || Number(opts.outBpm) || bpmSmooth || 138));
    let inBpm = Math.max(72, Math.min(180, Number(opts.bpmHint) || 138));
    for (let i = 0; i < 4; i++) {
      if (inBpm > outBpm * 1.42) inBpm /= 2;
      else if (inBpm < outBpm / 1.42) inBpm *= 2;
      else break;
    }
    inBpm = Math.max(72, Math.min(180, inBpm));
    outBpm = Math.max(72, Math.min(180, outBpm));
    // 近速：强制同 BPM + 同 rate，消灭细微差速跑马
    if (Math.abs(inBpm - outBpm) / outBpm <= 0.03) {
      inBpm = outBpm;
    }

    const wallBpm = outBpm * outRate0;
    const inRateLock = Math.max(0.82, Math.min(1.22, wallBpm / inBpm));
    const wallPeriod = 60 / Math.max(1e-6, wallBpm);
    const filePer = 60 / outBpm;
    const inPer = 60 / inBpm;

    // ── ② 局部精修网格相位后对齐小节线 ──
    const hintOrigin = Math.max(0, Number(out.beatOrigin) || Number(opts.outCueIn) || Number(opts.cueIn) || 0);
    const gridOrigin = refineBeatOrigin(out.buf || null, outBpm, hintOrigin, pos0);
    const syncBeats = 8;
    const minCueWait = syncBeats * wallPeriod + 0.12;
    let outCue = nextBarFileTime(gridOrigin, pos0 + 0.01, outBpm);
    outCue = snapBarToKick(out.buf || null, outCue, outBpm);
    // 吸 kick 后仍贴在「小节」上：以精修原点回投
    {
      const beats = (outCue - gridOrigin) / filePer;
      const barN = Math.round(beats / 4) * 4;
      const barT = gridOrigin + barN * filePer;
      if (Math.abs(barT - outCue) < filePer * 0.35) outCue = snapBarToKick(out.buf || null, barT, outBpm);
    }
    let wait = Math.max(0.08, (outCue - pos0) / Math.max(1e-6, outRate0));
    while (wait < minCueWait) {
      outCue += 4 * filePer;
      outCue = snapBarToKick(out.buf || null, outCue, outBpm);
      wait = (outCue - pos0) / Math.max(1e-6, outRate0);
    }
    if (outCue <= pos0 + 0.01) {
      outCue = pos0 + Math.max(4 * filePer, minCueWait * outRate0);
      wait = (outCue - pos0) / Math.max(1e-6, outRate0);
    }
    const tCue = tNow + wait;

    const durIn = decoded.duration || 0;
    let cueIn = Math.max(0, Number(opts.cueIn) || 0);
    const inOrigin = refineBeatOrigin(decoded, inBpm, cueIn, cueIn);
    cueIn = snapToGrid(cueIn, inOrigin, inPer);
    cueIn = snapBarToKick(decoded, cueIn, inBpm);
    let inOff = Number(opts.offset);
    if (!Number.isFinite(inOff) || inOff <= 0) inOff = cueIn;
    inOff = snapToGrid(inOff, inOrigin, inPer);
    // 入轨也落在小节线（与出轨 bar 对齐）
    {
      const beats = (inOff - inOrigin) / inPer;
      const barN = Math.round(beats / 4) * 4;
      inOff = inOrigin + Math.max(0, barN) * inPer;
    }
    inOff = snapBarToKick(decoded, inOff, inBpm);
    inOff = Math.min(Math.max(0, inOff), Math.max(0, durIn - 0.05));

    // Buffer 静音预跑：音频钟精确，到 tCue 文件位 = inOff
    let tSync = tCue - syncBeats * wallPeriod;
    let syncOff = inOff - syncBeats * inPer;
    if (tSync < tNow + 0.04 || syncOff < 0) {
      const maxBeats = Math.min(
        syncBeats,
        Math.floor(Math.max(0, (tCue - tNow - 0.04) / wallPeriod)),
        Math.floor(inOff / Math.max(1e-6, inPer)),
      );
      const b = Math.max(0, maxBeats);
      tSync = tCue - b * wallPeriod;
      syncOff = inOff - b * inPer;
    }
    if (syncOff < 0 || tSync < tNow + 0.02) {
      tSync = tCue;
      syncOff = inOff;
    }
    syncOff = Math.min(Math.max(0, syncOff), Math.max(0, durIn - 0.05));

    const mixDur = 48 * wallPeriod;
    mixToken += 1;
    const my = mixToken;
    onEnded = typeof opts.onEnded === 'function' ? opts.onEnded : null;
    loopMode = !!opts.loop;

    const nextSlot = active ^ 1;
    killLane(nextSlot);
    const inG = Number.isFinite(autoG) ? autoG : 1;
    const outG = Number.isFinite(out.gain) ? out.gain : 1;

    out.rate = outRate0;
    out.bpm = outBpm;
    out.beatOrigin = gridOrigin;
    out.wallBpm = wallBpm;

    // blob:null → 强制 BufferSource，混音期采样级锁拍
    lanes[nextSlot] = buildLane(ctx, decoded, inG, {
      offset: syncOff,
      rate: inRateLock,
      exactRate: true,
      bpmHint: inBpm,
      loop: opts.loop,
      when: tSync,
      blob: null,
      low: 0, mid: 0, high: 0,
      busGain: 0.0001,
      token: my,
    });
    const inn = lanes[nextSlot];
    if (!inn) return false;
    inn.bpm = inBpm;
    inn.beatOrigin = inOrigin;
    inn.wallBpm = wallBpm;
    inn.rate = inRateLock;
    inn.ratePre = inRateLock;
    inn.rateRamp = null;
    try { applyRate(inn, inRateLock, { when: tSync }); } catch {}

    try {
      out.bus.gain.cancelScheduledValues(tNow);
      out.bus.gain.setValueAtTime(outG, tNow);
      out.lowG.gain.setValueAtTime(1, tNow);
      out.midG.gain.setValueAtTime(1, tNow);
      out.highG.gain.setValueAtTime(1, tNow);
    } catch {}

    // ── ③ Mix：仅 EQ/bus
    // 高频=鼓组音头：必须错开，出轨先让出，入轨晚进，避免双音头叠动态
    const t1 = tCue;
    const tEnd = t1 + mixDur;
    const period = wallPeriod;
    // High：交叉让位，总和尽量贴平（少双音头，也少空窗）
    const tHiOutA = t1 + mixDur * 0.10;
    const tHiOutB = t1 + mixDur * 0.32;
    const tHiOutC = t1 + mixDur * 0.55;
    const tHiIn0 = t1 + mixDur * 0.18;
    const tHiIn1 = t1 + mixDur * 0.50;
    const tHiIn2 = t1 + mixDur * 0.78;
    // Mid：略宽于高频
    const tMidOut0 = t1 + mixDur * 0.28;
    const tMidOut1 = t1 + mixDur * 0.68;
    const tMidIn0 = t1 + mixDur * 0.26;
    const tMidIn1 = t1 + mixDur * 0.72;
    // Bass：短窗对切，尽量少双低
    const bassDur = Math.max(period * 2.5, Math.min(period * 4, mixDur * 0.18));
    const tBass1 = Math.min(tEnd - period * 1.5, t1 + mixDur * 0.72);
    const tBass = Math.max(t1 + mixDur * 0.55, tBass1 - bassDur);
    const outSlotKeep = active;
    mixClock = {
      t0: t1,
      t1: tEnd,
      prep0: tNow,
      sync0: tSync,
      outSlot: outSlotKeep,
      inSlot: nextSlot,
      outCue,
      inCue: inOff,
      outBpm,
      inBpm,
      outRate0,
      inRate0: inRateLock,
      T: wallBpm,
      lastSync: 0,
    };

    const holdRamp = (g, holdV, tA, tHold, endV, tB) => {
      if (!g || !(tB > tA)) return;
      try {
        g.cancelScheduledValues(tA);
        g.setValueAtTime(holdV, tA);
        if (tHold > tA + 0.001) g.setValueAtTime(holdV, tHold);
        g.linearRampToValueAtTime(endV, tB);
      } catch {
        try { g.cancelScheduledValues(tA); g.setValueAtTime(endV, tA); } catch {}
      }
    };
    const multiRamp = (g, pts) => {
      if (!g || !pts?.length) return;
      try {
        g.cancelScheduledValues(pts[0][0]);
        g.setValueAtTime(pts[0][1], pts[0][0]);
        for (let i = 1; i < pts.length; i++) {
          const [t, v] = pts[i];
          if (t > pts[i - 1][0]) g.linearRampToValueAtTime(Math.max(0.0001, v), t);
        }
      } catch {
        try { g.setValueAtTime(pts[pts.length - 1][1], pts[0][0]); } catch {}
      }
    };
    try {
      inn.lowG.gain.cancelScheduledValues(tSync);
      inn.midG.gain.cancelScheduledValues(tSync);
      inn.highG.gain.cancelScheduledValues(tSync);
      inn.bus.gain.cancelScheduledValues(tSync);
      inn.lowG.gain.setValueAtTime(0.0001, tSync);
      inn.midG.gain.setValueAtTime(0.0001, tSync);
      inn.highG.gain.setValueAtTime(0.0001, tSync);
      inn.bus.gain.setValueAtTime(0.0001, tSync);
    } catch {}

    // 出↓入↑ 互补：中段约 0.55+0.45，避免双满又不断层
    multiRamp(out.highG.gain, [
      [t1, 1],
      [tHiOutA, 0.92],
      [tHiOutB, 0.48],
      [tHiOutC, 0.0001],
    ]);
    multiRamp(inn.highG.gain, [
      [t1, 0.0001],
      [tHiIn0, 0.12],
      [tHiIn1, 0.55],
      [tHiIn2, 1],
    ]);
    holdRamp(out.midG.gain, 1, t1, tMidOut0, 0.0001, tMidOut1);
    holdRamp(inn.midG.gain, 0.0001, t1, tMidIn0, 1, tMidIn1);
    holdRamp(out.lowG.gain, 1, t1, tBass, 0.0001, tBass1);
    {
      const tBassIn = Math.max(t1 + 0.02, tBass + period * 0.15);
      holdRamp(inn.lowG.gain, 0.0001, t1, tBassIn, 1, tBass1);
    }

    try {
      const tBusHold = t1 + mixDur * 0.62;
      const tBusMid = t1 + mixDur * 0.88;
      out.bus.gain.cancelScheduledValues(t1);
      out.bus.gain.setValueAtTime(outG, t1);
      if (tBusHold > t1) out.bus.gain.setValueAtTime(outG, tBusHold);
      out.bus.gain.linearRampToValueAtTime(outG * 0.55, tBass1);
      out.bus.gain.linearRampToValueAtTime(outG * 0.22, tBusMid);
      out.bus.gain.linearRampToValueAtTime(0.0001, tEnd);
    } catch {
      try { out.bus.gain.setValueAtTime(0.0001, t1); } catch {}
    }
    try {
      inn.bus.gain.cancelScheduledValues(t1);
      inn.bus.gain.setValueAtTime(0.0001, t1);
      inn.bus.gain.linearRampToValueAtTime(inG * 0.55, t1 + mixDur * 0.12);
      inn.bus.gain.linearRampToValueAtTime(inG * 0.75, t1 + mixDur * 0.35);
      inn.bus.gain.linearRampToValueAtTime(inG * 0.92, tBass);
      inn.bus.gain.linearRampToValueAtTime(inG, tBass1);
    } catch {
      openLaneFull(inn, inG, t1);
    }

    const outSlot = outSlotKeep;
    active = nextSlot;
    bpmEst = wallBpm;
    bpmSmooth = wallBpm;

    // ── ④ 上一首离开后：SYNC 速 → 原始 BPM(rate=1) ──
    const doneAt = Math.max(0, (tEnd - ctx.currentTime) * 1000 + 220);
    setTimeout(() => {
      if (my !== mixToken) return;
      killLane(outSlot);
      mixClock = null;
      try {
        const L = lanes[active];
        if (L?.src) {
          const now = host.ctx()?.currentTime || 0;
          const p = lanePos(L);
          if (!L.media) {
            L.offset = p;
            L.t0 = now;
          }
          openLaneFull(L, inG, now);
          L.bpm = inBpm;
          if (Math.abs(inRateLock - 1) > 0.008) {
            const landDur = Math.max(2.5, 32 * (60 / wallBpm));
            applyRate(L, inRateLock, { when: now, rampTo: 1, rampDur: landDur });
            L.wallBpm = wallBpm;
            setTimeout(() => {
              if (my !== mixToken) return;
              const cur = lanes[active];
              if (!cur?.src) return;
              cur.rate = 1;
              cur.wallBpm = inBpm;
              bpmEst = inBpm;
              bpmSmooth = inBpm;
              try { opts.onLandDone?.(); } catch {}
            }, landDur * 1000 + 40);
          } else {
            applyRate(L, 1, { when: now });
            L.rate = 1;
            L.wallBpm = inBpm;
            bpmEst = inBpm;
            bpmSmooth = inBpm;
            try { opts.onLandDone?.(); } catch {}
          }
        }
      } catch {}
      try { opts.onMixDone?.(); } catch {}
    }, doneAt);

    return true;
  }

  function syncMix() {}

  return {
    stop,
    position,
    duration,
    isPlaying,
    decode,
    decodeHead,
    decodeForBpm,
    startDecoded,
    transitionTo,
    syncMix,
    mixSnapshot,
    setLoop(doLoop, ended) {
      loopMode = !!doLoop;
      onEnded = typeof ended === 'function' ? ended : null;
      const L = lanes[active];
      if (!L?.src) return false;
      try {
        if (L.media) L.media.loop = loopMode;
        else L.src.loop = loopMode;
        L.src.onended = loopMode || !onEnded
          ? null
          : () => { try { onEnded(); } catch {} };
        return true;
      } catch { return false; }
    },
    hold() {
      const at = position();
      stop();
      return at;
    },
    sampleRhythm(playing, visualKeep) {
      const now = performance.now();
      const live = !!(playing || visualKeep);
      if (playing && analyser && freq) {
        try {
          analyser.getByteFrequencyData(freq);
          let bass = 0;
          const n = Math.min(10, freq.length);
          for (let i = 1; i < n; i++) bass += freq[i];
          bass /= Math.max(1, n - 1) * 255;
          const diff = bass - prevBass;
          prevBass = prevBass * 0.78 + bass * 0.22;
          if (diff > 0.1 && bass > 0.25 && now - lastKickAt > 240) {
            if (lastKickAt > 0) {
              const gap = now - lastKickAt;
              if (gap >= 280 && gap <= 1100) {
                gaps.push(gap);
                if (gaps.length > 10) gaps.shift();
                const sorted = gaps.slice().sort((a, b) => a - b);
                const med = sorted[Math.floor(sorted.length / 2)];
                const b = 60000 / med;
                if (b >= 72 && b <= 180) bpmEst = bpmEst * 0.88 + b * 0.12;
              }
            }
            lastKickAt = now;
          }
        } catch {}
      }
      const target = Math.max(72, Math.min(180, bpmEst));
      bpmSmooth += (target - bpmSmooth) * 0.012;
      const period = 60 / bpmSmooth;
      if (live) {
        if (lastWall > 0) {
          const dt = (now - lastWall) / 1000;
          if (dt > 0 && dt < 0.25) phase += dt / period;
        }
        lastWall = now;
        return { active: true, t: phase * period, bpm: bpmSmooth, period };
      }
      lastWall = 0;
      return { active: false, t: phase * period, bpm: bpmSmooth, period };
    },
  };
}

export async function createMusic() {
  const clips = createClipStore();
  const host = createHostMute();
  const deck = createDeck(host);
  let cfg = loadCfg();
  const subs = new Set();
  const tickSubs = new Set();
  const emit = () => { for (const fn of [...subs]) try { fn(snapshot()); } catch {} };
  const emitTick = () => { for (const fn of [...tickSubs]) try { fn(playerState()); } catch {} };

  let liveId = null;
  let paused = false;
  let pausePos = 0;
  let unlockBound = false;
  let tickTimer = 0;
  let playGen = 0;
  let outroArmed = false;
  let introOpen = false;
  let mixUi = null;
  const BUF_CACHE_MAX = 4;
  const bufCache = new Map();

  function cacheGet(id) {
    const hit = bufCache.get(id);
    if (!hit) return null;
    bufCache.delete(id);
    bufCache.set(id, hit);
    return hit;
  }

  function cachePut(id, entry) {
    if (bufCache.has(id)) bufCache.delete(id);
    bufCache.set(id, entry);
    while (bufCache.size > BUF_CACHE_MAX) {
      const k = bufCache.keys().next().value;
      bufCache.delete(k);
    }
  }

  const bpmById = new Map();
  const bpmExactIds = new Set();

  function cacheDrop(id) {
    if (id) bufCache.delete(id);
    if (id) bpmById.delete(id);
    if (id) bpmExactIds.delete(id);
  }

  function trackBpm(id) {
    if (!id) return 0;
    if (bpmById.has(id)) return Number(bpmById.get(id)) || 0;
    const hit = bufCache.get(id);
    return Number(hit?.bpm) || 0;
  }

  function trackBpmApprox(id) {
    if (!id || !bpmById.has(id)) return false;
    return !bpmExactIds.has(id);
  }

  function rememberBpm(id, bpm, exact) {
    const b = Math.max(0, Number(bpm) || 0);
    if (!id || !(b > 0)) return;
    if (!exact && bpmExactIds.has(id)) return;
    if (exact) bpmById.set(id, b);
    else bpmById.set(id, snapBpmFuzzy(b) || b);
    if (exact) bpmExactIds.add(id);
    else bpmExactIds.delete(id);
  }

  async function ensureDecoded(id, gen) {
    const hit = cacheGet(id);
    if (hit?.buf) {
      try {
        const meta = analyzeTrack(hit.buf);
        hit.bpm = meta.bpm;
        hit.cueIn = meta.cueIn;
        hit.cueOut = meta.cueOut;
        if (!(hit.gain > 0)) hit.gain = loudnessGain(hit.buf);
        rememberBpm(id, meta.bpm, true);
      } catch {}
      if (!hit.blob) {
        try { hit.blob = clips.get(id)?.blob || null; } catch {}
      }
      return hit;
    }
    const row = clips.get(id);
    if (!row?.blob) return null;
    await host.ensureCtx();
    if (gen != null && gen !== playGen) return null;
    const decoded = await deck.decode(row.blob);
    if (!decoded) return null;
    if (gen != null && gen !== playGen) return null;
    const meta = analyzeTrack(decoded);
    const entry = {
      buf: decoded,
      blob: row.blob,
      gain: loudnessGain(decoded),
      bpm: meta.bpm,
      cueIn: meta.cueIn,
      cueOut: meta.cueOut,
    };
    cachePut(id, entry);
    rememberBpm(id, meta.bpm, true);
    return entry;
  }

  async function ensureBpm(id) {
    if (bpmExactIds.has(id) && trackBpm(id) > 0) return trackBpm(id);
    if (trackBpm(id) > 0 && trackBpmApprox(id)) return trackBpm(id);
    const hit = cacheGet(id);
    if (hit?.buf) {
      try {
        if (!bpmExactIds.has(id)) {
          const meta = analyzeTrack(hit.buf);
          hit.bpm = meta.bpm;
          rememberBpm(id, meta.bpm, true);
          return meta.bpm;
        }
        return trackBpm(id);
      } catch { return 0; }
    }
    const row = clips.get(id);
    if (!row?.blob) return 0;
    await host.ensureCtx();
    const decoded = await deck.decodeHead(row.blob, 384 * 1024);
    if (!decoded) return 0;
    let bpm = 0;
    try { bpm = analyzeBpmFuzzy(decoded); } catch { bpm = 0; }
    if (bpm > 0) rememberBpm(id, bpm, false);
    return bpm;
  }

  function softPrefetch(fromId) {
    try {
      const list = clips.list();
      if (list.length < 2) return;
      let i = list.findIndex((x) => x.id === fromId);
      if (i < 0) return;
      const nid = list[(i + 1) % list.length].id;
      if (!nid || nid === fromId || bufCache.has(nid)) return;
      const gen = playGen;
      void ensureDecoded(nid, gen);
    } catch {}
  }

  function beginMixUi(fromMeta, toMeta, bpmHint) {
    const bpm = Math.max(72, Math.min(180, bpmHint || 138));
    const ms = Math.max(8000, 48 * (60000 / bpm) + 1800);
    const now = performance.now();
    mixUi = {
      out: {
        id: fromMeta.id,
        name: fromMeta.name || 'audio',
        currentTime: Math.max(0, Number(fromMeta.currentTime) || 0),
        duration: Math.max(0, Number(fromMeta.duration) || 0),
        tWall: now,
      },
      in: {
        id: toMeta.id,
        name: toMeta.name || 'audio',
        currentTime: Math.max(0, Number(toMeta.currentTime) || 0),
        duration: Math.max(0, Number(toMeta.duration) || 0),
      },
      wall0: now,
      wall1: now + ms,
    };
  }

  function endMixUi() {
    mixUi = null;
  }

  function mixBusy() {
    return !!(mixUi || deck.mixSnapshot?.());
  }

  let lastKnownDur = 0;

  function playerState() {
    const active = !!(cfg.on && liveId && clips.get(liveId));
    const row = active ? clips.get(liveId) : null;
    const entry = active ? cacheGet(liveId) : null;
    let dur = active
      ? (deck.duration() || entry?.buf?.duration || lastKnownDur || 0)
      : 0;
    if (active && dur > 0) lastKnownDur = dur;
    if (!active) lastKnownDur = 0;
    const cur = !active ? 0 : (paused ? pausePos : deck.position());
    const mx = deck.mixSnapshot?.() || null;
    let mix = null;
    if (mixUi) {
      const now = performance.now();
      let progress = mx && Number.isFinite(mx.progress)
        ? mx.progress
        : (now - mixUi.wall0) / Math.max(1, mixUi.wall1 - mixUi.wall0);
      progress = Math.max(0, Math.min(1, progress));
      if (!mx && progress >= 1) {
        endMixUi();
        /* mix ui ended */
      } else {
        const outElapsed = (now - mixUi.out.tWall) / 1000;
        const outCur = mx
          ? mx.out.currentTime
          : Math.min(
            mixUi.out.duration || (mixUi.out.currentTime + outElapsed),
            mixUi.out.currentTime + outElapsed,
          );
        const inCur = mx ? mx.in.currentTime : (active && !paused ? cur : mixUi.in.currentTime);
        const inDur = mx ? mx.in.duration : (mixUi.in.duration || dur || 0);
        const outDur = mx ? mx.out.duration : (mixUi.out.duration || 0);
        mix = {
          active: true,
          progress,
          phase: mx?.phase || (progress < 0.12 ? 'sync' : 'mix'),
          out: {
            id: mixUi.out.id,
            name: mixUi.out.name,
            currentTime: outCur,
            duration: outDur,
          },
          in: {
            id: mixUi.in.id,
            name: mixUi.in.name || row?.name || 'audio',
            currentTime: inCur,
            duration: inDur,
          },
        };
      }
    }
    const cueOut = Number(entry?.cueOut) || 0;
    const cueIn = Number(entry?.cueIn) || 0;
    const smartCue = cfg.smartCue !== false;
    const inSafeCue = (() => {
      if (!active) return true;
      if (!(dur > 0)) return true;
      const pos = paused ? pausePos : cur;
      if (cueIn > 0.04 && pos < cueIn - 0.02) return false;
      if (cueOut > 0 && cueOut < dur - 0.04 && pos > cueOut - 0.02) return false;
      return true;
    })();
    return {
      currentId: active ? liveId : null,
      playing: !!(active && !paused),
      currentTime: cur,
      duration: dur,
      name: active ? (row.name || 'audio') : (cfg.on ? '未播放' : '卫戍音乐播放中'),
      custom: active,
      mode: cfg.mode,
      modeLocked: !active,
      smartCue,
      canEnableSmartCue: !!(smartCue || inSafeCue),
      cueIn: smartCue ? cueIn : 0,
      cueOut: smartCue ? cueOut : 0,
      seekMin: (!smartCue || introOpen || !!mix) ? 0 : cueIn,
      seekMax: (() => {
        const tail = dur > 0 ? Math.max(0, dur - 3) : 0;
        // 智能 Cue 开着：禁止拖过 cueOut，才能自然进接歌
        if (smartCue && !mix && cueOut > 0) {
          return Math.min(tail, Math.max(0, cueOut - 0.08));
        }
        return tail;
      })(),
      introOpen: !!(introOpen || !smartCue),
      mix,
    };
  }

  function snapshot() {
    return {
      on: cfg.on,
      smartCue: cfg.smartCue !== false,
      library: clips.list().map((t) => ({
        ...t,
        bpm: trackBpm(t.id),
        bpmApprox: trackBpmApprox(t.id),
      })),
      player: playerState(),
    };
  }

  /** shuffle 下一首播放：只插播一次；列表模式靠 moveAfter 顺着往下 */
  let playNextId = null;

  function pickNextId(dir = 1) {
    const list = clips.list();
    if (!list.length) return null;
    if (dir === 1 && playNextId && clips.has(playNextId) && playNextId !== liveId) {
      const id = playNextId;
      playNextId = null;
      return id;
    }
    if (cfg.mode === 'shuffle') {
      if (list.length === 1) return list[0].id;
      const others = list.filter((x) => x.id !== liveId);
      return others[Math.floor(Math.random() * others.length)].id;
    }
    let i = list.findIndex((x) => x.id === liveId);
    if (i < 0) i = 0;
    else i = (i + dir + list.length) % list.length;
    return list[i].id;
  }

  function advanceFromEnd() {
    if (!cfg.on || paused || !liveId) return;
    outroArmed = false;
    if (cfg.mode === 'one') {
      if (cfg.smartCue !== false) {
        const row = clips.get(liveId);
        if (row) {
          beginMixUi(
            { id: liveId, name: row.name || 'audio', currentTime: deck.position(), duration: deck.duration() },
            { id: liveId, name: row.name || 'audio', currentTime: 0, duration: deck.duration() },
            cacheGet(liveId)?.bpm,
          );
        }
        void kickPlay(liveId, 0, { mix: true });
      } else {
        endMixUi();
        deck.stop();
        void kickPlay(liveId, 0, { mix: false });
      }
      return;
    }
    const nid = pickNextId(1);
    if (nid) void playLib(nid, { mix: cfg.smartCue !== false });
  }

  function seekFloor(id) {
    if (cfg.smartCue === false || introOpen) return 0;
    if (mixUi) return 0;
    const cueIn = Number(cacheGet(id || liveId)?.cueIn) || 0;
    return Math.max(0, cueIn);
  }

  function seekCeiling(id) {
    const entry = cacheGet(id || liveId);
    const dur = entry?.buf?.duration || deck.duration() || 0;
    const tail = dur > 0 ? Math.max(0, dur - 3) : 0;
    if (mixUi) return tail;
    const cueOut = Number(entry?.cueOut) || 0;
    if (cfg.smartCue !== false && cueOut > 0) {
      return Math.min(tail, Math.max(0, cueOut - 0.08));
    }
    return tail;
  }

  function clampSeek(id, t) {
    let at = Math.max(0, Number(t) || 0);
    const floor = seekFloor(id);
    const ceil = seekCeiling(id);
    if (at < floor) at = floor;
    if (Number.isFinite(ceil) && at > ceil) at = ceil;
    return at;
  }

  function maybeOutroMix() {
    if (cfg.smartCue === false) return;
    if (!outroArmed || !cfg.on || paused || !liveId) return;
    if (deck.mixSnapshot()) return;
    const entry = cacheGet(liveId);
    if (!entry) return;
    const pos = deck.position();
    const cueOut = Number(entry.cueOut) || 0;
    const cueIn = Number(entry.cueIn) || 0;
    if (!(cueOut > 0) || pos < cueOut) return;
    if (pos < cueIn + 8) return;
    outroArmed = false;
    advanceFromEnd();
  }

  function startTick() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!cfg.on || !liveId || paused) return;
      try { deck.syncMix?.(); } catch {}
      maybeOutroMix();
      emitTick();
    }, 100);
  }

  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
  }

  function bindUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    const once = () => { void host.ensureCtx(); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(ev, once, { once: true, passive: true });
    }
  }

  async function kickPlay(id, offset = 0, opts = {}) {
    if (!cfg.on) return false;
    if (!id || !clips.has(id)) return false;
    const gen = playGen;
    const entry = await ensureDecoded(id, gen);
    if (!entry || gen !== playGen || !cfg.on || liveId !== id) return false;
    const smart = cfg.smartCue !== false;
    const exact = !!(opts.exact || opts.seek);
    let startAt = Number(offset) || 0;
    if (!Number.isFinite(startAt) || startAt < 0) startAt = 0;
    if (smart && !exact && startAt > 0) startAt = clampSeek(id, startAt);
    if (smart && exact) startAt = clampSeek(id, startAt);
    // 手动 seek/续播必须尊重 offset=0；只有新开播才自动吸到 cueIn
    const useCue = smart && !exact && !(startAt > 0);
    const canMix = !!(opts.mix && !exact && deck.isPlaying() && !paused && !(startAt > 0));
    const outEntry = (opts.outId && cacheGet(opts.outId))
      || null;
    const playOpts = {
      offset: useCue ? 0 : startAt,
      cueIn: useCue ? (entry.cueIn || 0) : 0,
      outBpm: outEntry ? (Number(outEntry.bpm) || 0) : (Number(opts.outBpm) || 0),
      loop: false,
      bpmHint: entry.bpm,
      blob: entry.blob || clips.get(id)?.blob || null,
      onEnded: () => {
        if (gen !== playGen || !cfg.on || paused) return;
        outroArmed = false;
        advanceFromEnd();
      },
      onMixDone: () => {
        if (gen !== playGen || !cfg.on) return;
        endMixUi();
        outroArmed = true;
        emit();
        emitTick();
      },
      onLandDone: () => {
        if (gen !== playGen || !cfg.on) return;
        introOpen = true;
        emitTick();
      },
    };
    if (mixUi && mixUi.in.id === id) {
      mixUi.in.duration = entry.buf.duration || mixUi.in.duration;
      const cue = useCue ? (entry.cueIn || 0) : startAt;
      mixUi.in.currentTime = cue;
      const bpm = entry.bpm || 138;
      const ms = Math.max(8000, 48 * (60000 / bpm) + 1800);
      mixUi.wall1 = Math.max(mixUi.wall1, performance.now() + ms);
    }
    const ok = canMix
      ? deck.transitionTo(entry.buf, entry.gain, playOpts)
      : deck.startDecoded(entry.buf, entry.gain, playOpts);
    if (!cfg.on) {
      deck.stop();
      return false;
    }
    if (ok) {
      const cueOut = Number(entry.cueOut) || 0;
      if (exact) {
        // 拖到 cueOut 之后：先听尾奏，禁止立刻 maybeOutroMix
        outroArmed = !(cueOut > 0 && startAt >= cueOut - 0.05);
        introOpen = true;
      } else {
        outroArmed = !canMix;
        if (!canMix) introOpen = true;
      }
      if (!canMix && mixUi) {
        const bpm = entry.bpm || 138;
        mixUi.wall1 = performance.now() + Math.max(2800, 16 * (60000 / bpm));
      }
      softPrefetch(id);
    } else {
      endMixUi();
    }
    emitTick();
    return ok;
  }

  async function playLib(id, opts = {}) {
    if (!cfg.on) return false;
    if (!id || !clips.has(id)) return false;
    if (mixBusy()) return false;
    playGen += 1;
    const gen = playGen;
    outroArmed = false;
    introOpen = false;
    const prevId = liveId;
    const prevRow = prevId ? clips.get(prevId) : null;
    const prevPos = prevRow && deck.isPlaying() && !paused ? deck.position() : 0;
    const prevDur = prevRow && deck.isPlaying() ? deck.duration() : 0;
    const wantMix = cfg.smartCue !== false
      && opts.mix !== false
      && deck.isPlaying() && !paused && liveId
      && (liveId !== id || opts.mix === true);
    const toRow = clips.get(id);
    const outCached = prevId ? cacheGet(prevId) : null;
    if (wantMix && prevRow && toRow && prevId !== id) {
      beginMixUi(
        { id: prevId, name: prevRow.name || 'audio', currentTime: prevPos, duration: prevDur },
        { id, name: toRow.name || 'audio', currentTime: 0, duration: 0 },
        outCached?.bpm || cacheGet(id)?.bpm,
      );
    } else {
      endMixUi();
    }
    liveId = id;
    paused = false;
    pausePos = 0;
    if (!wantMix) deck.stop();
    startTick();
    emit();
    emitTick();
    const ok = await kickPlay(id, 0, {
      mix: wantMix,
      outId: wantMix ? prevId : null,
      outBpm: outCached ? (Number(outCached.bpm) || 0) : 0,
    });
    if (gen !== playGen) return false;
    if (!ok) endMixUi();
    emit();
    emitTick();
    return ok;
  }

  function pauseBgm() {
    if (!cfg.on || !liveId || paused) return;
    pausePos = deck.hold();
    paused = true;
    emit();
    emitTick();
  }

  function resumeBgm() {
    if (!cfg.on) return false;
    if (!liveId) {
      const list = clips.list();
      if (list.length) return playLib(list[0].id);
      return false;
    }
    if (!paused) return true;
    const at = pausePos || 0;
    const id = liveId;
    playGen += 1;
    const gen = playGen;
    paused = false;
    startTick();
    emit();
    void (async () => {
      if (gen !== playGen || liveId !== id || paused || !cfg.on) return;
      await kickPlay(id, at, { exact: true });
    })();
    return true;
  }

  function stopCustom() {
    playGen += 1;
    liveId = null;
    paused = false;
    pausePos = 0;
    deck.stop();
    stopTick();
  }

  await clips.load();
  const ok = await host.boot();
  bindUnlock();

  if (cfg.on) {
    host.setMuted(true);
    const list = clips.list();
    if (list.length) {
      liveId = list[0].id;
      paused = true;
      pausePos = 0;
    }
  }

  return {
    snapshot,
    setOn(on) {
      const next = !!on;
      cfg = sanitizeCfg({ ...cfg, on: next });
      saveCfg(cfg);
      if (!next) {
        stopCustom();
        host.setMuted(false);
      } else {
        host.setMuted(true);
        const list = clips.list();
        if (list.length && !liveId) {
          void playLib(list[0].id);
        } else if (liveId) {
          void playLib(liveId);
        }
      }
      emit();
      emitTick();
    },
    async addTrack(file) {
      const row = await clips.add(file);
      cfg = sanitizeCfg({ ...cfg, on: true });
      saveCfg(cfg);
      host.setMuted(true);
      emit();
      emitTick();
      return row;
    },
    removeTrack(libId) {
      if (!libId || !clips.has(libId)) return;
      const list = clips.list();
      const idx = list.findIndex((x) => x.id === libId);
      const rest = list.filter((x) => x.id !== libId);
      clips.remove(libId);
      cacheDrop(libId);
      if (playNextId === libId) playNextId = null;
      if (liveId === libId) {
        const next = rest[Math.min(idx, Math.max(0, rest.length - 1))] || rest[0] || null;
        liveId = null;
        if (cfg.on && next) void playLib(next.id);
        else {
          stopCustom();
          if (!cfg.on) host.setMuted(false);
        }
      }
      emit();
      emitTick();
    },
    clearTracks() {
      const list = clips.list();
      if (!list.length) return 0;
      for (const t of list) {
        clips.remove(t.id);
        cacheDrop(t.id);
      }
      playNextId = null;
      liveId = null;
      bpmById.clear();
      bpmExactIds.clear();
      bufCache.clear();
      stopCustom();
      if (!cfg.on) host.setMuted(false);
      emit();
      emitTick();
      return list.length;
    },
    queueNext(id) {
      if (!id || !clips.has(id) || id === liveId) return false;
      if (cfg.mode === 'shuffle') {
        playNextId = id;
      } else {
        playNextId = null;
        clips.moveAfter(id, liveId || null);
      }
      emit();
      emitTick();
      return true;
    },
    play: (id) => {
      playNextId = null;
      return playLib(id, { mix: cfg.smartCue !== false });
    },
    toggle() {
      if (!cfg.on) return;
      if (!paused) pauseBgm();
      else resumeBgm();
    },
    setMode(mode) {
      if (!(cfg.on && liveId)) return;
      if (!PLAY_MODES.includes(mode)) return;
      if (cfg.mode === mode) { emit(); return; }
      playNextId = null;
      cfg = sanitizeCfg({ ...cfg, mode });
      saveCfg(cfg);
      const gen = playGen;
      deck.setLoop(cfg.mode === 'one', () => {
        if (gen !== playGen) return;
        advanceFromEnd();
      });
      emit();
    },
    cycleMode() {
      if (!(cfg.on && liveId)) return cfg.mode;
      const i = PLAY_MODES.indexOf(cfg.mode);
      const next = PLAY_MODES[(i + 1) % PLAY_MODES.length];
      this.setMode(next);
      return next;
    },
    async next() {
      if (!(cfg.on && liveId)) return false;
      if (cfg.smartCue !== false && mixBusy()) return false;
      if (clips.list().length <= 1) return false;
      const nid = pickNextId(1);
      if (!nid || nid === liveId) return false;
      return playLib(nid, { mix: cfg.smartCue !== false });
    },
    async seek(t) {
      if (!(cfg.on && liveId)) return;
      const at = clampSeek(liveId, t);
      if (paused) {
        pausePos = at;
        emitTick();
        return;
      }
      await kickPlay(liveId, at, { exact: true });
    },
    setSmartCue(on) {
      const want = !!on;
      if (want && cfg.smartCue === false) {
        const st = playerState();
        if (!st.canEnableSmartCue) {
          emit();
          emitTick();
          return false;
        }
      }
      cfg = sanitizeCfg({ ...cfg, smartCue: want });
      saveCfg(cfg);
      if (!want) endMixUi();
      emit();
      emitTick();
      return true;
    },
    async analyzeBpms(onProgress, opts = {}) {
      const list = clips.list();
      const total = list.length;
      const force = opts.force === true;
      if (force) {
        for (const t of list) {
          if (bpmExactIds.has(t.id)) continue;
          bpmById.delete(t.id);
        }
      }
      let done = 0;
      const report = (id) => {
        done += 1;
        if (typeof onProgress === 'function') {
          try {
            onProgress({
              done, total, id,
              bpm: trackBpm(id),
              approx: trackBpmApprox(id),
            });
          } catch {}
        }
      };
      const pending = [];
      for (const t of list) {
        if (!force && trackBpm(t.id) > 0) report(t.id);
        else if (bpmExactIds.has(t.id) && trackBpm(t.id) > 0) report(t.id);
        else pending.push(t);
      }
      if (pending.length) {
        let cursor = 0;
        const workers = Math.min(16, pending.length);
        await Promise.all(Array.from({ length: workers }, async () => {
          for (;;) {
            const idx = cursor++;
            if (idx >= pending.length) return;
            const t = pending[idx];
            try { await ensureBpm(t.id); } catch {}
            report(t.id);
          }
        }));
      }
      emit();
      emitTick();
      return list.map((t) => ({
        id: t.id,
        bpm: trackBpm(t.id),
        approx: trackBpmApprox(t.id),
      }));
    },
    getRhythm() {
      const has = !!(cfg.on && liveId);
      if (!has) return { active: false, t: 0, bpm: 138, period: 60 / 138 };
      if (paused) return deck.sampleRhythm(false, true);
      return deck.sampleRhythm(true);
    },
    subscribe(fn) { if (typeof fn === 'function') subs.add(fn); return () => subs.delete(fn); },
    subscribeTick(fn) { if (typeof fn === 'function') tickSubs.add(fn); return () => tickSubs.delete(fn); },
    dispose() {
      stopTick();
      stopCustom();
      host.dispose();
    },
  };
}
