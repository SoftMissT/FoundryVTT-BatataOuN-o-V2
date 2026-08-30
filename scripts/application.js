/**
 * ApplicationV2 — Diálogo Batata Ou Não.
 *
 * v1.0.12 runtime hotfix:
 * - Protocolos com imagens visíveis no topo da HUD.
 * - Fallback visual para imagem quebrada.
 * - Monitor FPS iniciado ao abrir a HUD, sem auto-ajuste.
 * - Gráfico FPS principal atualizado ao vivo.
 * - Frame médio e stutter marcados como snapshot.
 * - Journal/Markdown/JSON delegados para journal.js.
 *
 * @module application
 */

import { getCurrentQuality, applyQuality, QUALITY_LABELS } from "./quality.js";
import { getSetting, setSetting, SETTING_KEYS } from "./settings.js";
import { runBenchmark, detectGPU } from "./benchmark.js";
import {
  getGranularState,
  toggleGranularFeature,
  setGranularFeature,
  resetGranular,
} from "./granular.js";
import { startMonitor, getMonitorState, getFpsHistory } from "./monitor.js";
import {
  createBenchmarkJournalReport,
  exportBenchmarkMarkdown,
  exportBenchmarkJson,
} from "./journal.js";

const MODULE_ID = "batata-ou-nao";

function assetPath(path) {
  return `modules/${MODULE_ID}/${String(path).replace(/^\/+/, "")}`;
}

function t(key, fallback) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

function notify(type, key, fallback) {
  try {
    globalThis.ui?.notifications?.[type]?.(t(key, fallback));
  } catch {
    // UI indisponível; não quebra o fluxo.
  }
}

function refitSoon(app) {
  try {
    requestAnimationFrame(() => app?._refit?.());
  } catch {
    // requestAnimationFrame indisponível; sem ação.
  }
}

function qualityLabel(level) {
  if (level === null || level === undefined) return null;

  const key = QUALITY_LABELS[level];
  if (!key) return null;

  return t(key, key);
}

function escapeSvg(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createSparklineSvg(values, { label, color, invert = false }) {
  const numbers = values.map(finiteNumber).filter((value) => value !== null);

  if (numbers.length < 2) {
    return `
      <svg class="batata-sparkline-svg is-empty" viewBox="0 0 320 96" role="img" aria-label="${escapeSvg(label)}">
        <rect class="batata-sparkline-bg" x="0" y="0" width="320" height="96" rx="12"></rect>
        <text class="batata-sparkline-empty" x="160" y="52" text-anchor="middle">${escapeSvg(
          t("BATATAOU_NAO.HUD.NoGraphData", "Sem dados suficientes"),
        )}</text>
      </svg>
    `;
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const range = max - min || 1;

  const width = 320;
  const height = 96;
  const padX = 12;
  const padY = 14;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = numbers
    .map((value, index) => {
      const x =
        padX +
        (numbers.length === 1 ? 0 : (index / (numbers.length - 1)) * innerW);

      const normalized = (value - min) / range;

      const y = invert
        ? padY + normalized * innerH
        : padY + (1 - normalized) * innerH;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const current = numbers[numbers.length - 1];
  const avg = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;

  return `
    <svg class="batata-sparkline-svg" viewBox="0 0 320 96" role="img" aria-label="${escapeSvg(label)}">
      <rect class="batata-sparkline-bg" x="0" y="0" width="320" height="96" rx="12"></rect>
      <path class="batata-sparkline-grid" d="M12 24H308 M12 48H308 M12 72H308 M80 10V86 M160 10V86 M240 10V86"></path>
      <polyline
        class="batata-sparkline-line"
        points="${points}"
        fill="none"
        stroke="${escapeSvg(color)}"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></polyline>
      <text class="batata-sparkline-label" x="14" y="18">${escapeSvg(label)}</text>
      <text class="batata-sparkline-value" x="306" y="18" text-anchor="end">${escapeSvg(
        Math.round(current * 100) / 100,
      )}</text>
      <text class="batata-sparkline-meta" x="306" y="88" text-anchor="end">avg ${escapeSvg(
        Math.round(avg * 100) / 100,
      )}</text>
    </svg>
  `;
}

function extractBenchmarkSamples(benchmark) {
  if (!benchmark) return { fps: [], frameMs: [], quality: [] };

  const samples = benchmark.samples ?? benchmark.chart ?? {};

  const fps = samples.fps ?? samples.fpsSamples ?? benchmark.fpsSamples ?? [];

  const frameMs =
    samples.frameMs ??
    samples.frameSamples ??
    samples.frameMsSamples ??
    benchmark.frameMsSamples ??
    [];

  const quality =
    samples.quality ??
    samples.qualitySamples ??
    samples.stutter ??
    samples.stutterSamples ??
    benchmark.qualitySamples ??
    [];

  return {
    fps: Array.isArray(fps) ? fps : [],
    frameMs: Array.isArray(frameMs) ? frameMs : [],
    quality: Array.isArray(quality) ? quality : [],
  };
}

function buildFrameMsHistoryFromFps(fpsValues) {
  return fpsValues
    .map((fpsValue) => {
      const fpsNumber = finiteNumber(fpsValue);
      if (!fpsNumber || fpsNumber <= 0) return null;
      return 1000 / fpsNumber;
    })
    .filter((value) => value !== null);
}

function buildStutterHistoryFromFrameMs(frameValues) {
  const numbers = frameValues.map(finiteNumber).filter((value) => value !== null);

  if (numbers.length < 2) return [];

  return numbers.map((_, index) => {
    const startIndex = Math.max(0, index - 29);
    const slice = numbers.slice(startIndex, index + 1);
    const longFrames = slice.filter((value) => value >= 33.34).length;

    return slice.length ? (longFrames / slice.length) * 100 : 0;
  });
}

function getLiveFpsValues() {
  let liveFps = [];

  try {
    liveFps = getFpsHistory();
  } catch {
    liveFps = [];
  }

  if (Array.isArray(liveFps) && liveFps.length >= 2) {
    return liveFps.map(finiteNumber).filter((value) => value !== null);
  }

  try {
    const state = getMonitorState();
    const current = finiteNumber(state?.currentFps);
    if (current !== null) return [current, current];
  } catch {
    // sem monitor
  }

  return [];
}

function buildLiveGraphs(benchmark = null) {
  const samples = extractBenchmarkSamples(benchmark);
  const liveFps = getLiveFpsValues();

  const fallbackFps = benchmark?.fpsAvailable
    ? [benchmark.fps, benchmark.fps]
    : [];

  const fallbackFrame = benchmark?.avgFrameMs
    ? [benchmark.avgFrameMs, benchmark.avgFrameMs]
    : [];

  const fallbackStutter =
    benchmark?.stutterPct !== undefined && benchmark?.stutterPct !== null
      ? [benchmark.stutterPct, benchmark.stutterPct]
      : [];

  const fpsValues = liveFps.length >= 2
    ? liveFps
    : samples.fps.length
      ? samples.fps
      : fallbackFps;

  const liveFrameValues = buildFrameMsHistoryFromFps(fpsValues);

  const frameValues = liveFrameValues.length >= 2
    ? liveFrameValues
    : samples.frameMs.length
      ? samples.frameMs
      : fallbackFrame;

  const liveStutterValues = buildStutterHistoryFromFrameMs(frameValues);

  const stutterValues = liveStutterValues.length >= 2
    ? liveStutterValues
    : samples.quality.length
      ? samples.quality
      : fallbackStutter;

  return {
    available:
      fpsValues.length >= 2 ||
      frameValues.length >= 2 ||
      stutterValues.length >= 2,

    fpsSvg: createSparklineSvg(fpsValues, {
      label: "FPS LIVE",
      color: "#A4FE23",
    }),

    frameSvg: createSparklineSvg(frameValues, {
      label: "FRAME MS LIVE",
      color: "#FF93FF",
      invert: true,
    }),

    qualitySvg: createSparklineSvg(stutterValues, {
      label: "STUTTER LIVE",
      color: "#0EF5FF",
      invert: true,
    }),
  };
}

function buildBenchmarkGraphs(benchmark) {
  return buildLiveGraphs(benchmark);
}

function buildMonitorGraphSvg(label = "FPS LIVE") {
  return createSparklineSvg(getLiveFpsValues(), {
    label,
    color: "#A4FE23",
  });
}

function buildLiveMetrics(monitorState = null) {
  const fpsValues = getLiveFpsValues();
  const frameValues = buildFrameMsHistoryFromFps(fpsValues);
  const stutterValues = buildStutterHistoryFromFrameMs(frameValues);

  const currentFps =
    finiteNumber(monitorState?.currentFps) ??
    fpsValues[fpsValues.length - 1] ??
    null;

  const avgFps =
    finiteNumber(monitorState?.avgFps) ??
    (fpsValues.length
      ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length
      : null);

  const currentFrameMs =
    frameValues[frameValues.length - 1] ??
    (currentFps ? 1000 / currentFps : null);

  const currentStutter =
    stutterValues[stutterValues.length - 1] ??
    0;

  return {
    currentFps,
    avgFps,
    currentFrameMs,
    currentStutter,
  };
}

export class PotatoDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: "batata-ou-nao-dialog",
    width: 1180,
    height: "auto",
    window: {
      contentClasses: ["standard-form"],
      icon: "fas fa-microchip",
      title: "BATATAOU_NAO.Dialog.Title",
    },
    tag: "form",
    form: {
      handler: PotatoDialog.#onFormSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "modules/batata-ou-nao/templates/dialog.hbs",
    },
  };

  #selectedLevel = getCurrentQuality();
  #benchmarkResult = getSetting(SETTING_KEYS.BENCHMARK_RESULT) || null;
  #benchmarkRunning = false;
  #benchmarkDone = Boolean(getSetting(SETTING_KEYS.BENCHMARK_RESULT));
  #overrideConfirmed = false;
  #tickHandler = null;
  #liveHudTimer = null;
  #lastApplySummary = null;
  #exportRunning = false;
  #journalRunning = false;

  async _prepareContext() {
    this.#ensureLiveMonitor();

    const gpu = detectGPU();
    const monitor = getMonitorState();
    const granular = this.#buildGranularContext();

    if (!this.#benchmarkResult) {
      this.#benchmarkResult = getSetting(SETTING_KEYS.BENCHMARK_RESULT) || null;
      this.#benchmarkDone = Boolean(this.#benchmarkResult);
    }

    const benchmark = this.#benchmarkResult
      ? {
          ...this.#benchmarkResult,
          recommendedLabel: qualityLabel(this.#benchmarkResult.tier),
          graphs: buildBenchmarkGraphs(this.#benchmarkResult),
        }
      : null;

    return {
      selectedLevel: this.#selectedLevel,
      protocols: this.#buildProtocolsContext(),
      gpu: gpu.renderer,
      benchmark,
      benchmarkRunning: this.#benchmarkRunning,
      benchmarkDone: this.#benchmarkDone,
      exportRunning: this.#exportRunning,
      journalRunning: this.#journalRunning,
      granular,
      monitorActive: monitor.active,
      monitorCurrentFps: monitor.currentFps,
      monitorAvgFps: monitor.avgFps,
      monitorGraphSvg: buildMonitorGraphSvg(),
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.#ensureLiveMonitor();

    refitSoon(this);

    this.#bindQualityCards();
    this.#bindBenchmarkButton();
    this.#bindJournalButtons();
    this.#bindGranularControls();
    this.#bindSubmitGate();
    this.#bindMonitorTick();
    this.#startLiveHudLoop();
    this.#bindProtocolImageFallbacks();

    try {
      game.settings.sheet?.close();
    } catch {
      // Settings sheet pode não existir.
    }
  }

  async _onClose(options) {
    if (this.#tickHandler) {
      Hooks.off("BatataOuNaoMonitorTick", this.#tickHandler);
      this.#tickHandler = null;
    }

    this.#stopLiveHudLoop();

    if (!getSetting(SETTING_KEYS.HAS_BEEN_PROMPTED)) {
      await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);
    }

    await super._onClose(options);
  }

  #ensureLiveMonitor() {
    try {
      if (!globalThis.canvas?.ready) return;

      const monitor = getMonitorState();
      if (monitor.active) return;

      startMonitor({
        autoAdjust: false,
        sampleSize: 120,
      });
    } catch (err) {
      console.warn("BatataOuNao | Não foi possível iniciar monitor vivo:", err);
    }
  }

  #startLiveHudLoop() {
    this.#stopLiveHudLoop();

    this.#liveHudTimer = globalThis.setInterval(() => {
      try {
        this.#ensureLiveMonitor();
        this.#updateMonitorDom(getMonitorState());
      } catch (err) {
        console.warn("BatataOuNao | Falha no loop vivo da HUD:", err);
      }
    }, 500);
  }

  #stopLiveHudLoop() {
    if (!this.#liveHudTimer) return;

    globalThis.clearInterval(this.#liveHudTimer);
    this.#liveHudTimer = null;
  }

  #bindQualityCards() {
    this.element.querySelectorAll(".batata-card").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        this.#selectQualityCard(el);
      });

      el.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        this.#selectQualityCard(el);
      });
    });
  }

  #selectQualityCard(el) {
    this.element.querySelectorAll(".batata-card").forEach((card) => {
      card.removeAttribute("active");
      card.classList.remove("active");
      card.setAttribute("aria-checked", "false");
      card.setAttribute("tabindex", "-1");
    });

    el.setAttribute("active", "true");
    el.classList.add("active");
    el.setAttribute("aria-checked", "true");
    el.setAttribute("tabindex", "0");

    this.#selectedLevel = Number(el.dataset.level);
    this.#overrideConfirmed = false;
  }

  #bindBenchmarkButton() {
    const benchBtn = this.element.querySelector("#batata-benchmark-btn");
    if (!benchBtn) return;

    benchBtn.disabled = this.#benchmarkRunning;

    benchBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (this.#benchmarkRunning) return;
      await this.#runBenchmark();
    });
  }

  #bindJournalButtons() {
    const journalBtn = this.element.querySelector("#batata-journal-btn");
    if (journalBtn) {
      journalBtn.disabled =
        !this.#benchmarkDone || !this.#benchmarkResult || this.#journalRunning;

      journalBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        await this.#generateJournal();
      });
    }

    const exportMdBtn = this.element.querySelector("#batata-export-md-btn");
    if (exportMdBtn) {
      exportMdBtn.disabled =
        !this.#benchmarkDone || !this.#benchmarkResult || this.#exportRunning;

      exportMdBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        await this.#exportMarkdown();
      });
    }

    const exportJsonBtn = this.element.querySelector("#batata-export-json-btn");
    if (exportJsonBtn) {
      exportJsonBtn.disabled =
        !this.#benchmarkDone || !this.#benchmarkResult || this.#exportRunning;

      exportJsonBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        await this.#exportJson();
      });
    }
  }

  #bindGranularControls() {
    this.element.querySelectorAll("[data-feature]").forEach((el) => {
      el.addEventListener("change", (event) => {
        event.preventDefault();

        const id = el.dataset.feature;
        if (!id) return;

        if (el.type === "checkbox") {
          toggleGranularFeature(id);
        } else if (el.tagName === "SELECT") {
          setGranularFeature(id, Number(el.value));
        }

        refitSoon(this);
      });
    });

    const resetGranularBtn = this.element.querySelector(
      "[data-action='reset-granular']",
    );

    if (resetGranularBtn) {
      resetGranularBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        await resetGranular(this.#selectedLevel);
        this.render();
      });
    }
  }

  #bindSubmitGate() {
    const submitBtn = this.element.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    submitBtn.disabled = !this.#benchmarkDone || this.#benchmarkRunning;

    submitBtn.addEventListener("click", async (event) => {
      if (this.#overrideConfirmed || !this.#needsOverrideConfirm()) return;

      event.preventDefault();
      event.stopPropagation();

      const ok = await this.#confirmOverride();
      if (!ok) return;

      this.#overrideConfirmed = true;
      submitBtn.click();
    });
  }

  #bindMonitorTick() {
    if (this.#tickHandler) {
      Hooks.off("BatataOuNaoMonitorTick", this.#tickHandler);
      this.#tickHandler = null;
    }

    this.#tickHandler = (monitorState) => this.#updateMonitorDom(monitorState);
    Hooks.on("BatataOuNaoMonitorTick", this.#tickHandler);
  }

  #bindProtocolImageFallbacks() {
    this.element
      .querySelectorAll("[data-batata-protocol-image]")
      .forEach((img) => {
        const box = img.closest(".batata-card-img");
        if (!box) return;

        const markMissing = () => {
          box.classList.add("is-missing-image");
          img.style.display = "none";
        };

        const markLoaded = () => {
          box.classList.remove("is-missing-image");
          img.style.display = "";
        };

        img.loading = "eager";
        img.decoding = "async";

        img.addEventListener("error", markMissing, { once: true });
        img.addEventListener("load", markLoaded, { once: true });

        if (img.complete) {
          if (img.naturalWidth > 0) markLoaded();
          else markMissing();
        }
      });
  }

  #updateMonitorDom(monitorState) {
    if (!this.element) return;

    const metrics = buildLiveMetrics(monitorState);
    const graphs = buildLiveGraphs(this.#benchmarkResult);

    const currentEl = this.element.querySelector("[data-monitor-current]");
    const avgEl = this.element.querySelector("[data-monitor-avg]");

    if (currentEl && metrics.currentFps !== null) {
      currentEl.textContent = String(Math.round(metrics.currentFps));
    }

    if (avgEl && metrics.avgFps !== null) {
      avgEl.textContent = String(Math.round(metrics.avgFps));
    }

    const liveCurrentFps = this.element.querySelector("[data-live-current-fps]");
    const liveAvgFps = this.element.querySelector("[data-live-avg-fps]");
    const liveFrameMs = this.element.querySelector("[data-live-frame-ms]");
    const liveAvgFrame = this.element.querySelector("[data-live-avg-frame]");
    const liveStutter = this.element.querySelector("[data-live-stutter]");

    if (liveCurrentFps && metrics.currentFps !== null) {
      liveCurrentFps.textContent = String(Math.round(metrics.currentFps));
    }

    if (liveAvgFps && metrics.avgFps !== null) {
      liveAvgFps.textContent = String(Math.round(metrics.avgFps));
    }

    if (liveFrameMs && metrics.currentFrameMs !== null) {
      liveFrameMs.textContent = String(Math.round(metrics.currentFrameMs * 100) / 100);
    }

    if (liveAvgFrame && metrics.currentFrameMs !== null) {
      liveAvgFrame.textContent = `${Math.round(metrics.currentFrameMs * 100) / 100}ms`;
    }

    if (liveStutter && metrics.currentStutter !== null) {
      liveStutter.textContent = `${Math.round(metrics.currentStutter * 100) / 100}%`;
    }

    const monitorGraph = this.element.querySelector("[data-monitor-fps-graph]");
    if (monitorGraph) {
      monitorGraph.innerHTML = graphs.fpsSvg;
    }

    const fpsGraph = this.element.querySelector("[data-live-fps-graph]");
    if (fpsGraph) {
      fpsGraph.innerHTML = graphs.fpsSvg;
    }

    const frameGraph = this.element.querySelector("[data-live-frame-graph]");
    if (frameGraph) {
      frameGraph.innerHTML = graphs.frameSvg;
    }

    const stutterGraph = this.element.querySelector("[data-live-stutter-graph]");
    if (stutterGraph) {
      stutterGraph.innerHTML = graphs.qualitySvg;
    }
  }

  async #runBenchmark() {
    if (this.#benchmarkRunning) return;

    if (!globalThis.canvas?.ready) {
      notify(
        "warn",
        "BATATAOU_NAO.Notify.CanvasNotReady",
        "Batata Ou Não | Canvas não está pronto. Abra uma cena antes de rodar o benchmark.",
      );
      return;
    }

    this.#ensureLiveMonitor();

    this.#benchmarkRunning = true;
    this.#benchmarkDone = false;
    this.#overrideConfirmed = false;

    notify(
      "info",
      "BATATAOU_NAO.Notify.BenchmarkStarted",
      "Batata Ou Não | Benchmark iniciado. Mantenha a cena aberta e esta aba ativa.",
    );

    this.render();
    refitSoon(this);

    try {
      this.#benchmarkResult = await runBenchmark(6000);
      this.#benchmarkDone = true;

      if (typeof this.#benchmarkResult?.tier === "number") {
        this.#selectedLevel = this.#benchmarkResult.tier;
      }

      try {
        await setSetting(SETTING_KEYS.BENCHMARK_RESULT, this.#benchmarkResult);
      } catch (err) {
        console.warn("BatataOuNao | Erro ao salvar benchmarkResult:", err);
      }

      if (this.#benchmarkResult?.reliable) {
        notify(
          "info",
          "BATATAOU_NAO.Notify.BenchmarkComplete",
          "Batata Ou Não | Benchmark concluído. Recomendação calculada.",
        );
      } else {
        notify(
          "warn",
          "BATATAOU_NAO.Notify.BenchmarkUnreliable",
          "Batata Ou Não | Benchmark não confiável. Rode novamente com a aba ativa e a cena carregada.",
        );
      }

      Hooks.call("BatataOuNaoBenchmarkComplete", this.#benchmarkResult);
    } catch (err) {
      console.error("BatataOuNao | Benchmark falhou:", err);

      notify(
        "error",
        "BATATAOU_NAO.Notify.BenchmarkFailed",
        "Batata Ou Não | Benchmark falhou. Veja o console para detalhes.",
      );

      this.#benchmarkDone = false;
    } finally {
      this.#benchmarkRunning = false;
      this.render();
      refitSoon(this);
    }
  }

  async #generateJournal() {
    if (this.#journalRunning) return;

    if (!this.#benchmarkResult) {
      notify(
        "warn",
        "BATATAOU_NAO.Notify.NoBenchmarkForJournal",
        "Batata Ou Não | Rode o benchmark antes de gerar o Journal.",
      );
      return;
    }

    this.#journalRunning = true;
    this.render();

    try {
      await createBenchmarkJournalReport(
        this.#benchmarkResult,
        this.#lastApplySummary,
      );

      notify(
        "info",
        "BATATAOU_NAO.Notify.JournalCreated",
        "Batata Ou Não | Journal de benchmark criado.",
      );
    } catch (err) {
      console.error("BatataOuNao | Falha ao gerar Journal:", err);

      notify(
        "error",
        "BATATAOU_NAO.Notify.JournalFailed",
        "Batata Ou Não | Falha ao gerar Journal. Veja o console.",
      );
    } finally {
      this.#journalRunning = false;
      this.render();
      refitSoon(this);
    }
  }

  async #exportMarkdown() {
    if (this.#exportRunning) return;

    if (!this.#benchmarkResult) {
      notify(
        "warn",
        "BATATAOU_NAO.Notify.NoBenchmarkForExport",
        "Batata Ou Não | Rode o benchmark antes de exportar.",
      );
      return;
    }

    this.#exportRunning = true;

    try {
      exportBenchmarkMarkdown(this.#benchmarkResult, this.#lastApplySummary);

      notify(
        "info",
        "BATATAOU_NAO.Notify.ExportMarkdownComplete",
        "Batata Ou Não | Markdown exportado.",
      );
    } catch (err) {
      console.error("BatataOuNao | Falha ao exportar Markdown:", err);

      notify(
        "error",
        "BATATAOU_NAO.Notify.ExportFailed",
        "Batata Ou Não | Falha ao exportar relatório.",
      );
    } finally {
      this.#exportRunning = false;
      refitSoon(this);
    }
  }

  async #exportJson() {
    if (this.#exportRunning) return;

    if (!this.#benchmarkResult) {
      notify(
        "warn",
        "BATATAOU_NAO.Notify.NoBenchmarkForExport",
        "Batata Ou Não | Rode o benchmark antes de exportar.",
      );
      return;
    }

    this.#exportRunning = true;

    try {
      exportBenchmarkJson(this.#benchmarkResult, this.#lastApplySummary);

      notify(
        "info",
        "BATATAOU_NAO.Notify.ExportJsonComplete",
        "Batata Ou Não | JSON exportado.",
      );
    } catch (err) {
      console.error("BatataOuNao | Falha ao exportar JSON:", err);

      notify(
        "error",
        "BATATAOU_NAO.Notify.ExportFailed",
        "Batata Ou Não | Falha ao exportar relatório.",
      );
    } finally {
      this.#exportRunning = false;
      refitSoon(this);
    }
  }

  #needsOverrideConfirm() {
    if (!this.#benchmarkDone || !this.#benchmarkResult) return false;

    const tier = this.#benchmarkResult.tier;

    if (tier === null || tier === undefined) {
      return true;
    }

    return Number(this.#selectedLevel) !== Number(tier);
  }

  async #confirmOverride() {
    const tier = this.#benchmarkResult?.tier;

    let messageKey = "BATATAOU_NAO.Dialog.OverrideNoFps";
    let fallback =
      "Não foi possível medir seu FPS. Escolha manualmente — se o jogo ficar pesado, volte aqui e rode o benchmark novamente.";

    if (typeof tier === "number") {
      if (this.#selectedLevel > tier) {
        messageKey = "BATATAOU_NAO.Dialog.OverrideAbove";
        fallback =
          "Você está escolhendo um nível ACIMA do recomendado para sua máquina. Isso pode causar FPS baixo, travamentos em cenas cheias e stuttering durante o combate.";
      } else if (this.#selectedLevel < tier) {
        messageKey = "BATATAOU_NAO.Dialog.OverrideBelow";
        fallback =
          "Você está escolhendo um nível ABAIXO do recomendado. Sua máquina aguenta mais: você perderá sombras, anti-aliasing e animações à toa.";
      }
    }

    const content = `
      <div class="batata-override-confirm">
        <p>${t(messageKey, fallback)}</p>
      </div>
    `;

    if (globalThis.foundry?.applications?.api?.DialogV2?.confirm) {
      return foundry.applications.api.DialogV2.confirm({
        window: {
          title: t(
            "BATATAOU_NAO.Dialog.OverrideTitle",
            "Confirmar escolha manual",
          ),
        },
        content,
        yes: {
          label: t("BATATAOU_NAO.Dialog.OverrideConfirm", "Confirmar"),
          icon: "fas fa-check",
        },
        no: {
          label: t("BATATAOU_NAO.Dialog.OverrideCancel", "Cancelar"),
          icon: "fas fa-xmark",
        },
      });
    }

    return globalThis.confirm?.(t(messageKey, fallback)) ?? false;
  }

  #buildProtocolsContext() {
    return [
      {
        level: 0,
        name: t("BATATAOU_NAO.Quality.Low", "Batata"),
        description: t(
          "BATATAOU_NAO.Quality.LowDescription",
          "Máxima performance. Reduz efeitos visuais pesados para máquinas mais fracas.",
        ),
        image: assetPath("assets/batata_fraco.webp"),
        imageAlt: t("BATATAOU_NAO.Quality.Low", "Batata"),
        fallbackIcon: "fas fa-seedling",
        active: Number(this.#selectedLevel) === 0,
      },
      {
        level: 1,
        name: t("BATATAOU_NAO.Quality.Medium", "Batata Boa"),
        description: t(
          "BATATAOU_NAO.Quality.MediumDescription",
          "Equilíbrio entre visual e desempenho.",
        ),
        image: assetPath("assets/batata_boa.webp"),
        imageAlt: t("BATATAOU_NAO.Quality.Medium", "Batata Boa"),
        fallbackIcon: "fas fa-shield-halved",
        active: Number(this.#selectedLevel) === 1,
      },
      {
        level: 2,
        name: t("BATATAOU_NAO.Quality.High", "Premium"),
        description: t(
          "BATATAOU_NAO.Quality.HighDescription",
          "Visual máximo para máquinas fortes.",
        ),
        image: assetPath("assets/batata_premium.webp"),
        imageAlt: t("BATATAOU_NAO.Quality.High", "Premium"),
        fallbackIcon: "fas fa-crown",
        active: Number(this.#selectedLevel) === 2,
      },
    ];
  }

  #buildGranularContext() {
    const state = getGranularState();

    return state.map((feature) => ({
      id: feature.id,
      name: game.i18n.localize(feature.name),
      enabled: feature.enabled,
      available: feature.available,
      impact: feature.impact,
      impactLabel: game.i18n.localize(`BATATAOU_NAO.Impact.${feature.impact}`),
      isSelect: feature.type === "select",
      currentValue: feature.currentValue,
      options: feature.options
        ? feature.options.map((option) => ({
            value: option.value,
            label: option.label,
            selected: feature.currentValue === option.value,
          }))
        : [],
    }));
  }

  static async #onFormSubmit(event, form, formData) {
    const active = form.querySelector(
      ".batata-card[active], .batata-card.active",
    );

    if (!active) return;

    const level = Number(active.dataset.level);
    const summary = await applyQuality(level);

    await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);

    if (summary.failed > 0) {
      notify(
        "error",
        "BATATAOU_NAO.Notify.PresetFailed",
        "Batata Ou Não | Alguns ajustes falharam. Ative debug logs e veja o console.",
      );
    } else if (summary.skipped > 0) {
      notify(
        "warn",
        "BATATAOU_NAO.Notify.PresetPartial",
        "Batata Ou Não | Preset parcialmente aplicado. Alguns ajustes não existem nesta versão do Foundry.",
      );
    } else {
      notify(
        "info",
        "BATATAOU_NAO.Notify.PresetApplied",
        "Batata Ou Não | Preset aplicado.",
      );
    }

    Hooks.call("BatataOuNaoQualityApplied", level, summary);
  }
}
