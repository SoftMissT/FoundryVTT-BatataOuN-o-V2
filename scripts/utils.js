/**
 * Utilitários internos do Batata Ou Não.
 * Batch updates, profiling e validação.
 * @module utils
 */

// ─── Batch Update ───────────────────────────────────────────────

/**
 * Aplica múltiplos settings em lote via Promise.allSettled.
 * @param {Array<{module: string, setting: string, value: any}>} updates
 * @returns {Promise<PromiseSettledResult<any>[]>}
 */
export async function batchSetSettings(updates) {
  const promises = updates.map(({ module: mod, setting, value }) =>
    game.settings.set(mod, setting, value).catch((err) => {
      console.error(`BatataOuNao | Falha ao definir ${mod}.${setting}:`, err);
      return err;
    })
  );
  return Promise.allSettled(promises);
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
  console.log(`BatataOuNao | ${label}: ${ms.toFixed(2)}ms`);
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
 * Verifica se um módulo está registrado.
 * @param {string} moduleId
 * @returns {boolean}
 */
export function isModuleRegistered(moduleId) {
  return game.modules.has(moduleId);
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
