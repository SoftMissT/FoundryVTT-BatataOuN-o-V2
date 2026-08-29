/**
 * Journal report generator Batata Ou Não.
 *
 * Responsabilidades:
 * - Criar um JournalEntry persistente a partir do resultado do benchmark.
 * - Gerar relatório Markdown limpo, sem tabelas vazias.
 * - Exportar relatório Markdown.
 * - Exportar payload técnico JSON.
 *
 * Não roda automaticamente: deve ser chamado por ação explícita do usuário.
 *
 * @module journal
 */

import { MODULE_ID } from "./main.js";

const REPORT_SCHEMA_VERSION = 2;

/**
 * Cria um relatório de benchmark no Journal do mundo.
 *
 * @param {Object} benchmark
 * @param {Object|null} [applySummary=null]
 * @returns {Promise<JournalEntry>}
 */
export async function createBenchmarkJournalReport(
  benchmark,
  applySummary = null,
) {
  assertBenchmark(benchmark);

  if (!globalThis.JournalEntry?.create) {
    throw new Error("BatataOuNao | JournalEntry API indisponível.");
  }

  const createdAt = new Date();
  const safeBenchmark = toPlainData(benchmark);
  const safeApplySummary = applySummary ? toPlainData(applySummary) : null;

  const entry = await JournalEntry.create({
    name: `${t(
      "BATATAOU_NAO.Journal.EntryName",
      "Batata Ou Não Benchmark",
    )} ${formatDate(createdAt)}`,
    flags: {
      [MODULE_ID]: {
        type: "benchmark-report",
        schemaVersion: REPORT_SCHEMA_VERSION,
        createdAt: createdAt.toISOString(),
        benchmark: safeBenchmark,
        applySummary: safeApplySummary,
      },
    },
  });

  const pages = buildPages(safeBenchmark, safeApplySummary, createdAt);
  await entry.createEmbeddedDocuments("JournalEntryPage", pages);

  try {
    entry.sheet?.render?.(true);
  } catch {
    // Abrir o Journal é conveniência; falha aqui não invalida o relatório.
  }

  try {
    Hooks.call("BatataOuNaoJournalCreated", entry, safeBenchmark);
  } catch {
    // Hooks externos não devem quebrar o fluxo do módulo.
  }

  return entry;
}

/**
 * Exporta o benchmark atual como arquivo Markdown.
 *
 * @param {Object} benchmark
 * @param {Object|null} [applySummary=null]
 * @returns {string} Conteúdo Markdown gerado.
 */
export function exportBenchmarkMarkdown(benchmark, applySummary = null) {
  assertBenchmark(benchmark);

  const createdAt = new Date();
  const safeBenchmark = toPlainData(benchmark);
  const safeApplySummary = applySummary ? toPlainData(applySummary) : null;
  const markdown = buildFullMarkdownReport(
    safeBenchmark,
    safeApplySummary,
    createdAt,
  );

  downloadTextFile(
    markdown,
    `batata-ou-nao-benchmark-${slugTimestamp(createdAt)}.md`,
    "text/markdown;charset=utf-8",
  );

  return markdown;
}

/**
 * Exporta o payload técnico do benchmark como JSON.
 *
 * @param {Object} benchmark
 * @param {Object|null} [applySummary=null]
 * @returns {Object} Payload serializado.
 */
export function exportBenchmarkJson(benchmark, applySummary = null) {
  assertBenchmark(benchmark);

  const createdAt = new Date();
  const payload = buildJsonPayload(
    toPlainData(benchmark),
    applySummary ? toPlainData(applySummary) : null,
    createdAt,
  );

  const json = JSON.stringify(payload, null, 2);

  downloadTextFile(
    json,
    `batata-ou-nao-benchmark-${slugTimestamp(createdAt)}.json`,
    "application/json;charset=utf-8",
  );

  return payload;
}

// ─── Pages ──────────────────────────────────────────────────────

function buildPages(benchmark, applySummary, createdAt) {
  return [
    textPage(
      t("BATATAOU_NAO.Journal.PageSummary", "Resumo Clínico"),
      buildSummaryMarkdown(benchmark, applySummary, createdAt),
    ),
    textPage(
      t("BATATAOU_NAO.Journal.PageVitals", "Sinais Vitais"),
      buildVitalsMarkdown(benchmark),
    ),
    textPage(
      t("BATATAOU_NAO.Journal.PageSceneRender", "Cena e Render"),
      buildSceneRenderMarkdown(benchmark),
    ),
    textPage(
      t("BATATAOU_NAO.Journal.PageTechnicalPayload", "Payload Técnico"),
      buildPayloadMarkdown(benchmark, applySummary, createdAt),
    ),
  ];
}

function textPage(name, content) {
  return {
    name,
    type: "text",
    text: {
      format: getMarkdownFormat(),
      content,
    },
  };
}

function getMarkdownFormat() {
  return globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.MARKDOWN ?? 1;
}

// ─── Markdown builders ──────────────────────────────────────────

function buildFullMarkdownReport(benchmark, applySummary, createdAt) {
  return [
    buildSummaryMarkdown(benchmark, applySummary, createdAt),
    "",
    buildVitalsMarkdown(benchmark),
    "",
    buildSceneRenderMarkdown(benchmark),
    "",
    buildPayloadMarkdown(benchmark, applySummary, createdAt),
  ].join("\n");
}

function buildSummaryMarkdown(benchmark, applySummary, createdAt) {
  const recommended = recommendedLabel(benchmark);
  const reliability = benchmark.reliable
    ? t("BATATAOU_NAO.Journal.Reliable", "Confiável")
    : t("BATATAOU_NAO.Journal.Unreliable", "Não confiável");

  const lines = [
    "# Batata Ou Não System Triage",
    "",
    `> ${t("BATATAOU_NAO.Journal.GeneratedAt", "Gerado em")}: ${safeInline(
      formatDate(createdAt),
    )}`,
    "",
    "## Resumo Clínico",
    "",
    `- **Score:** ${valueOrDash(benchmark.score)}${benchmark.scoreAvailable ? "/100" : ""}`,
    `- **Protocolo recomendado:** ${safeInline(recommended)}`,
    `- **Confiabilidade:** ${safeInline(reliability)}`,
    `- **FPS:** ${valueOrDash(benchmark.fps)}`,
    `- **Frame médio:** ${ms(benchmark.avgFrameMs)}`,
    `- **Stutter:** ${pct(benchmark.stutterPct)}`,
    `- **Peso da cena:** ${valueOrDash(benchmark.sceneWeight?.score)}`,
    `- **Foundry:** ${safeInline(benchmark.foundryVersion)}`,
    `- **Fonte da medição:** ${safeInline(
      benchmark.fpsSource ?? benchmark.baseline?.fpsSource,
    )}`,
    "",
  ];

  const reasons = arrayOfText(
    benchmark.recommendationReasons ?? benchmark.recommendation?.reasons,
  );

  if (reasons.length) {
    lines.push("## Diagnóstico", "");
    for (const reason of reasons) lines.push(`- ${safeInline(reason)}`);
    lines.push("");
  }

  const warnings = arrayOfText(benchmark.reliabilityWarnings);
  if (warnings.length) {
    lines.push("## Avisos de Confiabilidade", "");
    for (const warning of warnings) lines.push(`- ${safeInline(warning)}`);
    lines.push("");
  } else {
    lines.push("## Avisos de Confiabilidade", "");
    lines.push("- Nenhum aviso crítico detectado.");
    lines.push("");
  }

  const notes = arrayOfText(benchmark.notes);
  if (notes.length) {
    lines.push("## Notas Técnicas", "");
    for (const note of notes) lines.push(`- ${safeInline(note)}`);
    lines.push("");
  }

  if (applySummary) {
    lines.push("## Aplicação de Preset", "");
    lines.push(`- **Nível aplicado:** ${valueOrDash(applySummary.level)}`);
    lines.push(`- **Aplicados:** ${valueOrDash(applySummary.applied)}`);
    lines.push(`- **Ignorados:** ${valueOrDash(applySummary.skipped)}`);
    lines.push(`- **Falhas:** ${valueOrDash(applySummary.failed)}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function buildVitalsMarkdown(benchmark) {
  const baseline = benchmark.baseline ?? {};

  return [
    "# Sinais Vitais",
    "",
    "## Corpo",
    "",
    `- **FPS:** ${valueOrDash(benchmark.fps)}`,
    `- **FPS médio:** ${valueOrDash(baseline.avgFps ?? benchmark.fps)}`,
    `- **1% low:** ${fps(baseline.low1Fps ?? benchmark.low1Fps)}`,
    `- **Frames longos:** ${valueOrDash(
      baseline.longFrames ?? benchmark.longFrames,
    )}`,
    `- **Amostras:** ${valueOrDash(
      baseline.sampleCount ?? benchmark.sampleCount,
    )}`,
    "",
    "## Mente",
    "",
    `- **Frame médio:** ${ms(baseline.avgFrameMs ?? benchmark.avgFrameMs)}`,
    `- **p95:** ${ms(baseline.p95FrameMs ?? benchmark.p95FrameMs)}`,
    `- **p99:** ${ms(baseline.p99FrameMs ?? benchmark.p99FrameMs)}`,
    `- **Stutter:** ${pct(baseline.stutterPct ?? benchmark.stutterPct)}`,
    "",
    "## Espírito",
    "",
    `- **GPU:** ${safeInline(benchmark.gpuInfo?.renderer ?? benchmark.gpu)}`,
    `- **Vendor:** ${safeInline(
      benchmark.gpuInfo?.vendor ?? benchmark.renderer,
    )}`,
    `- **WebGL:** ${safeInline(benchmark.gpuInfo?.version)}`,
    `- **Renderer de software:** ${yesNo(benchmark.gpuInfo?.softwareRenderer)}`,
    `- **Fonte da medição:** ${safeInline(
      benchmark.fpsSource ?? baseline.fpsSource,
    )}`,
  ].join("\n");
}

function buildSceneRenderMarkdown(benchmark) {
  const scene = benchmark.sceneWeight ?? benchmark.scene ?? {};
  const gl = benchmark.glParams ?? {};

  const lines = [
    "# Cena e Render",
    "",
    "## Cena",
    "",
    `- **Disponível:** ${yesNo(scene.available)}`,
    `- **Score de peso:** ${valueOrDash(scene.score)}`,
    `- **Tokens:** ${valueOrDash(scene.tokens)}`,
    `- **Luzes:** ${valueOrDash(scene.lights)}`,
    `- **Paredes:** ${valueOrDash(scene.walls)}`,
    `- **Tiles:** ${valueOrDash(scene.tiles)}`,
    `- **Desenhos:** ${valueOrDash(scene.drawings)}`,
    `- **Sons:** ${valueOrDash(scene.sounds)}`,
    `- **Largura:** ${valueOrDash(scene.width)}`,
    `- **Altura:** ${valueOrDash(scene.height)}`,
    `- **Grid:** ${valueOrDash(scene.gridSize)}`,
    "",
    "## WebGL",
    "",
    `- **Max texture size:** ${valueOrDash(gl.maxTextureSize)}`,
    `- **Max renderbuffer size:** ${valueOrDash(gl.maxRenderbufferSize)}`,
    `- **Max viewport dims:** ${safeInline(
      Array.isArray(gl.maxViewportDims)
        ? gl.maxViewportDims.join(" × ")
        : gl.maxViewportDims,
    )}`,
    `- **Max vertex uniform vectors:** ${valueOrDash(
      gl.maxVertexUniformVectors,
    )}`,
    `- **Max fragment uniform vectors:** ${valueOrDash(
      gl.maxFragmentUniformVectors,
    )}`,
    `- **Max varying vectors:** ${valueOrDash(gl.maxVaryingVectors)}`,
  ];

  const sceneWarnings = arrayOfText(scene.warnings);
  if (sceneWarnings.length) {
    lines.push("", "## Alertas da Cena", "");
    for (const warning of sceneWarnings) lines.push(`- ${safeInline(warning)}`);
  }

  return lines.join("\n");
}

function buildPayloadMarkdown(benchmark, applySummary, createdAt) {
  const payload = buildJsonPayload(benchmark, applySummary, createdAt);

  return [
    "# Payload Técnico",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

function buildJsonPayload(benchmark, applySummary, createdAt) {
  return {
    module: MODULE_ID,
    type: "benchmark-report",
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: createdAt.toISOString(),
    world: {
      id: safePlain(globalThis.game?.world?.id),
      title: safePlain(globalThis.game?.world?.title),
      system: safePlain(globalThis.game?.system?.id),
    },
    user: {
      id: safePlain(globalThis.game?.user?.id),
      name: safePlain(globalThis.game?.user?.name),
    },
    benchmark,
    applySummary,
  };
}

// ─── Download ───────────────────────────────────────────────────

function downloadTextFile(content, filename, mimeType) {
  if (typeof Blob !== "function" || !globalThis.document?.createElement) {
    throw new Error("BatataOuNao | Download API indisponível neste ambiente.");
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    try {
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Best effort cleanup.
    }
  }, 0);
}

// ─── Formatting helpers ─────────────────────────────────────────

function assertBenchmark(benchmark) {
  if (!benchmark || typeof benchmark !== "object") {
    throw new Error("BatataOuNao | benchmark inválido para relatório.");
  }
}

function recommendedLabel(benchmark) {
  if (benchmark.recommendedLabel) return benchmark.recommendedLabel;

  const key =
    benchmark.recommendation?.labelKey ?? tierToLabelKey(benchmark.tier);
  if (key) return t(key, fallbackTierLabel(benchmark.tier));

  return fallbackTierLabel(benchmark.tier);
}

function tierToLabelKey(tier) {
  if (tier === 0) return "BATATAOU_NAO.Quality.Low";
  if (tier === 1) return "BATATAOU_NAO.Quality.Medium";
  if (tier === 2) return "BATATAOU_NAO.Quality.High";
  return null;
}

function fallbackTierLabel(tier) {
  if (tier === 0) return "Batata";
  if (tier === 1) return "Batata Boa";
  if (tier === 2) return "Premium";
  return "—";
}

function t(key, fallback) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(date) {
  try {
    const locale = globalThis.game?.i18n?.lang || undefined;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function slugTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && !Number.isFinite(value)) return "—";
  return safeInline(value);
}

function fps(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${roundMaybe(value)} FPS`;
}

function ms(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${roundMaybe(value)}ms`;
}

function pct(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${roundMaybe(value)}%`;
}

function roundMaybe(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return safeInline(value);
  return String(Math.round(number * 100) / 100);
}

function yesNo(value) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "—";
}

function arrayOfText(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeInline(item))
    .filter((item) => item && item !== "—");
}

function safeInline(value) {
  const text = safePlain(value);
  if (text === "—") return text;

  return text
    .replace(/\r?\n+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safePlain(value) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toPlainData(value) {
  try {
    if (globalThis.foundry?.utils?.deepClone) {
      return foundry.utils.deepClone(value);
    }
  } catch {
    // Fallback abaixo.
  }

  const seen = new WeakSet();

  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === "function") return undefined;

      if (nestedValue && typeof nestedValue === "object") {
        if (seen.has(nestedValue)) return "[Circular]";
        seen.add(nestedValue);
      }

      return nestedValue;
    }),
  );
}
