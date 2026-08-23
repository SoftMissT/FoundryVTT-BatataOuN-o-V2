/**
 * Benchmark engine — detecta GPU e mede performance real do canvas.
 * @module benchmark
 */

/** @typedef {{ gpu: string, renderer: string, fps: number, score: number, tier: number }} BenchmarkResult */

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
    aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
    aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
  };
}

/**
 * Roda um benchmark rápido medindo FPS do canvas por N frames.
 * Não bloqueia a UI — usa requestAnimationFrame.
 *
 * @param {number} durationMs — duração do teste em ms (default: 2000)
 * @returns {Promise<BenchmarkResult>}
 */
export async function runBenchmark(durationMs = 2000) {
  const gpu = detectGPU();
  const glParams = getGLParameters();

  if (!canvas?.ready) {
    return {
      gpu: gpu.renderer,
      renderer: gpu.vendor,
      fps: 0,
      score: 0,
      tier: 0,
      glParams,
    };
  }

  // Coletar FPS do canvas durante durationMs
  const fpsHistory = [];
  const t0 = performance.now();

  return new Promise((resolve) => {
    const collect = () => {
      const now = performance.now();
      const elapsed = now - t0;

      if (canvas?.fps?.render !== undefined) {
        fpsHistory.push(canvas.fps.render);
      }

      if (elapsed >= durationMs) {
        const avgFps =
          fpsHistory.length > 0
            ? fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length
            : 0;

        const score = calculateScore(avgFps, gpu.renderer, glParams);
        const tier = scoreToTier(score);

        resolve({
          gpu: gpu.renderer,
          renderer: gpu.vendor,
          fps: Math.round(avgFps),
          score,
          tier,
          glParams,
        });
      } else {
        requestAnimationFrame(collect);
      }
    };

    requestAnimationFrame(collect);
  });
}

/**
 * Calcula um score de 0-100 baseado no FPS, GPU e capabilities.
 * @param {number} avgFps
 * @param {string} gpuName
 * @param {Object} glParams
 * @returns {number}
 */
function calculateScore(avgFps, gpuName, glParams) {
  // FPS contribution (0-60 points)
  const fpsScore = Math.min(60, (avgFps / 60) * 60);

  // GPU tier contribution (0-25 points)
  const gpuLower = gpuName.toLowerCase();
  let gpuScore = 12; // default mid
  if (
    gpuLower.includes("rtx") ||
    gpuLower.includes("rx 7") ||
    gpuLower.includes("a100") ||
    gpuLower.includes("m3")
  ) {
    gpuScore = 25;
  } else if (
    gpuLower.includes("gtx 16") ||
    gpuLower.includes("rx 5") ||
    gpuLower.includes("m1") ||
    gpuLower.includes("iris xe")
  ) {
    gpuScore = 18;
  } else if (
    gpuLower.includes("intel hd") ||
    gpuLower.includes("uhd 6") ||
    gpuLower.includes("vega") ||
    gpuLower.includes("radeon")
  ) {
    gpuScore = 10;
  } else if (
    gpuLower.includes("swiftshader") ||
    gpuLower.includes("llvmpipe") ||
    gpuLower.includes("soft")
  ) {
    gpuScore = 3;
  }

  // GL capabilities contribution (0-15 points)
  let capScore = 7;
  if (glParams.maxTextureSize >= 16384) capScore = 15;
  else if (glParams.maxTextureSize >= 8192) capScore = 12;
  else if (glParams.maxTextureSize >= 4096) capScore = 9;
  else if (glParams.maxTextureSize < 2048) capScore = 4;

  return Math.round(fpsScore + gpuScore + capScore);
}

/**
 * Converte score numérico em tier (0-2).
 * @param {number} score
 * @returns {number} 0 = potato, 1 = good potato, 2 = premium
 */
function scoreToTier(score) {
  if (score < 35) return 0;
  if (score < 65) return 1;
  return 2;
}
