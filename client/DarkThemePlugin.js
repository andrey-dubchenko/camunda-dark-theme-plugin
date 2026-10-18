import React, { Component } from 'camunda-modeler-plugin-helpers/vendor/react';
import Fill from 'camunda-modeler-plugin-helpers/components/Fill';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cmp-dark-theme';
const BODY_CLASS  = 'dark-theme';
const CANVAS_BG   = '#282a36';
const DARK_FILL   = '#383a4a'; // default shape background
const DARK_STROKE = '#6272a4'; // default shape border
const DARK_TEXT   = '#f8f8f2'; // label text
const ICON_COLOR  = '#9099b8'; // task type icons (gear, envelope, etc.)

// ── State persistence ─────────────────────────────────────────────────────────

function loadState() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === 'true'; // dark by default
  } catch (e) {
    return true;
  }
}

function saveState(v) {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (e) { /**/ }
}

// ── Colour utilities ──────────────────────────────────────────────────────────

let _ctx = null;
const _rgbCache = new Map();

function getCtx() {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  return _ctx;
}

// "none" / "transparent" are an explicit absence of paint, unlike a missing value.
function isNoPaint(str) {
  if (!str) return false;
  const v = str.trim().toLowerCase();
  return v === 'none' || v === 'transparent';
}

function parseRGB(str) {
  if (!str || str === 'none' || str === '') return null;
  if (_rgbCache.has(str)) return _rgbCache.get(str);
  let result = null;
  try {
    const ctx = getCtx();
    // Two different sentinels: if str is invalid, the assignment is a no-op
    // and each probe keeps its own sentinel, so a !== b. A colliding sentinel
    // value (e.g. str === '#010203') no longer causes a false "invalid".
    ctx.fillStyle = '#010203';
    ctx.fillStyle = str;
    const a = ctx.fillStyle;
    ctx.fillStyle = '#fdfefc';
    ctx.fillStyle = str;
    const b = ctx.fillStyle;
    if (a === b) {
      const m = a.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (m) result = { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
    }
  } catch (e) {
    result = null;
  }
  _rgbCache.set(str, result);
  return result;
}

function getLightness(str) {
  const rgb = parseRGB(str);
  if (!rgb) return -1;
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

// Re-render a colour with a new lightness / saturation, keeping its hue.
// adjust(l, s) -> [newL, newS]
function adjustColor(str, adjust) {
  const rgb = parseRGB(str);
  if (!rgb) return null;

  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  const [newL, newS] = adjust(l, s);

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  let nr, ng, nb;
  if (newS === 0) {
    nr = ng = nb = newL;
  } else {
    const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
    const p = 2 * newL - q;
    nr = hue2rgb(p, q, h + 1 / 3);
    ng = hue2rgb(p, q, h);
    nb = hue2rgb(p, q, h - 1 / 3);
  }

  return '#' + [nr, ng, nb].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// Fills: reduce lightness to ~65%, minimum 0.35 for contrast against dark canvas
function darkenColor(str) {
  return adjustColor(str, (l, s) => [Math.max(0.35, l * 0.65), Math.min(1, s * 1.1)]);
}

// Strokes: dark outlines vanish on a dark canvas, so lift them to at least 0.6
function lightenColor(str) {
  return adjustColor(str, (l, s) => [Math.max(0.6, l), s]);
}

// ── Style attribute parsing ───────────────────────────────────────────────────
//
// bpmn-js stores element colours as inline style attributes, e.g.:
//   "stroke-linecap: round; fill: rgb(225,190,231); stroke: rgb(91,23,109);"
// Parsing the raw string lets us read original colours before we patch them.

function parseStyleAttr(raw) {
  const fillMatch   = raw.match(/(?:^|;)\s*fill\s*:\s*([^;!]+)/i);
  const strokeMatch = raw.match(/(?:^|;)\s*stroke\s*:\s*([^;!]+)/i);
  return {
    fill:   fillMatch   ? fillMatch[1].trim()   : null,
    stroke: strokeMatch ? strokeMatch[1].trim() : null,
  };
}

// WeakMap: SVG element → original style attribute string (before our patches)
const origStyleAttr = new WeakMap();

// .djs-shape исключает connections; без > ловит вложенные группы (пулы, участники)
const SHAPE_SEL = [
  '.djs-shape .djs-visual rect',
  '.djs-shape .djs-visual circle',
  '.djs-shape .djs-visual ellipse',
  '.djs-shape .djs-visual polygon',
  '.djs-shape .djs-visual path',
].join(',');

// The original is mirrored into a data attribute so it survives a plugin
// re-mount (the WeakMap does not) and patched elements can still be restored.
const ORIG_ATTR = 'data-dt-orig-style';

// Save raw style attributes. Skips elements already patched by us (!important).
function saveOriginals() {
  document.querySelectorAll(SHAPE_SEL).forEach(el => {
    if (origStyleAttr.has(el)) return;
    if (el.hasAttribute(ORIG_ATTR)) {
      origStyleAttr.set(el, el.getAttribute(ORIG_ATTR));
      return;
    }
    const raw = el.getAttribute('style') || '';
    if (!raw.includes('!important')) {
      origStyleAttr.set(el, raw);
      el.setAttribute(ORIG_ATTR, raw);
    }
  });
}

// ── Canvas background ─────────────────────────────────────────────────────────

function patchCanvas(dark) {
  const bg = dark ? CANVAS_BG : 'white';

  document.querySelectorAll('.bjs-container svg, .djs-container svg').forEach(el => {
    if (dark) el.style.setProperty('background', bg, 'important');
    else      el.style.removeProperty('background');
  });

  document.querySelectorAll('.bjs-container svg > g > rect:first-child').forEach(el => {
    if (dark) { el.setAttribute('fill', bg); el.style.setProperty('fill', bg, 'important'); }
    else      { el.removeAttribute('fill'); el.style.removeProperty('fill'); }
  });

  document.querySelectorAll('.djs-container, .bjs-container').forEach(el => {
    if (dark) el.style.setProperty('background', bg, 'important');
    else      el.style.removeProperty('background');
  });
}

// ── Shape colour patching ─────────────────────────────────────────────────────

// WeakSet of elements we just painted DARK_FILL (unset/near-white fill),
// so the icon-colour pass below can find them without re-parsing style.fill
// (which browsers normalise to rgb(), making string comparisons fragile).
const paintedDarkFill = new WeakSet();

function applyDark() {
  // Patch shape fills and strokes
  document.querySelectorAll(SHAPE_SEL).forEach(el => {
    const raw = origStyleAttr.get(el);
    const { fill: origFill, stroke: origStroke } = raw !== undefined
      ? parseStyleAttr(raw)
      : { fill: null, stroke: null };

    // Fill: explicit none/transparent stays transparent (groups, annotations,
    // inner event circles); near-white or unset → DARK_FILL; custom → darken
    const fl = getLightness(origFill);
    if (isNoPaint(origFill)) {
      el.style.setProperty('fill', 'none', 'important');
      paintedDarkFill.delete(el);
    } else if (fl < 0 || fl > 0.94) {
      el.style.setProperty('fill', DARK_FILL, 'important');
      paintedDarkFill.add(el);
    } else {
      el.style.setProperty('fill', darkenColor(origFill) || DARK_FILL, 'important');
      paintedDarkFill.delete(el);
    }

    // Stroke: explicit none stays none; unset, near-black (bpmn-js default) or
    // near-white → DARK_STROKE; custom colours are lightened to stay visible
    const sl = getLightness(origStroke);
    if (isNoPaint(origStroke)) {
      el.style.setProperty('stroke', 'none', 'important');
    } else if (sl < 0.15 || sl > 0.8) {
      el.style.setProperty('stroke', DARK_STROKE, 'important');
    } else {
      el.style.setProperty('stroke', lightenColor(origStroke) || DARK_STROKE, 'important');
    }
  });

  // Swim lane / participant dividers (polylines and lines inside shapes)
  document.querySelectorAll('.djs-shape .djs-visual > polyline, .djs-shape .djs-visual > line').forEach(el => {
    el.style.setProperty('stroke', DARK_STROKE, 'important');
  });

  // Text labels
  document.querySelectorAll('.djs-element .djs-visual text').forEach(el => {
    el.style.setProperty('fill', DARK_TEXT, 'important');
  });

  // Иконки типа задачи (шестерёнка, конверт и т.д.) идут после фонового элемента
  // в .djs-visual (в том числе во вложенных <g>). applyDark даёт им DARK_FILL →
  // невидимы на тёмном фоне. Фон — первый геометрический элемент верхнего уровня.
  const BG_TAGS = new Set(['rect', 'circle', 'ellipse', 'polygon', 'path']);
  document.querySelectorAll('.djs-shape .djs-visual').forEach(visual => {
    const bg = Array.from(visual.children).find(el => BG_TAGS.has(el.tagName.toLowerCase()));
    const bgFill = bg ? bg.style.getPropertyValue('fill') : '';
    visual.querySelectorAll('rect, circle, ellipse, polygon, path').forEach(el => {
      if (el === bg) return;
      if (paintedDarkFill.has(el)) {
        el.style.setProperty('fill', ICON_COLOR, 'important');
        return;
      }
      // Icons of custom-coloured shapes are filled with the shape's own colour,
      // so after darkening they match the background and vanish.
      const fill = el.style.getPropertyValue('fill');
      if (bgFill && bgFill !== 'none' && fill === bgFill) {
        el.style.setProperty('fill', DARK_TEXT, 'important');
      }
    });
  });
}

function restoreLight() {
  document.querySelectorAll(SHAPE_SEL).forEach(el => {
    // After a plugin re-mount the WeakMap is empty; fall back to the DOM copy
    const raw = origStyleAttr.has(el) ? origStyleAttr.get(el) : el.getAttribute(ORIG_ATTR);
    if (raw !== null && raw !== undefined) {
      if (raw) el.setAttribute('style', raw);
      else     el.removeAttribute('style');
    } else {
      el.style.removeProperty('fill');
      el.style.removeProperty('stroke');
    }
    origStyleAttr.delete(el);
    el.removeAttribute(ORIG_ATTR);
  });

  document.querySelectorAll('.djs-element .djs-visual text').forEach(el => {
    el.style.removeProperty('fill');
  });

  document.querySelectorAll('.djs-shape .djs-visual > polyline, .djs-shape .djs-visual > line').forEach(el => {
    el.style.removeProperty('stroke');
  });
}

// ── Theme switching ───────────────────────────────────────────────────────────

let _observer = null;

function enableDark() {
  saveOriginals();
  document.body.classList.add(BODY_CLASS);
  document.documentElement.classList.add(BODY_CLASS);
  patchCanvas(true);
  applyDark();
}

function disableDark() {
  document.body.classList.remove(BODY_CLASS);
  document.documentElement.classList.remove(BODY_CLASS);
  patchCanvas(false);
  restoreLight();
}

function startObserver(dark) {
  if (_observer) { _observer.disconnect(); _observer = null; }
  if (!dark) return;
  // Coalesce bursts of mutations (e.g. dragging, batch re-renders) into a
  // single pass instead of re-scanning the whole document per mutation record.
  let scheduled = false;
  _observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      saveOriginals();
      patchCanvas(true);
      applyDark();
    });
  });
  _observer.observe(document.body, { childList: true, subtree: true });
}

// ── UI Icons ──────────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12"   y1="1"     x2="12"   y2="3"/>
      <line x1="12"   y1="21"    x2="12"   y2="23"/>
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1"    y1="12"    x2="3"    y2="12"/>
      <line x1="21"   y1="12"    x2="23"   y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// ── Plugin component ──────────────────────────────────────────────────────────

export default class DarkThemePlugin extends Component {
  constructor(props) {
    super(props);
    this.state = { dark: loadState() };
    this._toggle = this._toggle.bind(this);
  }

  componentDidMount() {
    const { dark } = this.state;
    if (dark) {
      // Apply CSS class immediately so the UI is dark on startup
      document.body.classList.add(BODY_CLASS);
      document.documentElement.classList.add(BODY_CLASS);
      // Patch SVG elements in waves as the diagram renders
      this._timers = [100, 500, 1200].map(ms => setTimeout(() => {
        saveOriginals();
        patchCanvas(true);
        applyDark();
      }, ms));
      startObserver(true);
    } else {
      disableDark();
    }
  }

  componentWillUnmount() {
    (this._timers || []).forEach(clearTimeout);
    this._timers = [];
    startObserver(false);
  }

  _toggle() {
    // Side effects stay outside the setState updater (it may run twice).
    const next = !this.state.dark;
    saveState(next);
    if (next) { enableDark(); startObserver(true); }
    else      { disableDark(); startObserver(false); }
    this.setState({ dark: next });
  }

  render() {
    const { dark } = this.state;
    return (
      <Fill slot="status-bar__app" group="9_dark-theme">
        <button
          className="dark-theme-btn"
          title={dark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          onClick={this._toggle}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
          <span>{dark ? 'Light' : 'Dark'}</span>
        </button>
      </Fill>
    );
  }
}
