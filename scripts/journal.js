/**
 * Journal report generator — Batata Ou Não.
 *
 * Cria um prontuário persistente do benchmark como JournalEntry.
 * Não roda automaticamente: deve ser chamado por ação explícita do usuário.
 *
 * @module journal
 */

import { MODULE_ID } from "./main.js";

/**
 * Cria um relatório de benchmark no Journal do mundo.
 *
 * @param {Object} benchmark
 * @param {Object|null} [applySummary=null]
 * @returns {Promise<JournalEntry>}
 */
export async function createBenchmarkJournalReport(benchmark, applySummary = null) {
  if (!benchmark || typeof benchmark !== "object") {
    throw new Error("BatataOuNao | benchmark inválido para gerar Journal.");
  }

  if (!globalThis.JournalEntry?.create) {
    throw new Error("BatataOuNao | JournalEntry API indisponível.");
  }

  const createdAt = new Date();
  const safeBenchmark = toPlainData(benchmark);
  const safeApplySummary = applySummary ? toPlainData(applySummary) : null;

  const entry = await JournalEntry.create({
    name: `${l("BATATAOU_NAO.Journal.EntryName", "Batata Ou Não — Benchmark")} ${formatDate(createdAt)}`,
    flags: {
      [MODULE_ID]: {
        type: "benchmark-report",
        createdAt: createdAt.toISOString(),
        benchmark: safeBenchmark,
        applySummary: safeApplySummary,
      },
    },
  });

  const pages = buildPages(safeBenchmark, safeApplySummary, createdAt);
  await entry.createEmbeddedDocuments("JournalEntryPage", pages);

  try {
    entry.sheet?.render(true);
  } catch {
    // Render falhou, mas o journal foi criado.
  }

  return entry;
}

/**
 * Monta as páginas do JournalEntry.
 *
 * @param {Object} benchmark
 * @param {Object|null} applySummary
 * @param {Date} createdAt
 * @returns {Array<Object>}
 */
function buildPages(benchmark, applySummary, createdAt) {
  const htmlFormat = globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1;

  return [
    {
      name: l("BATATAOU_NAO.Journal.PageSummary", "Resumo Clínico"),
      type: "text",
      text: {
        format: htmlFormat,
        content: buildSummaryHtml(benchmark, applySummary, createdAt),
      },
    },
    {
      name: l("BATATAOU_NAO.Journal.PageMetrics", "Sinais Vitais"),
      type: "text",
      text: {
        format: htmlFormat,
        content: buildMetricsHtml(benchmark),
      },
    },
    {
      name: l("BATATAOU_NAO.Journal.PageScene", "Cena e Render"),
      type: "text",
      text: {
        format: htmlFormat,
        content: buildSceneHtml(benchmark),
      },
    },
    {
      name: l("BATATAOU_NAO.Journal.PageRaw", "Payload Técnico"),
      type: "text",
      text: {
        format: htmlFormat,
        content: buildRawHtml(benchmark, applySummary),
      },
    },
  ];
}

function buildSummaryHtml(benchmark, applySummary, createdAt) {
  const recommended = labelFromTier(benchmark.tier);
  const reliable = benchmark.reliable
    ? l("BATATAOU_NAO.Dialog.BenchmarkReliable", "Benchmark confiável")
    : l("BATATAOU_NAO.Dialog.BenchmarkUnreliable", "Benchmark não confiável");

  return `
<section class="batata-journal-report" style="${reportStyle()}">
  ${headerHtml(l("BATATAOU_NAO.Journal.ReportTitle", "Relatório de Benchmark"), createdAt)}

  <div style="${gridStyle()}">
    ${metricCard(l("BATATAOU_NAO.HUD.Score", "Score"), valueOrDash(benchmark.score) + "/100", "#F8EB4D")}
    ${metricCard("FPS", valueOrDash(benchmark.fps), "#C1000C")}
    ${metricCard(l("BATATAOU_NAO.Dialog.Recommended", "Recomendado"), recommended, "#A4FE23")}
    ${metricCard(l("BATATAOU_NAO.HUD.Signal", "Sinal"), reliable, benchmark.reliable ? "#A4FE23" : "#F8EB4D")}
  </div>

  <h2 style="${sectionTitleStyle("#F8EB4D")}">${h(l("BATATAOU_NAO.HUD.Diagnosis", "Diagnóstico"))}</h2>
  ${listHtml(benchmark.recommendationReasons, l("BATATAOU_NAO.HUD.NoDiagnosis", "Nenhum diagnóstico disponível."))}

  <h2 style="${sectionTitleStyle("#FF93FF")}">${h(l("BATATAOU_NAO.Dialog.ReliabilityWarnings", "Avisos de confiabilidade"))}</h2>
  ${listHtml(benchmark.reliabilityWarnings, l("BATATAOU_NAO.HUD.NoWarnings", "Nenhum aviso crítico detectado."))}

  ${applySummary ? buildApplySummaryHtml(applySummary) : ""}
</section>`;
}

function buildMetricsHtml(benchmark) {
  const baseline = benchmark.baseline ?? {};

  return `
<section class="batata-journal-report" style="${reportStyle()}">
  ${headerHtml(l("BATATAOU_NAO.Journal.PageMetrics", "Sinais Vitais"))}

  <h2 style="${sectionTitleStyle("#C1000C")}">${h(l("BATATAOU_NAO.HUD.Body", "Corpo"))}</h2>
  <table style="${tableStyle()}">
    ${row("FPS", benchmark.fps)}
    ${row(l("BATATAOU_NAO.Metric.AvgFps", "FPS médio"), baseline.avgFps)}
    ${row(l("BATATAOU_NAO.Metric.Low1Fps", "1% low"), baseline.low1Fps ? `${baseline.low1Fps} FPS` : null)}
    ${row(l("BATATAOU_NAO.Metric.LongFrames", "Frames longos"), baseline.longFrames)}
    ${row(l("BATATAOU_NAO.Metric.Samples", "Amostras"), baseline.sampleCount)}
  </table>

  <h2 style="${sectionTitleStyle("#FF93FF")}">${h(l("BATATAOU_NAO.HUD.Mind", "Mente"))}</h2>
  <table style="${tableStyle()}">
    ${row(l("BATATAOU_NAO.Metric.AvgFrame", "Frame médio"), baseline.avgFrameMs ? `${baseline.avgFrameMs}ms` : null)}
    ${row(l("BATATAOU_NAO.Metric.P95", "p95"), baseline.p95FrameMs ? `${baseline.p95FrameMs}ms` : null)}
    ${row(l("BATATAOU_NAO.Metric.P99", "p99"), baseline.p99FrameMs ? `${baseline.p99FrameMs}ms` : null)}
    ${row(l("BATATAOU_NAO.Metric.Stutter", "Stutter"), baseline.stutterPct !== undefined ? `${baseline.stutterPct}%` : null)}
  </table>
</section>`;
}

function buildSceneHtml(benchmark) {
  const scene = benchmark.sceneWeight ?? benchmark.scene ?? {};
  const gpu = benchmark.gpuInfo ?? {};

  return `
<section class="batata-journal-report" style="${reportStyle()}">
  ${headerHtml(l("BATATAOU_NAO.Journal.PageScene", "Cena e Render"))}

  <h2 style="${sectionTitleStyle("#0EF5FF")}">${h(l("BATATAOU_NAO.HUD.Spirit", "Espírito"))}</h2>
  <table style="${tableStyle()}">
    ${row(l("BATATAOU_NAO.HUD.Renderer", "Renderer"), gpu.renderer ?? benchmark.gpu)}
    ${row("Vendor", gpu.vendor ?? benchmark.renderer)}
    ${row("WebGL", gpu.version)}
    ${row(l("BATATAOU_NAO.Metric.MeasurementSource", "Fonte da medição"), benchmark.fpsSource ?? benchmark.baseline?.fpsSource)}
    ${row("Software Renderer", gpu.softwareRenderer ? "sim" : "não")}
  </table>

  <h2 style="${sectionTitleStyle("#F8EB4D")}">${h(l("BATATAOU_NAO.Dialog.SceneWeight", "Peso da cena"))}</h2>
  <table style="${tableStyle()}">
    ${row(l("BATATAOU_NAO.Dialog.SceneWeight", "Peso da cena"), scene.score)}
    ${row(l("BATATAOU_NAO.Scene.Tokens", "tokens"), scene.tokens)}
    ${row(l("BATATAOU_NAO.Scene.Lights", "luzes"), scene.lights)}
    ${row(l("BATATAOU_NAO.Scene.Walls", "paredes"), scene.walls)}
    ${row(l("BATATAOU_NAO.Scene.Tiles", "tiles"), scene.tiles)}
    ${row(l("BATATAOU_NAO.Scene.Drawings", "desenhos"), scene.drawings)}
    ${row(l("BATATAOU_NAO.Scene.Sounds", "sons"), scene.sounds)}
    ${row("Width", scene.width)}
    ${row("Height", scene.height)}
    ${row("Grid", scene.gridSize)}
  </table>

  <h2 style="${sectionTitleStyle("#C1000C")}">Warnings</h2>
  ${listHtml(scene.warnings, l("BATATAOU_NAO.HUD.NoWarnings", "Nenhum aviso crítico detectado."))}
</section>`;
}

function buildRawHtml(benchmark, applySummary) {
  const payload = JSON.stringify({ benchmark, applySummary }, null, 2);

  return `
<section class="batata-journal-report" style="${reportStyle()}">
  ${headerHtml(l("BATATAOU_NAO.Journal.PageRaw", "Payload Técnico"))}

  <p style="color:#c7afbe;margin:0 0 12px;">
    ${h(l("BATATAOU_NAO.Journal.RawHint", "Payload serializável para debug, issue ou comparação futura."))}
  </p>

  <pre style="white-space:pre-wrap;overflow:auto;background:#12010b;color:#f3e9ef;border:1px solid rgba(14,245,255,.24);border-radius:10px;padding:12px;font-size:12px;">${h(payload)}</pre>
</section>`;
}

function buildApplySummaryHtml(applySummary) {
  return `
<h2 style="${sectionTitleStyle("#A4FE23")}">${h(l("BATATAOU_NAO.Journal.ApplySummary", "Aplicação de preset"))}</h2>
<table style="${tableStyle()}">
  ${row("Applied", applySummary.applied)}
  ${row("Skipped", applySummary.skipped)}
  ${row("Failed", applySummary.failed)}
</table>`;
}

function headerHtml(title, createdAt = null) {
  const dateLine = createdAt
    ? `<p style="margin:4px 0 0;color:#c7afbe;">${h(formatDate(createdAt))}</p>`
    : "";

  return `
<header style="border-bottom:1px solid rgba(248,235,77,.24);padding-bottom:10px;margin-bottom:14px;">
  <div style="color:#0EF5FF;text-transform:uppercase;letter-spacing:.14em;font-size:12px;">Batata Ou Não // System Triage</div>
  <h1 style="margin:4px 0 0;color:#fff8de;">${h(title)}</h1>
  ${dateLine}
</header>`;
}

function metricCard(label, value, color) {
  return `
<div style="background:#12010b;border:1px solid ${color}55;border-radius:12px;padding:12px;">
  <div style="color:#c7afbe;text-transform:uppercase;letter-spacing:.1em;font-size:11px;">${h(label)}</div>
  <div style="color:${color};font-weight:900;font-size:24px;line-height:1.1;margin-top:6px;">${h(value)}</div>
</div>`;
}

function listHtml(items, empty) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p style="color:#A4FE23;">${h(empty)}</p>`;
  }

  return `<ul style="margin-top:0;">${items
    .map((item) => `<li style="margin-bottom:6px;">${h(item)}</li>`)
    .join("")}</ul>`;
}

function row(label, value) {
  return `<tr>
<td style="padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.08);color:#c7afbe;">${h(label)}</td>
<td style="padding:7px 9px;border-bottom:1px solid rgba(255,255,255,.08);color:#fff;text-align:right;">${h(valueOrDash(value))}</td>
</tr>`;
}

function labelFromTier(tier) {
  if (tier === 0) return l("BATATAOU_NAO.Quality.Low", "Batata");
  if (tier === 1) return l("BATATAOU_NAO.Quality.Medium", "Batata Boa");
  if (tier === 2) return l("BATATAOU_NAO.Quality.High", "Premium");
  return "--";
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

function reportStyle() {
  return "background:#1a0210;color:#f3e9ef;border:1px solid rgba(248,235,77,.22);border-radius:14px;padding:16px;";
}

function gridStyle() {
  return "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0 16px;";
}

function tableStyle() {
  return "width:100%;border-collapse:collapse;background:#12010b;border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;margin-bottom:16px;";
}

function sectionTitleStyle(color) {
  return `color:${color};margin:16px 0 8px;text-transform:uppercase;letter-spacing:.08em;`;
}

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function l(key, fallback) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(date) {
  try {
    return date.toLocaleString();
  } catch {
    return date.toISOString();
  }
}

function toPlainData(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}
