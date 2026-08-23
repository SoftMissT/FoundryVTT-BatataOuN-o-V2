/**
 * Monitor de performance — track FPS em tempo real e auto-degrada.
 * @module monitor
 */

import { applyQuality } from "./quality.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";

/** Estado do monitor. */
const state = {
  active: false,
  hookId: null,
  fpsHistory: [],
  degradeThreshold: 15,
  upgradeThreshold: 40,
  sampleSize: 120,
  degradeCooldown: 5000,
  lastDegrade: 0,
  autoAdjust: true,
};

/**
 * Inicia o monitor de performance.
 * Coleta FPS a cada frame e degrada automaticamente se lag persistir.
 * @param {Object} [options]
 * @param {boolean} [options.autoAdjust=true] — se deve degradar/escalar sozinho
 * @param {number} [options.degradeThreshold=15] — FPS abaixo do qual degrada
 * @param {number} [options.upgradeThreshold=40] — FPS acima do qual tenta escalar
 * @param {number} [options.sampleSize=120] — quantos frames analisar
 */
export function startMonitor(options = {}) {
  if (state.active) return;

  state.active = true;
  state.autoAdjust = options.autoAdjust ?? true;
  state.degradeThreshold = options.degradeThreshold ?? 15;
  state.upgradeThreshold = options.upgradeThreshold ?? 40;
  state.sampleSize = options.sampleSize ?? 120;
  state.fpsHistory = [];

  state.hookId = Hooks.on("canvasReady", () => {
    _attachFrameHook();
  });

  // Se canvas já está pronto, attach direto
  if (canvas?.ready) {
    _attachFrameHook();
  }

  console.log("BatataOuNao | Monitor iniciado");
}

/**
 * Para o monitor de performance.
 */
export function stopMonitor() {
  if (!state.active) return;

  if (state.hookId !== null) {
    Hooks.off("canvasReady", state.hookId);
  }

  state.active = false;
  state.hookId = null;
  state.fpsHistory = [];

  console.log("BatataOuNao | Monitor parado");
}

/**
 * Retorna o estado atual do monitor.
 * @returns {{ active: boolean, avgFps: number, currentFps: number, tier: number }}
 */
export function getMonitorState() {
  const currentFps = canvas?.fps?.render ?? 0;
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
 * Obtém histórico de FPS para gráficos/debug.
 * @returns {number[]}
 */
export function getFpsHistory() {
  return [...state.fpsHistory];
}

// ─── Internos ───────────────────────────────────────────────────

function _attachFrameHook() {
  // Monitora usando o ticker do PIXI
  if (!canvas?.app?.ticker) return;

  canvas.app.ticker.add(() => {
    if (!state.active || !canvas?.ready) return;

    const fps = canvas.fps?.render ?? 0;
    state.fpsHistory.push(fps);

    // Manter janela de sampleSize
    if (state.fpsHistory.length > state.sampleSize) {
      state.fpsHistory.shift();
    }

    // Auto-degradar se FPS caiu muito
    if (state.autoAdjust && state.fpsHistory.length >= state.sampleSize) {
      _checkAutoAdjust();
    }
  });
}

function _checkAutoAdjust() {
  const avg =
    state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length;
  const now = Date.now();

  // Cooldown entre degradações
  if (now - state.lastDegrade < state.degradeCooldown) return;

  const currentLevel = getSetting(SETTING_KEYS.POTATO_LEVEL);

  if (avg < state.degradeThreshold && currentLevel > 0) {
    const newLevel = currentLevel - 1;
    console.log(
      `BatataOuNao | Auto-degradando: FPS ${Math.round(avg)} < ${state.degradeThreshold} → nível ${newLevel}`
    );
    applyQuality(newLevel);
    state.lastDegrade = now;
    state.fpsHistory = [];
    Hooks.call("BatataOuNaoAutoDegrade", newLevel, avg);
  } else if (avg > state.upgradeThreshold && currentLevel < 2) {
    const newLevel = currentLevel + 1;
    console.log(
      `BatataOuNao | Auto-escalando: FPS ${Math.round(avg)} > ${state.upgradeThreshold} → nível ${newLevel}`
    );
    applyQuality(newLevel);
    state.lastDegrade = now;
    state.fpsHistory = [];
    Hooks.call("BatataOuNaoAutoUpgrade", newLevel, avg);
  }
}

function _fpsToTier(fps) {
  if (fps < 15) return 0;
  if (fps < 35) return 1;
  return 2;
}
