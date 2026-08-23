/**
 * Monitor de performance — track FPS em tempo real e auto-degrada.
 * Um único ticker callback, limpo em stop e em canvasTearDown.
 * @module monitor
 */

import { applyQuality } from "./quality.js";
import { getSetting, SETTING_KEYS } from "./settings.js";
import { debugLog } from "./utils.js";

/** Estado do monitor. */
const state = {
  active: false,
  tickerFn: null,
  hookCanvasReady: null,
  hookCanvasTearDown: null,
  fpsHistory: [],
  lastTickTime: 0,
  lastEmitTime: 0,
  degradeThreshold: 15,
  upgradeThreshold: 40,
  sampleSize: 120,
  degradeCooldown: 5000,
  lastAdjust: 0,
  autoAdjust: true,
};

/**
 * Inicia o monitor de performance.
 * Idempotente: chamar duas vezes não cria ticker duplicado.
 * @param {Object} [options]
 * @param {boolean} [options.autoAdjust=true]
 * @param {number} [options.degradeThreshold=15]
 * @param {number} [options.upgradeThreshold=40]
 * @param {number} [options.sampleSize=120]
 */
export function startMonitor(options = {}) {
  if (state.active) {
    debugLog("startMonitor ignorado — já ativo");
    return;
  }

  state.active = true;
  state.autoAdjust = options.autoAdjust ?? true;
  state.degradeThreshold = options.degradeThreshold ?? 15;
  state.upgradeThreshold = options.upgradeThreshold ?? 40;
  state.sampleSize = options.sampleSize ?? 120;
  state.fpsHistory = [];
  state.lastTickTime = performance.now();
  state.lastEmitTime = 0;

  state.hookCanvasReady = Hooks.on("canvasReady", () => _attachTicker());
  state.hookCanvasTearDown = Hooks.on("canvasTearDown", () => _detachTicker());

  if (canvas?.ready) _attachTicker();

  debugLog("Monitor iniciado");
}

/**
 * Para o monitor e limpa ticker + hooks.
 */
export function stopMonitor() {
  if (!state.active) return;

  _detachTicker();

  if (state.hookCanvasReady !== null) {
    Hooks.off("canvasReady", state.hookCanvasReady);
    state.hookCanvasReady = null;
  }
  if (state.hookCanvasTearDown !== null) {
    Hooks.off("canvasTearDown", state.hookCanvasTearDown);
    state.hookCanvasTearDown = null;
  }

  state.active = false;
  state.fpsHistory = [];
  debugLog("Monitor parado");
}

/**
 * Estado atual do monitor.
 * @returns {{ active: boolean, avgFps: number, currentFps: number, tier: number }}
 */
export function getMonitorState() {
  const currentFps = _currentFps();
  const avgFps =
    state.fpsHistory.length > 0
      ? state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length
      : currentFps;

  return {
    active: state.active,
    avgFps: Math.round(avgFps),
    currentFps: Math.round(currentFps),
    tier: _fpsToTier(avgFps),
  };
}

/**
 * Histórico de FPS (cópia).
 * @returns {number[]}
 */
export function getFpsHistory() {
  return [...state.fpsHistory];
}

// ─── Internos ───────────────────────────────────────────────────

/**
 * FPS atual: prefere canvas.fps.render se válido; senão usa a última
 * amostra instantânea coletada do ticker.
 * @returns {number}
 */
function _currentFps() {
  const native = canvas?.fps?.render;
  if (typeof native === "number" && native > 0) return native;
  return state.fpsHistory.length > 0
    ? state.fpsHistory[state.fpsHistory.length - 1]
    : 0;
}

function _attachTicker() {
  if (!canvas?.app?.ticker) return;
  if (state.tickerFn) return; // nunca duplicar

  state.lastTickTime = performance.now();

  state.tickerFn = () => {
    const now = performance.now();
    const dt = now - state.lastTickTime;
    state.lastTickTime = now;

    // Amostra instantânea via delta do ticker (fallback nativo)
    if (dt > 0 && dt < 1000) {
      state.fpsHistory.push(1000 / dt);
      if (state.fpsHistory.length > state.sampleSize) state.fpsHistory.shift();
    }

    // Publica tick e avalia auto-ajuste no máximo 1x por segundo
    if (now - state.lastEmitTime >= 1000) {
      state.lastEmitTime = now;
      Hooks.call("BatataOuNaoMonitorTick", getMonitorState());
      if (state.autoAdjust) _checkAutoAdjust();
    }
  };

  canvas.app.ticker.add(state.tickerFn);
}

function _detachTicker() {
  if (state.tickerFn && canvas?.app?.ticker) {
    canvas.app.ticker.remove(state.tickerFn);
  }
  state.tickerFn = null;
}

function _checkAutoAdjust() {
  if (state.fpsHistory.length < state.sampleSize) return;

  const avg =
    state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length;
  const now = Date.now();

  if (now - state.lastAdjust < state.degradeCooldown) return;

  const currentLevel = getSetting(SETTING_KEYS.POTATO_LEVEL);

  if (avg < state.degradeThreshold && currentLevel > 0) {
    const newLevel = currentLevel - 1;
    debugLog(`Auto-degradando: FPS ${Math.round(avg)} → nível ${newLevel}`);
    applyQuality(newLevel);
    state.lastAdjust = now;
    state.fpsHistory = [];
    Hooks.call("BatataOuNaoAutoDegrade", newLevel, avg);
  } else if (avg > state.upgradeThreshold && currentLevel < 2) {
    const newLevel = currentLevel + 1;
    debugLog(`Auto-escalando: FPS ${Math.round(avg)} → nível ${newLevel}`);
    applyQuality(newLevel);
    state.lastAdjust = now;
    state.fpsHistory = [];
    Hooks.call("BatataOuNaoAutoUpgrade", newLevel, avg);
  }
}

function _fpsToTier(fps) {
  if (fps <= 0) return 0;
  if (fps < 15) return 0;
  if (fps < 35) return 1;
  return 2;
}
