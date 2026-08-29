/**
 * Utilitários internos do Batata Ou Não.
 * Batch defensivo, profiling, validação e debug controlado.
 *
 * @module utils
 */

import { MODULE_ID } from "./main.js";

// ─── Debug ──────────────────────────────────────────────────────

/**
 * Verifica se logs de debug estão ativados (setting debugLogs).
 *
 * @returns {boolean}
 */
export function debugEnabled() {
  try {
    return globalThis.game?.settings?.get?.(MODULE_ID, "debugLogs") === true;
  } catch {
    return false;
  }
}

/**
 * Log de debug só escreve se debugLogs estiver ativo.
 *
 * @param {...any} args
 */
export function debugLog(...args) {
  if (debugEnabled()) {
    console.debug("BatataOuNao |", ...args);
  }
}

// ─── Settings defensivos ────────────────────────────────────────

/**
 * Verifica se um setting está registrado no Foundry.
 *
 * @param {string} moduleId
 * @param {string} key
 * @returns {boolean}
 */
export function isSettingRegistered(moduleId, key) {
  try {
    return (
      globalThis.game?.settings?.settings?.has?.(`${moduleId}.${key}`) === true
    );
  } catch {
    return false;
  }
}

/**
 * Aplica um setting somente se ele estiver registrado.
 *
 * Retorna status explícito:
 * - applied: setting existe e foi aplicado
 * - skipped: setting não existe nesta versão/módulo
 * - failed: game.settings indisponível ou erro ao aplicar
 *
 * @param {string} moduleId
 * @param {string} key
 * @param {any} value
 * @returns {Promise<{
 *   status: "applied"|"skipped"|"failed",
 *   module: string,
 *   key: string,
 *   value: any,
 *   reason?: string,
 *   error?: string
 * }>}
 */
export async function safeSetSetting(moduleId, key, value) {
  if (!globalThis.game?.settings) {
    return {
      status: "failed",
      module: moduleId,
      key,
      value,
      reason: "game-settings-unavailable",
    };
  }

  if (!isSettingRegistered(moduleId, key)) {
    debugLog(`skipped ${moduleId}.${key} (not registered)`);

    return {
      status: "skipped",
      module: moduleId,
      key,
      value,
      reason: "not-registered",
    };
  }

  try {
    await game.settings.set(moduleId, key, value);

    debugLog(`applied ${moduleId}.${key}`, value);

    return {
      status: "applied",
      module: moduleId,
      key,
      value,
    };
  } catch (err) {
    console.error(`BatataOuNao | Falha ao definir ${moduleId}.${key}:`, err);

    return {
      status: "failed",
      module: moduleId,
      key,
      value,
      reason: "error",
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Retorna o primeiro candidato de key registrado, ou null.
 *
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
 *
 * Settings não registrados são pulados.
 * Erros reais são marcados como failed.
 * O retorno inclui detalhes para UI, QA e debug.
 *
 * @param {Array<{
 *   module: string,
 *   setting: string,
 *   value: any,
 *   candidates?: string[]
 * }>} updates
 * @returns {Promise<{
 *   applied: number,
 *   skipped: number,
 *   failed: number,
 *   details: Array<{
 *     status: "applied"|"skipped"|"failed",
 *     module: string,
 *     setting: string,
 *     key: string|null,
 *     value: any,
 *     reason?: string,
 *     error?: string
 *   }>
 * }>}
 */
export async function batchSetSettings(updates) {
  const details = await Promise.all(
    updates.map(async ({ module: mod, setting, value, candidates }) => {
      const key = candidates
        ? resolveSettingKey(mod, candidates)
        : isSettingRegistered(mod, setting)
          ? setting
          : null;

      if (!key) {
        debugLog(`skipped ${mod}.${setting} (not registered)`);

        return {
          status: "skipped",
          module: mod,
          setting,
          key: null,
          value,
          reason: "not-registered",
        };
      }

      const result = await safeSetSetting(mod, key, value);

      return {
        ...result,
        setting,
        key,
      };
    }),
  );

  const summary = {
    applied: details.filter((r) => r.status === "applied").length,
    skipped: details.filter((r) => r.status === "skipped").length,
    failed: details.filter((r) => r.status === "failed").length,
    details,
  };

  debugLog(
    `batchSetSettings: ${summary.applied} applied, ${summary.skipped} skipped, ${summary.failed} failed`,
    details,
  );

  return summary;
}

// ─── Profiling ──────────────────────────────────────────────────

/**
 * Mede o tempo de execução de uma função.
 *
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
 *
 * @param {number} level
 * @throws {Error}
 */
export function validateQualityLevel(level) {
  if (typeof level !== "number" || level < 0 || level > 2) {
    throw new Error(
      `BatataOuNao | qualityLevel deve ser 0, 1 ou 2. Recebido: ${level}`,
    );
  }
}

/**
 * Clone profundo usa foundry.utils se disponível.
 *
 * @param {any} obj
 * @returns {any}
 */
export function deepClone(obj) {
  if (globalThis.foundry?.utils?.deepClone) {
    return foundry.utils.deepClone(obj);
  }

  return structuredClone(obj);
}
