/**
 * Benchmark engine diagnóstico real de performance do cliente Foundry.
 *
 * Mede:
 * - GPU/WebGL caps
 * - FPS médio
 * - frametime médio
 * - p95/p99 frametime
 * - 1% low FPS
 * - stutter percentage
 * - long frames
 * - peso aproximado da cena
 *
 * Nunca classifica FPS indisponível como 0 FPS.
 *
 * @module benchmark
 */

const DEFAULT_DURATION_MS = 6000;
const WARMUP_MS = 1000;
const MIN_SAMPLE_COUNT = 90;
const STUTTER_FRAME_MS = 33.34;
const LONG_FRAME_MS = 50;
const MAX_GRAPH_SAMPLES = 90;

/**
 * Detecta informações da GPU via WebGL.
 *
 * @returns {{
 *   vendor: string,
 *   renderer: string,
 *   version: string,
 *   softwareRenderer: boolean
 * }}
 */
export function detectGPU() {
  try {
    const gl = globalThis.canvas?.app?.renderer?.gl;
    if (!gl) return unknownGpu();

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);

    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);

    const version = gl.getParameter(gl.VERSION);

    return {
      vendor: String(vendor ?? "Unknown"),
      renderer: String(renderer ?? "Unknown"),
      version: String(version ?? "Unknown"),
      softwareRenderer: isSoftwareRenderer(renderer),
    };
  } catch {
    return unknownGpu();
  }
}

/**
 * Obtém parâmetros GL relevantes para performance.
 *
 * @returns {Object}
 */
export function getGLParameters() {
  try {
    const gl = globalThis.canvas?.app?.renderer?.gl;
    if (!gl) return {};

    return {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      maxViewportDims: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) ?? []),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(
        gl.MAX_FRAGMENT_UNIFORM_VECTORS,
      ),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
    };
  } catch {
    return {};
  }
}

/**
 * Roda benchmark real.
 *
 * Mantém compatibilidade com o código atual:
 * - retorna `fps`, `fpsAvailable`, `score`, `tier`, `gpu`, `renderer`, `glParams`
 *
 * Também adiciona métricas novas:
 * - baseline.avgFrameMs
 * - baseline.p95FrameMs
 * - baseline.p99FrameMs
 * - baseline.low1Fps
 * - baseline.stutterPct
 * - sceneWeight
 * - reliable
 * - reliabilityWarnings
 * - recommendation
 *
 * @param {number} durationMs
 * @returns {Promise<Object>}
 */
export async function runBenchmark(durationMs = DEFAULT_DURATION_MS) {
  const timestamp = Date.now();
  const foundryVersion =
    globalThis.game?.version ?? globalThis.game?.release?.version ?? "unknown";

  const gpuInfo = detectGPU();
  const glParams = getGLParameters();
  const sceneWeight = getSceneWeight();

  if (!globalThis.canvas?.ready) {
    return unavailableResult({
      timestamp,
      foundryVersion,
      gpuInfo,
      glParams,
      sceneWeight,
      reason: "canvas-not-ready",
      reliabilityWarnings: ["Canvas não estava pronto no início do benchmark."],
      notes: [
        "Canvas não está pronto. Abra uma cena e rode o benchmark novamente.",
      ],
    });
  }

  const reliabilityWarnings = [];
  const notes = [];

  if (globalThis.document?.hidden) {
    reliabilityWarnings.push("A aba estava oculta no início do benchmark.");
  }

  try {
    globalThis.canvas?.activateFPSMeter?.();
  } catch {
    notes.push(
      "Medidor nativo de FPS indisponível; usando frametime via requestAnimationFrame.",
    );
  }

  await delay(WARMUP_MS);

  const measured = await measureFrameTimes(durationMs);
  const fpsAvailable = measured.avgFps !== null && measured.avgFps > 0;

  if (measured.hiddenDetected) {
    reliabilityWarnings.push("A aba ficou oculta durante o benchmark.");
  }

  if (measured.sampleCount < MIN_SAMPLE_COUNT) {
    reliabilityWarnings.push(
      `Poucas amostras coletadas (${measured.sampleCount}/${MIN_SAMPLE_COUNT}).`,
    );
  }

  if (gpuInfo.softwareRenderer) {
    notes.push(
      "Renderer parece ser software/SwiftShader. Verifique aceleração por hardware.",
    );
  }

  for (const warning of sceneWeight.warnings) notes.push(warning);

  const reliable =
    fpsAvailable &&
    measured.sampleCount >= MIN_SAMPLE_COUNT &&
    !measured.hiddenDetected &&
    globalThis.canvas?.ready === true;

  if (!fpsAvailable) {
    return unavailableResult({
      timestamp,
      foundryVersion,
      gpuInfo,
      glParams,
      sceneWeight,
      reason: measured.reason ?? "fps-unavailable",
      reliabilityWarnings,
      notes: [
        ...notes,
        "FPS não pôde ser medido com confiança. Mantenha a cena aberta e a aba ativa.",
      ],
    });
  }

  const score = calculateScore({
    avgFps: measured.avgFps,
    low1Fps: measured.low1Fps,
    p95FrameMs: measured.p95FrameMs,
    stutterPct: measured.stutterPct,
    gpuInfo,
    glParams,
    sceneWeight,
    reliable,
  });

  const tier = reliable ? scoreToTier(score) : null;

  const recommendation = buildRecommendation({
    tier,
    score,
    reliable,
    measured,
    sceneWeight,
    gpuInfo,
    reliabilityWarnings,
  });

  return {
    timestamp,
    foundryVersion,

    gpu: gpuInfo.renderer,
    renderer: gpuInfo.vendor,
    gpuInfo,
    glParams,

    fps: Math.round(measured.avgFps),
    fpsAvailable: true,
    fpsSource: measured.source,

    score,
    scoreAvailable: score !== null,
    tier,

    reliable,
    reliabilityWarnings,
    reason: reliable ? undefined : "unreliable-measurement",

    avgFrameMs: round(measured.avgFrameMs, 2),
    p95FrameMs: round(measured.p95FrameMs, 2),
    p99FrameMs: round(measured.p99FrameMs, 2),
    low1Fps: Math.round(measured.low1Fps),
    stutterPct: round(measured.stutterPct, 1),
    longFrames: measured.longFrames,
    sampleCount: measured.sampleCount,
    samples: measured.samples,

    baseline: {
      durationMs,
      sampleCount: measured.sampleCount,
      avgFps: Math.round(measured.avgFps),
      avgFrameMs: round(measured.avgFrameMs, 2),
      p95FrameMs: round(measured.p95FrameMs, 2),
      p99FrameMs: round(measured.p99FrameMs, 2),
      low1Fps: Math.round(measured.low1Fps),
      stutterPct: round(measured.stutterPct, 1),
      longFrames: measured.longFrames,
      fpsSource: measured.source,
      samples: measured.samples,
    },

    sceneWeight,
    scene: sceneWeight,

    notes,
    recommendation,
    recommendationReasons: recommendation.reasons,
  };
}

// ─── Medição ────────────────────────────────────────────────────

function measureFrameTimes(durationMs) {
  return new Promise((resolve) => {
    const raf = globalThis.requestAnimationFrame;
    const caf = globalThis.cancelAnimationFrame;

    if (typeof raf !== "function") {
      resolve({
        avgFps: null,
        source: null,
        reason: "request-animation-frame-unavailable",
        sampleCount: 0,
        samples: null,
        hiddenDetected: Boolean(globalThis.document?.hidden),
      });
      return;
    }

    const frameTimes = [];
    const nativeSamples = [];
    const startedAt = performance.now();

    let lastFrameAt = null;
    let rafId = null;
    let timeoutId = null;
    let finished = false;
    let hiddenDetected = Boolean(globalThis.document?.hidden);

    const onVisibilityChange = () => {
      if (globalThis.document?.hidden) hiddenDetected = true;
    };

    globalThis.document?.addEventListener?.(
      "visibilitychange",
      onVisibilityChange,
    );

    const cleanup = () => {
      if (rafId !== null && typeof caf === "function") caf(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      globalThis.document?.removeEventListener?.(
        "visibilitychange",
        onVisibilityChange,
      );
    };

    const finish = (reason) => {
      if (finished) return;

      finished = true;
      cleanup();

      if (frameTimes.length < 5) {
        resolve({
          avgFps: null,
          source: null,
          reason: reason ?? "not-enough-frames",
          sampleCount: frameTimes.length,
          samples: null,
          hiddenDetected,
        });
        return;
      }

      const avgFrameMs = average(frameTimes);
      const p95FrameMs = percentile(frameTimes, 95);
      const p99FrameMs = percentile(frameTimes, 99);
      const avgFpsFromFrames = 1000 / avgFrameMs;
      const low1Fps = 1000 / p99FrameMs;

      const stutterFrames = frameTimes.filter(
        (ms) => ms >= STUTTER_FRAME_MS,
      ).length;
      const longFrames = frameTimes.filter((ms) => ms >= LONG_FRAME_MS).length;
      const stutterPct = (stutterFrames / frameTimes.length) * 100;

      const nativeAvg = nativeSamples.length ? average(nativeSamples) : null;

      const useNative =
        nativeAvg !== null &&
        Number.isFinite(nativeAvg) &&
        nativeAvg > 0 &&
        Math.abs(nativeAvg - avgFpsFromFrames) <=
          Math.max(12, avgFpsFromFrames * 0.25);

      const samples = buildGraphSamples(frameTimes);

      resolve({
        avgFps: useNative ? nativeAvg : avgFpsFromFrames,
        source: useNative ? "canvas.fps.render" : "raf-frametime",
        avgFrameMs,
        p95FrameMs,
        p99FrameMs,
        low1Fps,
        stutterPct,
        longFrames,
        sampleCount: frameTimes.length,
        samples,
        hiddenDetected,
      });
    };

    const tick = (now) => {
      if (!globalThis.canvas?.ready) {
        finish("canvas-lost-during-benchmark");
        return;
      }

      const native = globalThis.canvas?.fps?.render;
      if (typeof native === "number" && native > 0) nativeSamples.push(native);

      if (lastFrameAt !== null) {
        const delta = now - lastFrameAt;
        if (delta > 0 && delta < 1000) frameTimes.push(delta);
      }

      lastFrameAt = now;

      if (now - startedAt >= durationMs) finish();
      else rafId = raf(tick);
    };

    rafId = raf(tick);
    timeoutId = setTimeout(() => finish("timeout"), durationMs + 2000);
  });
}

// ─── Samples para gráficos ──────────────────────────────────────

function buildGraphSamples(frameTimes) {
  const frameMs = frameTimes.map((ms) => round(ms, 2));
  const fps = frameTimes.map((ms) => round(1000 / ms, 1));
  const quality = frameTimes.map((ms) => {
    if (ms >= LONG_FRAME_MS) return 2;
    if (ms >= STUTTER_FRAME_MS) return 1;
    return 0;
  });

  return {
    fps: downsample(fps, MAX_GRAPH_SAMPLES),
    frameMs: downsample(frameMs, MAX_GRAPH_SAMPLES),
    quality: downsample(quality, MAX_GRAPH_SAMPLES),
    thresholds: {
      stutterFrameMs: STUTTER_FRAME_MS,
      longFrameMs: LONG_FRAME_MS,
    },
  };
}

function downsample(values, maxPoints) {
  if (!Array.isArray(values) || values.length <= maxPoints) return values;

  const result = [];
  const bucketSize = values.length / maxPoints;

  for (let i = 0; i < maxPoints; i += 1) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(values.length, Math.floor((i + 1) * bucketSize));
    const bucket = values.slice(start, Math.max(start + 1, end));

    if (
      typeof bucket[0] === "number" &&
      bucket.every(
        (value) => value <= 2 && value >= 0 && Number.isInteger(value),
      )
    ) {
      result.push(Math.max(...bucket));
    } else {
      result.push(round(average(bucket), 2));
    }
  }

  return result;
}

// ─── Cena ───────────────────────────────────────────────────────

function getSceneWeight() {
  const scene = globalThis.canvas?.scene;

  if (!scene) {
    return {
      available: false,
      tokens: 0,
      lights: 0,
      walls: 0,
      tiles: 0,
      drawings: 0,
      sounds: 0,
      width: 0,
      height: 0,
      gridSize: 0,
      score: 0,
      warnings: ["Nenhuma cena ativa detectada."],
    };
  }

  const tokens = collectionSize(scene.tokens);
  const lights = collectionSize(scene.lights);
  const walls = collectionSize(scene.walls);
  const tiles = collectionSize(scene.tiles);
  const drawings = collectionSize(scene.drawings);
  const sounds = collectionSize(scene.sounds);

  const width = Number(scene.width ?? scene.dimensions?.sceneWidth ?? 0);
  const height = Number(scene.height ?? scene.dimensions?.sceneHeight ?? 0);
  const gridSize = Number(scene.grid?.size ?? scene.gridSize ?? 0);

  const score =
    Math.min(30, tokens * 1.2) +
    Math.min(32, lights * 3.2) +
    Math.min(28, walls / 18) +
    Math.min(24, tiles * 2.4) +
    Math.min(12, drawings * 0.6) +
    Math.min(10, sounds * 1.5) +
    Math.min(14, (width * height) / 12_000_000);

  const warnings = [];

  if (tokens >= 25)
    warnings.push(
      "Cena com muitos tokens; isso pode afetar visão e interação.",
    );
  if (lights >= 10)
    warnings.push(
      "Cena com muitas luzes; iluminação dinâmica pode pesar na GPU.",
    );
  if (walls >= 300)
    warnings.push(
      "Cena com muitas paredes; percepção/visão pode gerar stutter.",
    );
  if (tiles >= 10)
    warnings.push(
      "Cena com muitos tiles; texturas grandes podem consumir VRAM.",
    );

  return {
    available: true,
    tokens,
    lights,
    walls,
    tiles,
    drawings,
    sounds,
    width,
    height,
    gridSize,
    score: Math.round(score),
    warnings,
  };
}

function collectionSize(collection) {
  if (!collection) return 0;
  if (typeof collection.size === "number") return collection.size;
  if (Array.isArray(collection)) return collection.length;
  if (Array.isArray(collection.contents)) return collection.contents.length;
  if (typeof collection.length === "number") return collection.length;
  return 0;
}

// ─── Score / Recomendação ───────────────────────────────────────

function calculateScore({
  avgFps,
  low1Fps,
  p95FrameMs,
  stutterPct,
  gpuInfo,
  glParams,
  sceneWeight,
  reliable,
}) {
  if (!reliable) return null;

  let score = 0;

  score += clamp((avgFps / 60) * 35, 0, 35);
  score += clamp((low1Fps / 45) * 25, 0, 25);
  score += clamp(25 - Math.max(0, p95FrameMs - 16.7), 0, 25);
  score += clamp(15 - stutterPct, 0, 15);

  const maxTex = Number(glParams?.maxTextureSize ?? 0);
  if (maxTex >= 16384) score += 8;
  else if (maxTex >= 8192) score += 5;
  else if (maxTex >= 4096) score += 2;

  if (gpuInfo?.softwareRenderer) score -= 25;

  score -= clamp((sceneWeight?.score ?? 0) / 10, 0, 14);

  return Math.round(clamp(score, 0, 100));
}

function scoreToTier(score) {
  if (score === null) return null;
  if (score < 40) return 0;
  if (score < 70) return 1;
  return 2;
}

function buildRecommendation({
  tier,
  score,
  reliable,
  measured,
  sceneWeight,
  gpuInfo,
  reliabilityWarnings,
}) {
  if (!reliable || tier === null) {
    return {
      tier: null,
      labelKey: null,
      confidence: "low",
      reasons: [
        "Benchmark não confiável; rode novamente com a aba ativa e a cena carregada.",
        ...reliabilityWarnings,
      ],
    };
  }

  const reasons = [];

  if (measured.avgFps < 30) {
    reasons.push("FPS médio abaixo de 30 indica risco real de travamento.");
  } else if (measured.avgFps < 50) {
    reasons.push("FPS médio aceitável, mas ainda abaixo de 60.");
  } else {
    reasons.push("FPS médio estável para uso normal.");
  }

  if (measured.p95FrameMs >= 50) {
    reasons.push("p95 frametime acima de 50ms indica travadas perceptíveis.");
  } else if (measured.p95FrameMs >= 33.34) {
    reasons.push(
      "p95 frametime acima de 33ms indica stutter em cenas pesadas.",
    );
  }

  if (measured.stutterPct >= 10) {
    reasons.push("Percentual alto de stutter detectado.");
  }

  if (sceneWeight.score >= 65) {
    reasons.push(
      "Cena pesada detectada; luzes, paredes, tiles ou tokens podem ser o gargalo.",
    );
  }

  if (gpuInfo.softwareRenderer) {
    reasons.push(
      "Renderer de software detectado; aceleração por hardware pode estar desativada.",
    );
  }

  return {
    tier,
    score,
    labelKey: tierToLabelKey(tier),
    confidence: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
    reasons,
  };
}

function tierToLabelKey(tier) {
  if (tier === 0) return "BATATAOU_NAO.Quality.Low";
  if (tier === 1) return "BATATAOU_NAO.Quality.Medium";
  if (tier === 2) return "BATATAOU_NAO.Quality.High";
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────

function unavailableResult({
  timestamp,
  foundryVersion,
  gpuInfo,
  glParams,
  sceneWeight,
  reason,
  reliabilityWarnings = [],
  notes = [],
}) {
  return {
    timestamp,
    foundryVersion,

    gpu: gpuInfo.renderer,
    renderer: gpuInfo.vendor,
    gpuInfo,
    glParams,

    fps: null,
    fpsAvailable: false,
    fpsSource: null,

    score: null,
    scoreAvailable: false,
    tier: null,

    reliable: false,
    reliabilityWarnings,
    reason,

    avgFrameMs: null,
    p95FrameMs: null,
    p99FrameMs: null,
    low1Fps: null,
    stutterPct: null,
    longFrames: 0,
    sampleCount: 0,
    samples: null,

    baseline: null,
    sceneWeight,
    scene: sceneWeight,

    notes,
    recommendation: {
      tier: null,
      score: null,
      labelKey: null,
      confidence: "low",
      reasons: notes,
    },
    recommendationReasons: notes,
  };
}

function unknownGpu() {
  return {
    vendor: "Unknown",
    renderer: "Unknown",
    version: "Unknown",
    softwareRenderer: false,
  };
}

function isSoftwareRenderer(renderer = "") {
  return /(swiftshader|llvmpipe|software|mesa|soft)/i.test(String(renderer));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );

  return sorted[index];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
