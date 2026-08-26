/**
 * Benchmark engine — detecta GPU e mede performance real do canvas.
 * Medição resiliente: canvas.fps.render → fallback requestAnimationFrame.
 * FPS indisponível nunca é tratado como 0 FPS real.
 * @module benchmark
 */

/** @typedef {{ gpu: string, renderer: string, fps: number|null, fpsAvailable: boolean, fpsSource: string|null, score: number|null, tier: number|null, glParams: Object, reason?: string }} BenchmarkResult */

/**
 * Detecta informações da GPU via WebGL.
 * @returns {{ vendor: string, renderer: string, version: string }}
 */
export function detectGPU() {
  if (!canvas?.app?.renderer) {
    return { vendor: "Unknown", renderer: "Unknown", version: "Unknown" };
  }

  const gl = canvas.app.renderer.gl;
  if (!gl) {
    return { vendor: "Unknown", renderer: "Unknown", version: "Unknown" };
  }

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    vendor: debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR),
    renderer: debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
  };
}

/**
 * Obtém parâmetros GL relevantes para performance.
 * @returns {Object}
 */
export function getGLParameters() {
  if (!canvas?.app?.renderer?.gl) return {};

  const gl = canvas.app.renderer.gl;
  return {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
  };
}

/**
 * Roda o benchmark. Nunca classifica por FPS se o FPS não puder ser medido.
 *
 * @param {number} durationMs — duração da janela de medição (default: 3000)
 * @returns {Promise<BenchmarkResult>}
 */
export async function runBenchmark(durationMs = 3000) {
  const gpu = detectGPU();
  const glParams = getGLParameters();

  if (!canvas?.ready) {
    return {
      timestamp: Date.now(),
      gpu: gpu.renderer,
      renderer: gpu.vendor,
      fps: null,
      fpsAvailable: false,
      fpsSource: null,
      score: null,
      tier: null,
      glParams,
      reason: "canvas-not-ready",
    };
  }

  // Garantir que o medidor do Foundry está ativo
  try {
    canvas.activateFPSMeter?.();
  } catch {
    /* medidor nativo indisponível — fallback cobre */
  }

  const measured = await _measureFps(durationMs);
  const fpsAvailable = measured.fps !== null && measured.fps > 0;

  let score = null;
  let tier = null;
  if (fpsAvailable) {
    score = calculateScore(measured.fps, gpu.renderer, glParams);
    tier = scoreToTier(score);
  }
  // Sem FPS confiável: sem score/tier — GPU e caps sozinhos não diagnosticam.

  return {
    timestamp: Date.now(),
    gpu: gpu.renderer,
    renderer: gpu.vendor,
    fps: fpsAvailable ? Math.round(measured.fps) : null,
    fpsAvailable,
    fpsSource: fpsAvailable ? measured.source : null,
    score,
    tier,
    glParams,
    reason: fpsAvailable ? undefined : measured.reason,
  };
}

// ─── Medição ────────────────────────────────────────────────────

/**
 * Mede FPS: primeiro tenta canvas.fps.render; se inválido, usa rAF delta.
 * @param {number} durationMs
 * @returns {Promise<{fps: number|null, source: string|null, reason?: string}>}
 */
function _measureFps(durationMs) {
  return new Promise((resolve) => {
    const nativeSamples = [];
    const t0 = performance.now();

    const finish = (rafFps) => {
      // 1) Preferir o medidor nativo se ele produziu dados válidos
      const nativeAvg =
        nativeSamples.length > 0
          ? nativeSamples.reduce((a, b) => a + b, 0) / nativeSamples.length
          : 0;

      if (nativeAvg > 0) {
        resolve({ fps: nativeAvg, source: "canvas.fps" });
        return;
      }

      // 2) Fallback: contagem de frames via requestAnimationFrame
      if (rafFps !== null && rafFps > 0) {
        resolve({ fps: rafFps, source: "raf" });
        return;
      }

      // 3) Nada confiável — explicitar indisponibilidade
      resolve({ fps: null, source: null, reason: "unavailable" });
    };

    // Coletor do medidor nativo
    const nativeCollector = () => {
      const v = canvas?.fps?.render;
      if (typeof v === "number" && v > 0) nativeSamples.push(v);
    };

    // Contador rAF (mede o frame rate real do loop de render)
    let rafFrames = 0;
    const rafT0 = performance.now();

    const rafTick = () => {
      rafFrames++;
      nativeCollector();
      const elapsed = performance.now() - rafT0;
      if (elapsed >= durationMs) {
        finish(rafFrames / (elapsed / 1000));
      } else {
        requestAnimationFrame(rafTick);
      }
    };

    requestAnimationFrame(rafTick);

    // Safety: se rAF não disparar (aba oculta), resolve por timeout
    setTimeout(() => finish(rafFrames / ((performance.now() - rafT0) / 1000)), durationMs + 1500);
  });
}

// ─── Scoring ────────────────────────────────────────────────────

/**
 * Calcula score 0-100. Só chamado quando FPS está disponível.
 * @param {number} avgFps
 * @param {string} gpuName
 * @param {Object} glParams
 * @returns {number}
 */
function calculateScore(avgFps, gpuName, glParams) {
  const fpsScore = Math.min(60, (avgFps / 60) * 60);

  const gpuLower = (gpuName ?? "").toLowerCase();
  let gpuScore = 12;
  if (/(rtx|rx 7|arc a|m3)/.test(gpuLower)) gpuScore = 25;
  else if (/(gtx 16|rx 5|m1|m2|iris xe)/.test(gpuLower)) gpuScore = 18;
  else if (/(intel hd|uhd 6|vega|radeon)/.test(gpuLower)) gpuScore = 10;
  else if (/(swiftshader|llvmpipe|soft)/.test(gpuLower)) gpuScore = 3;

  let capScore = 7;
  const maxTex = glParams?.maxTextureSize ?? 0;
  if (maxTex >= 16384) capScore = 15;
  else if (maxTex >= 8192) capScore = 12;
  else if (maxTex >= 4096) capScore = 9;
  else if (maxTex < 2048) capScore = 4;

  return Math.round(fpsScore + gpuScore + capScore);
}

/**
 * Converte score em tier (0-2). Só chamado quando FPS está disponível.
 * @param {number} score
 * @returns {number}
 */
function scoreToTier(score) {
  if (score < 35) return 0;
  if (score < 65) return 1;
  return 2;
}
