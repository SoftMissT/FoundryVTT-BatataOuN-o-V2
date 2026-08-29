/**
 * ApplicationV2 Diálogo integrado.
 * Monitor atualiza o DOM via BatataOuNaoMonitorTick (1x/s), sem rerender.
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
import { getMonitorState, getFpsHistory } from "./monitor.js";
import { createBenchmarkJournalReport } from "./journal.js";

/**
 * Localiza texto com fallback seguro.
 *
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function t(key, fallback) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Dispara notificação sem quebrar caso a UI não esteja pronta.
 *
 * @param {"info"|"warn"|"error"} type
 * @param {string} key
 * @param {string} fallback
 */
function notify(type, key, fallback) {
  try {
    globalThis.ui?.notifications?.[type]?.(t(key, fallback));
  } catch {
    // UI indisponível; não quebra o fluxo.
  }
}

/**
 * Refit seguro da janela ApplicationV2 depois de mudanças de conteúdo.
 *
 * @param {foundry.applications.api.ApplicationV2} app
 */
function refitSoon(app) {
  try {
    requestAnimationFrame(() => app?._refit?.());
  } catch {
    // requestAnimationFrame indisponível; sem ação.
  }
}

/**
 * Resolve label localizado de qualidade.
 *
 * @param {number|null|undefined} level
 * @returns {string|null}
 */

const GRAPH_WIDTH = 360;
const GRAPH_HEIGHT = 96;
const GRAPH_PADDING = 10;

const GRAPH_COLORS = {
  body: "#C1000C",
  mind: "#FF93FF",
  spirit: "#0EF5FF",
  gold: "#F8EB4D",
  lime: "#A4FE23",
};

/**
 * Monta SVGs seguros a partir das amostras numéricas do benchmark.
 * Não usa dados externos ou HTML fornecido pelo usuário.
 *
 * @param {Object|null} result
 * @returns {{fps: string|null, frameMs: string|null, quality: string|null}}
 */
function buildBenchmarkGraphs(result) {
  const samples = result?.samples ?? result?.baseline?.samples;

  return {
    fps: buildSparklineSvg(samples?.fps, {
      label: "FPS",
      color: GRAPH_COLORS.body,
      min: 0,
      preferredMax: 60,
      higherIsBetter: true,
    }),
    frameMs: buildSparklineSvg(samples?.frameMs, {
      label: "Frame Time",
      color: GRAPH_COLORS.mind,
      min: 0,
      preferredMax: 50,
      higherIsBetter: false,
      suffix: "ms",
    }),
    quality: buildFrameQualitySvg(samples?.quality, {
      label: "Frame Quality",
    }),
  };
}

/**
 * Sparkline SVG inline.
 *
 * @param {number[]|undefined|null} rawValues
 * @param {{
 *   label: string,
 *   color: string,
 *   min?: number,
 *   preferredMax?: number,
 *   higherIsBetter?: boolean,
 *   suffix?: string
 * }} options
 * @returns {string|null}
 */
function buildSparklineSvg(rawValues, options) {
  const values = sanitizeNumericSeries(rawValues);
  if (values.length < 2) return null;

  const min = Number.isFinite(options.min)
    ? options.min
    : Math.min(...values);

  const rawMax = Math.max(...values, options.preferredMax ?? -Infinity);
  const max = rawMax <= min ? min + 1 : rawMax;
  const width = GRAPH_WIDTH;
  const height = GRAPH_HEIGHT;
  const pad = GRAPH_PADDING;

  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(1, values.length - 1)) * (width - pad * 2);
    const ratio = (clamp(value, min, max) - min) / (max - min);
    const y = height - pad - ratio * (height - pad * 2);

    return `${round(x, 2)},${round(y, 2)}`;
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point}`)
    .join(" ");

  const last = values[values.length - 1];
  const avg = average(values);
  const peak = Math.max(...values);

  return `
    <svg class="batata-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.label)}">
      <rect class="batata-spark-bg" x="0" y="0" width="${width}" height="${height}" rx="10"></rect>
      <path class="batata-spark-grid" d="M ${pad} ${height * 0.25} H ${width - pad} M ${pad} ${height * 0.5} H ${width - pad} M ${pad} ${height * 0.75} H ${width - pad}"></path>
      <path class="batata-spark-area" d="${path} L ${width - pad},${height - pad} L ${pad},${height - pad} Z" style="fill: ${hexToRgba(options.color, 0.12)}"></path>
      <path class="batata-spark-line" d="${path}" style="stroke: ${options.color}"></path>
      <circle class="batata-spark-last" cx="${points[points.length - 1].split(",")[0]}" cy="${points[points.length - 1].split(",")[1]}" r="3.5" style="fill: ${options.color}"></circle>
      <text class="batata-spark-meta" x="${pad}" y="${height - 6}">avg ${round(avg, 1)}${options.suffix ?? ""}</text>
      <text class="batata-spark-meta batata-spark-meta-right" x="${width - pad}" y="${height - 6}">now ${round(last, 1)}${options.suffix ?? ""} · max ${round(peak, 1)}${options.suffix ?? ""}</text>
    </svg>
  `;
}

/**
 * Barras de qualidade dos frames:
 * 0 = estável, 1 = stutter, 2 = frame longo.
 *
 * @param {number[]|undefined|null} rawValues
 * @param {{label: string}} options
 * @returns {string|null}
 */
function buildFrameQualitySvg(rawValues, options) {
  const values = Array.isArray(rawValues)
    ? rawValues.filter((value) => Number.isFinite(value)).map((value) => clamp(Math.round(value), 0, 2))
    : [];

  if (values.length < 2) return null;

  const width = GRAPH_WIDTH;
  const height = GRAPH_HEIGHT;
  const pad = GRAPH_PADDING;
  const gap = 2;
  const barWidth = Math.max(2, (width - pad * 2 - gap * (values.length - 1)) / values.length);

  const rects = values
    .map((value, index) => {
      const x = pad + index * (barWidth + gap);
      const barHeight = value === 0 ? 28 : value === 1 ? 56 : 78;
      const y = height - pad - barHeight;
      const cls = value === 0 ? "is-good" : value === 1 ? "is-warn" : "is-bad";

      return `<rect class="batata-frame-bar ${cls}" x="${round(x, 2)}" y="${round(y, 2)}" width="${round(barWidth, 2)}" height="${barHeight}" rx="2"></rect>`;
    })
    .join("");

  const stable = values.filter((value) => value === 0).length;
  const warn = values.filter((value) => value === 1).length;
  const bad = values.filter((value) => value === 2).length;

  return `
    <svg class="batata-frame-bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.label)}">
      <rect class="batata-spark-bg" x="0" y="0" width="${width}" height="${height}" rx="10"></rect>
      <path class="batata-spark-grid" d="M ${pad} ${height * 0.33} H ${width - pad} M ${pad} ${height * 0.66} H ${width - pad}"></path>
      ${rects}
      <text class="batata-spark-meta" x="${pad}" y="${height - 6}">stable ${stable}</text>
      <text class="batata-spark-meta batata-spark-meta-right" x="${width - pad}" y="${height - 6}">stutter ${warn} · long ${bad}</text>
    </svg>
  `;
}

function sanitizeNumericSeries(values) {
  return Array.isArray(values)
    ? values.filter((value) => Number.isFinite(value)).slice(-90)
    : [];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hexToRgba(hex, alpha) {
  const clean = String(hex).replace("#", "");
  const parsed = Number.parseInt(clean, 16);

  if (!Number.isFinite(parsed)) return `rgba(255, 255, 255, ${alpha})`;

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}


function qualityLabel(level) {
  if (level === null || level === undefined) return null;

  const key = QUALITY_LABELS[level];
  if (!key) return null;

  return t(key, key);
}

export class PotatoDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: "batata-ou-nao-dialog",
    width: 680,
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
  #journalCreating = false;
  #tickHandler = null;

  async _prepareContext() {
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

    const monitorGraph = buildSparklineSvg(getFpsHistory(), {
      label: "Live FPS",
      color: GRAPH_COLORS.spirit,
      min: 0,
      preferredMax: 60,
      higherIsBetter: true,
    });

    return {
      selectedLevel: this.#selectedLevel,
      gpu: gpu.renderer,
      benchmark,
      benchmarkRunning: this.#benchmarkRunning,
      benchmarkDone: this.#benchmarkDone,
      journalCreating: this.#journalCreating,
      granular,
      monitorActive: monitor.active,
      monitorCurrentFps: monitor.currentFps,
      monitorAvgFps: monitor.avgFps,
      monitorGraph,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    refitSoon(this);

    // Cards de nível
    this.element.querySelectorAll(".batata-card").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();

        this.element.querySelectorAll(".batata-card").forEach((card) => {
          card.removeAttribute("active");
          card.classList.remove("active");
        });

        el.setAttribute("active", "true");
        el.classList.add("active");

        this.#selectedLevel = Number(el.dataset.level);
        this.#overrideConfirmed = false;
      });
    });

    // Benchmark
    const benchBtn = this.element.querySelector("#batata-benchmark-btn");
    if (benchBtn) {
      benchBtn.disabled = this.#benchmarkRunning;

      benchBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.#benchmarkRunning) return;

        await this.#runBenchmark();
      });
    }

    // Journal report
    const journalBtn = this.element.querySelector("#batata-journal-btn");
    if (journalBtn) {
      journalBtn.disabled =
        !this.#benchmarkDone ||
        this.#benchmarkRunning ||
        this.#journalCreating ||
        !this.#benchmarkResult;

      journalBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.#journalCreating) return;

        await this.#createJournalReport();
      });
    }

    // Granular
    this.element.querySelectorAll("[data-feature]").forEach((el) => {
      el.addEventListener("change", (e) => {
        e.preventDefault();

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

    // Reset granular, se o template expuser botão para isso.
    const resetGranularBtn = this.element.querySelector(
      "[data-action='reset-granular']",
    );
    if (resetGranularBtn) {
      resetGranularBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        await resetGranular(this.#selectedLevel);
        this.render();
      });
    }

    // Monitor: atualiza DOM direto via hook (1x/s), sem rerender.
    // Remove handler anterior para evitar duplicação após rerenders.
    if (this.#tickHandler) {
      Hooks.off("BatataOuNaoMonitorTick", this.#tickHandler);
      this.#tickHandler = null;
    }

    this.#tickHandler = (monitorState) => this.#updateMonitorDom(monitorState);
    Hooks.on("BatataOuNaoMonitorTick", this.#tickHandler);

    // Gate: benchmark obrigatório antes de aplicar + confirmação de override.
    const submitBtn = this.element.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = !this.#benchmarkDone || this.#benchmarkRunning;

      submitBtn.addEventListener("click", async (e) => {
        if (this.#overrideConfirmed || !this.#needsOverrideConfirm()) return;

        e.preventDefault();
        e.stopPropagation();

        const ok = await this.#confirmOverride();
        if (!ok) return;

        this.#overrideConfirmed = true;
        submitBtn.click();
      });
    }

    game.settings.sheet?.close();
  }

  async _onClose(options) {
    if (this.#tickHandler) {
      Hooks.off("BatataOuNaoMonitorTick", this.#tickHandler);
      this.#tickHandler = null;
    }

    if (!getSetting(SETTING_KEYS.HAS_BEEN_PROMPTED)) {
      await setSetting(SETTING_KEYS.HAS_BEEN_PROMPTED, true);
    }

    await super._onClose(options);
  }

  /**
   * Atualiza os números do monitor direto no DOM barato, sem rerender.
   *
   * @param {{ currentFps: number, avgFps: number }} monitorState
   */
  #updateMonitorDom(monitorState) {
    if (!this.element) return;

    const currentEl = this.element.querySelector("[data-monitor-current]");
    const avgEl = this.element.querySelector("[data-monitor-avg]");
    const graphEl = this.element.querySelector("[data-monitor-graph]");

    if (currentEl) currentEl.textContent = String(monitorState.currentFps);
    if (avgEl) avgEl.textContent = String(monitorState.avgFps);
    if (graphEl) {
      graphEl.innerHTML =
        buildSparklineSvg(getFpsHistory(), {
          label: "Live FPS",
          color: GRAPH_COLORS.spirit,
          min: 0,
          preferredMax: 60,
          higherIsBetter: true,
        }) ?? "";
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

      try {
        await setSetting(SETTING_KEYS.BENCHMARK_RESULT, this.#benchmarkResult);
      } catch (err) {
        console.warn("BatataOuNao | Erro ao salvar benchmarkResult:", err);
      }

      if (
        this.#benchmarkResult.reliable &&
        this.#benchmarkResult.tier !== null
      ) {
        this.#selectedLevel = this.#benchmarkResult.tier;

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
    } finally {
      this.#benchmarkRunning = false;
      this.render();
      refitSoon(this);
    }
  }

  async #createJournalReport() {
    if (this.#journalCreating) return;

    if (!this.#benchmarkResult) {
      notify(
        "warn",
        "BATATAOU_NAO.Notify.JournalNoBenchmark",
        "Batata Ou Não | Rode um benchmark antes de gerar o Journal.",
      );
      return;
    }

    this.#journalCreating = true;
    this.render();
    refitSoon(this);

    try {
      const entry = await createBenchmarkJournalReport(this.#benchmarkResult);

      notify(
        "info",
        "BATATAOU_NAO.Notify.JournalCreated",
        "Batata Ou Não | Journal de benchmark criado.",
      );

      Hooks.call("BatataOuNaoJournalCreated", entry, this.#benchmarkResult);
    } catch (err) {
      console.error("BatataOuNao | Falha ao gerar Journal:", err);

      notify(
        "error",
        "BATATAOU_NAO.Notify.JournalFailed",
        "Batata Ou Não | Falha ao gerar Journal. Veja o console para detalhes.",
      );
    } finally {
      this.#journalCreating = false;
      this.render();
      refitSoon(this);
    }
  }

  /**
   * Verifica se a escolha atual exige confirmação de override.
   * Exige quando não há benchmark confiável, quando o FPS não pôde ser medido
   * ou quando o nível escolhido difere do tier recomendado.
   *
   * @returns {boolean}
   */
  #needsOverrideConfirm() {
    if (!this.#benchmarkDone || !this.#benchmarkResult) return false;

    if (!this.#benchmarkResult.reliable) return true;
    if (this.#benchmarkResult.tier === null) return true;

    return this.#selectedLevel !== this.#benchmarkResult.tier;
  }

  /**
   * Diálogo de confirmação para override do tier recomendado,
   * avisando os problemas possíveis de cada direção.
   *
   * @returns {Promise<boolean>}
   */
  async #confirmOverride() {
    const result = this.#benchmarkResult;

    let warnKey = "BATATAOU_NAO.Dialog.OverrideNoFps";

    if (result?.tier !== null && result?.tier !== undefined) {
      warnKey =
        this.#selectedLevel > result.tier
          ? "BATATAOU_NAO.Dialog.OverrideAbove"
          : "BATATAOU_NAO.Dialog.OverrideBelow";
    }

    const recommended =
      result?.tier !== null && result?.tier !== undefined
        ? qualityLabel(result.tier)
        : null;

    const content = `<p>${game.i18n.localize(warnKey)}</p>${
      recommended
        ? `<p><strong>${game.i18n.localize("BATATAOU_NAO.Dialog.Recommended")}: ${recommended}</strong></p>`
        : ""
    }`;

    return foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize("BATATAOU_NAO.Dialog.OverrideTitle"),
      },
      content,
      yes: {
        label: game.i18n.localize("BATATAOU_NAO.Dialog.OverrideConfirm"),
        icon: "fas fa-check",
      },
      no: {
        label: game.i18n.localize("BATATAOU_NAO.Dialog.OverrideCancel"),
        icon: "fas fa-xmark",
      },
    });
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
