/**
 * Utilitários internos do Batata Ou Não.
 * Batch defensivo, profiling, validação e debug controlado.
 * @module utils
 */

import { MODULE_ID } from "./main.js";

// ─── Debug ──────────────────────────────────────────────────────

/**
 * Verifica se logs de debug estão ativados (setting debugLogs).
 * @returns {boolean}
 */
export function debugEnabled() {
  try {
    return game.settings.get(MODULE_ID, "debugLogs") === true;
  } catch {
    return false;
  }
}

/**
 * Log de debug — só escreve se debugLogs estiver ativo.
 * @param {...any} args
 */
export function debugLog(...args) {
  if (debugEnabled()) console.debug("BatataOuNao |", ...args);
}

// ─── Settings defensivos ────────────────────────────────────────

/**
 * Verifica se um setting está registrado no Foundry.
 * @param {string} moduleId
 * @param {string} key
 * @returns {boolean}
 */
export function isSettingRegistered(moduleId, key) {
  try {
    return game.settings.settings.has(`${moduleId}.${key}`);
  } catch {
    return false;
  }
}

/**
 * Aplica um setting somente se ele estiver registrado.
 * Nunca quebra se o setting não existir — apenas pula.
 * @param {string} moduleId
 * @param {string} key
 * @param {any} value
 * @returns {Promise<{skipped: boolean, reason?: string}>}
 */
export async function safeSetSetting(moduleId, key, value) {
  if (!isSettingRegistered(moduleId, key)) {
    debugLog(`skipped ${moduleId}.${key} (not registered)`);
    return { skipped: true, reason: "not-registered" };
  }
  try {
    await game.settings.set(moduleId, key, value);
    return { skipped: false };
  } catch (err) {
    console.error(`BatataOuNao | Falha ao definir ${moduleId}.${key}:`, err);
    return { skipped: true, reason: "error" };
  }
}

/**
 * Retorna o primeiro candidato de key registrado, ou null.
 * @param {string} moduleId
 * @param {string[]} candidates
 * @returns {string|null}
 */
export function resolveSettingKey(moduleId, candidates) {
  for (const key of candidates) {
    if (isSettingRegistered(moduleId, key)) return key;
  }
  return null;
}

// ─── Batch Update ───────────────────────────────────────────────

/**
 * Aplica múltiplos settings em lote de forma defensiva.
 * Settings não registrados são pulados (log só em debug).
 * @param {Array<{module: string, setting: string, value: any, candidates?: string[]}>} updates
 * @returns {Promise<{applied: number, skipped: number, failed: number}>}
 */
export async function batchSetSettings(updates) {
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    updates.map(async ({ module: mod, setting, value, candidates }) => {
      const key = candidates
        ? resolveSettingKey(mod, candidates)
        : (isSettingRegistered(mod, setting) ? setting : null);

      if (!key) {
        debugLog(`skipped ${mod}.${setting} (not registered)`);
        skipped++;
        return;
      }
      const res = await safeSetSetting(mod, key, value);
      if (res.skipped) skipped++;
      else applied++;
    })
  );

  for (const r of results) {
    if (r.status === "rejected") failed++;
  }

  return { applied, skipped, failed };
}

// ─── Profiling ──────────────────────────────────────────────────

/**
 * Mede o tempo de execução de uma função.
 * @param {string} label
 * @param {Function} fn
 * @returns {Promise<{result: any, ms: number}>}
 */
export async function profile(label, fn) {
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  debugLog(`${label}: ${ms.toFixed(2)}ms`);
  return { result, ms };
}

// ─── Validação ──────────────────────────────────────────────────

/**
 * Valida se um quality level é válido.
 * @param {number} level
 * @throws {Error}
 */
export function validateQualityLevel(level) {
  if (typeof level !== "number" || level < 0 || level > 2) {
    throw new Error(
      `BatataOuNao | qualityLevel deve ser 0, 1 ou 2. Recebido: ${level}`
    );
  }
}

/**
 * Clone profundo — usa foundry.utils se disponível.
 * @param {any} obj
 * @returns {any}
 */
export function deepClone(obj) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(obj);
  return structuredClone(obj);
}
