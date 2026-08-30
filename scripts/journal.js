/**
 * Benchmark Journal + exports.
 *
 * v1.0.12 runtime hotfix:
 * - Journal usa HTML real em vez de Markdown cru.
 * - Export Markdown/JSON usa saveDataToFile quando disponível.
 * - Payload do Journal é compacto para não poluir a página.
 *
 * @module journal
 */

const MODULE_ID = "batata-ou-nao";
const REPORT_SCHEMA_VERSION = 3;

function t(key, fallback) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

export async function createBenchmarkJournalReport(
  benchmark,
  applySummary = null,
) {
  assertBenchmark(benchmark);

  const createdAt = new Date();
  const title = `${t("BATATAOU_NAO.Journal.EntryName", "Batata Ou Não Benchmark")} ${formatDate(createdAt)}`;

  const entry = await JournalEntry.create({
    name: title,
    flags: {
      [MODULE_ID]: {
        type: "benchmark-report",
        schemaVersion: REPORT_SCHEMA_VERSION,
        createdAt: createdAt.toISOString(),
        benchmark: toPlainData(benchmark),
        applySummary: toPlainData(applySummary),
      },
    },
    pages: [
      makeTextPage(
        t("BATATAOU_NAO.Journal.PageSummary", "Resumo Clínico"),
        buildSummaryHtml(benchmark, applySummary, createdAt),
      ),
      makeTextPage(
        t("BATATAOU_NAO.Journal.PageSceneRender", "Cena e Render"),
        buildSceneRenderHtml(benchmark),
      ),
      makeTextPage(
        t("BATATAOU_NAO.Journal.PageVitals", "Sinais Vitais"),
        buildVitalsHtml(benchmark),
      ),
      makeTextPage(
        t("BATATAOU_NAO.Journal.PageTechnicalPayload", "Payload Técnico"),
        buildPayloadHtml(benchmark, applySummary, createdAt),
      ),
    ],
  });

  try {
    entry?.sheet?.render?.(true);
  } catch {
    // A criação do Journal já foi concluída; renderizar a sheet é opcional.
  }

  return entry;
}

export function exportBenchmarkMarkdown(benchmark, applySummary = null) {
  assertBenchmark(benchmark);

  const createdAt = new Date();
  const filename = `batata-benchmark-${slugTimestamp(createdAt)}.md`;
  const content = buildMarkdownReport(benchmark, applySummary, createdAt);

  downloadTextFile(content, filename, "text/markdown;charset=utf-8");
}

export function exportBenchmarkJson(benchmark, applySummary = null) {
  assertBenchmark(benchmark);

  const createdAt = new Date();
  const filename = `batata-benchmark-${slugTimestamp(createdAt)}.json`;

  const payload = {
    module: MODULE_ID,
    type: "benchmark-report",
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: createdAt.toISOString(),
    foundry: globalThis.game?.version ?? null,
    system: globalThis.game?.system?.id ?? null,
    user: {
      id: globalThis.game?.user?.id ?? null,
      name: globalThis.game?.user?.name ?? null,
    },
    benchmark: toPlainData(benchmark),
    applySummary: toPlainData(applySummary),
  };

  downloadTextFile(
    JSON.stringify(payload, null, 2),
    filename,
    "application/json;charset=utf-8",
  );
}

function makeTextPage(name, content) {
  return {
    name,
    type: "text",
    text: {
      format: getHtmlFormat(),
      content,
    },
  };
}

function getHtmlFormat() {
  const formats = globalThis.CONST?.JOURNAL_ENTRY_PAGE_FORMATS ?? {};
  return formats.HTML ?? formats.html ?? 1;
}

function buildSummaryHtml(benchmark, applySummary, createdAt) {
  const reasons = arrayOfText(
    benchmark.recommendationReasons ?? benchmark.recommendation?.reasons ?? [],
  );

  const warnings = arrayOfText(benchmark.reliabilityWarnings ?? []);

  return `
    <section class="batata-journal-report">
      <h1>${escapeHtml(t("BATATAOU_NAO.Journal.PageSummary", "Resumo Clínico"))}</h1>

      <p>
        <strong>${escapeHtml(t("BATATAOU_NAO.Journal.GeneratedAt", "Gerado em"))}:</strong>
        ${escapeHtml(formatDate(createdAt))}
      </p>

      <ul>
        <li><strong>Score:</strong> ${escapeHtml(valueOrDash(benchmark.score))}/100</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Dialog.Recommended", "Recomendado"))}:</strong> ${escapeHtml(recommendedLabel(benchmark))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.HUD.Confidence", "Confiança"))}:</strong> ${escapeHtml(valueOrDash(benchmark.recommendation?.confidence))}</li>
        <li><strong>FPS:</strong> ${escapeHtml(fps(benchmark.fps ?? benchmark.avgFps ?? benchmark.baseline?.avgFps))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.AvgFrame", "Frame médio"))}:</strong> ${escapeHtml(ms(benchmark.avgFrameMs ?? benchmark.baseline?.avgFrameMs))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.Stutter", "Stutter"))}:</strong> ${escapeHtml(pct(benchmark.stutterPct ?? benchmark.baseline?.stutterPct))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Dialog.SceneWeight", "Peso da cena"))}:</strong> ${escapeHtml(valueOrDash(benchmark.sceneWeight?.score))}</li>
        <li><strong>Foundry:</strong> ${escapeHtml(globalThis.game?.version ?? "—")}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.MeasurementSource", "Fonte da medição"))}:</strong> ${escapeHtml(valueOrDash(benchmark.fpsSource ?? benchmark.baseline?.fpsSource))}</li>
      </ul>

      <h2>${escapeHtml(t("BATATAOU_NAO.HUD.Diagnosis", "Diagnóstico"))}</h2>
      ${htmlListOrEmpty(reasons, t("BATATAOU_NAO.HUD.NoDiagnosis", "Nenhum diagnóstico disponível."))}

      <h2>${escapeHtml(t("BATATAOU_NAO.Dialog.ReliabilityWarnings", "Avisos de confiabilidade"))}</h2>
      ${htmlListOrEmpty(warnings, t("BATATAOU_NAO.HUD.NoWarnings", "Nenhum aviso crítico detectado."))}

      ${
        applySummary
          ? `
        <h2>${escapeHtml(t("BATATAOU_NAO.Journal.ApplySummary", "Aplicação de preset"))}</h2>
        <ul>
          <li><strong>Applied:</strong> ${escapeHtml(valueOrDash(applySummary.applied))}</li>
          <li><strong>Skipped:</strong> ${escapeHtml(valueOrDash(applySummary.skipped))}</li>
          <li><strong>Failed:</strong> ${escapeHtml(valueOrDash(applySummary.failed))}</li>
        </ul>
      `
          : ""
      }
    </section>
  `;
}

function buildSceneRenderHtml(benchmark) {
  const sceneWeight = benchmark.sceneWeight ?? {};
  const counts = sceneWeight.counts ?? benchmark.counts ?? {};
  const gpuInfo = benchmark.gpuInfo ?? benchmark.gpu ?? {};

  return `
    <section class="batata-journal-report">
      <h1>${escapeHtml(t("BATATAOU_NAO.Journal.PageSceneRender", "Cena e Render"))}</h1>

      <h2>${escapeHtml(t("BATATAOU_NAO.Dialog.SceneWeight", "Peso da cena"))}</h2>
      <ul>
        <li><strong>Score:</strong> ${escapeHtml(valueOrDash(sceneWeight.score))}</li>
        <li><strong>Tokens:</strong> ${escapeHtml(valueOrDash(counts.tokens))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Scene.Lights", "luzes"))}:</strong> ${escapeHtml(valueOrDash(counts.lights))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Scene.Walls", "paredes"))}:</strong> ${escapeHtml(valueOrDash(counts.walls))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Scene.Tiles", "tiles"))}:</strong> ${escapeHtml(valueOrDash(counts.tiles))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Scene.Drawings", "desenhos"))}:</strong> ${escapeHtml(valueOrDash(counts.drawings))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Scene.Sounds", "sons"))}:</strong> ${escapeHtml(valueOrDash(counts.sounds))}</li>
      </ul>

      <h2>GPU / Renderer</h2>
      <ul>
        <li><strong>Renderer:</strong> ${escapeHtml(valueOrDash(gpuInfo.renderer))}</li>
        <li><strong>Vendor:</strong> ${escapeHtml(valueOrDash(gpuInfo.vendor))}</li>
        <li><strong>WebGL:</strong> ${escapeHtml(valueOrDash(gpuInfo.version))}</li>
        <li><strong>Max texture size:</strong> ${escapeHtml(valueOrDash(gpuInfo.maxTextureSize))}</li>
      </ul>
    </section>
  `;
}

function buildVitalsHtml(benchmark) {
  const baseline = benchmark.baseline ?? benchmark;

  return `
    <section class="batata-journal-report">
      <h1>${escapeHtml(t("BATATAOU_NAO.Journal.PageVitals", "Sinais Vitais"))}</h1>

      <h2>${escapeHtml(t("BATATAOU_NAO.HUD.Body", "Corpo"))}</h2>
      <ul>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.AvgFps", "FPS médio"))}:</strong> ${escapeHtml(fps(baseline.avgFps ?? benchmark.fps))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.Low1Fps", "1% low"))}:</strong> ${escapeHtml(fps(baseline.low1Fps))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.LongFrames", "Frames longos"))}:</strong> ${escapeHtml(valueOrDash(baseline.longFrames))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.Samples", "Amostras"))}:</strong> ${escapeHtml(valueOrDash(baseline.sampleCount))}</li>
      </ul>

      <h2>${escapeHtml(t("BATATAOU_NAO.HUD.Mind", "Mente"))}</h2>
      <ul>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.AvgFrame", "Frame médio"))}:</strong> ${escapeHtml(ms(baseline.avgFrameMs))}</li>
        <li><strong>p95:</strong> ${escapeHtml(ms(baseline.p95FrameMs))}</li>
        <li><strong>p99:</strong> ${escapeHtml(ms(baseline.p99FrameMs))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.Stutter", "Stutter"))}:</strong> ${escapeHtml(pct(baseline.stutterPct))}</li>
      </ul>

      <h2>${escapeHtml(t("BATATAOU_NAO.HUD.Spirit", "Espírito"))}</h2>
      <ul>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Metric.MeasurementSource", "Fonte da medição"))}:</strong> ${escapeHtml(valueOrDash(baseline.fpsSource ?? benchmark.fpsSource))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.HUD.Confidence", "Confiança"))}:</strong> ${escapeHtml(valueOrDash(benchmark.recommendation?.confidence))}</li>
        <li><strong>${escapeHtml(t("BATATAOU_NAO.Journal.Reliable", "Confiável"))}:</strong> ${escapeHtml(yesNo(benchmark.reliable))}</li>
      </ul>
    </section>
  `;
}

function buildPayloadHtml(benchmark, applySummary, createdAt) {
  const payload = {
    module: MODULE_ID,
    type: "benchmark-report",
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: createdAt.toISOString(),
    foundry: globalThis.game?.version ?? null,
    system: globalThis.game?.system?.id ?? null,
    benchmark: compactBenchmarkPayload(benchmark),
    applySummary: toPlainData(applySummary),
  };

  return `
    <section class="batata-journal-report">
      <h1>${escapeHtml(t("BATATAOU_NAO.Journal.PageTechnicalPayload", "Payload Técnico"))}</h1>
      <p>${escapeHtml("Payload compacto para debug. O JSON completo deve ser exportado pelo botão Exportar JSON.")}</p>
      <pre style="white-space: pre-wrap; overflow-wrap: anywhere;">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </section>
  `;
}

function buildMarkdownReport(benchmark, applySummary, createdAt) {
  const baseline = benchmark.baseline ?? benchmark;
  const reasons = arrayOfText(
    benchmark.recommendationReasons ?? benchmark.recommendation?.reasons ?? [],
  );
  const warnings = arrayOfText(benchmark.reliabilityWarnings ?? []);

  const lines = [
    `# ${t("BATATAOU_NAO.Journal.EntryName", "Batata Ou Não Benchmark")}`,
    "",
    `- **${t("BATATAOU_NAO.Journal.GeneratedAt", "Gerado em")}:** ${formatDate(createdAt)}`,
    `- **Score:** ${valueOrDash(benchmark.score)}/100`,
    `- **${t("BATATAOU_NAO.Dialog.Recommended", "Recomendado")}:** ${recommendedLabel(benchmark)}`,
    `- **${t("BATATAOU_NAO.HUD.Confidence", "Confiança")}:** ${valueOrDash(benchmark.recommendation?.confidence)}`,
    `- **FPS:** ${fps(benchmark.fps ?? baseline.avgFps)}`,
    `- **${t("BATATAOU_NAO.Metric.AvgFrame", "Frame médio")}:** ${ms(benchmark.avgFrameMs ?? baseline.avgFrameMs)}`,
    `- **${t("BATATAOU_NAO.Metric.Stutter", "Stutter")}:** ${pct(benchmark.stutterPct ?? baseline.stutterPct)}`,
    "",
    `## ${t("BATATAOU_NAO.HUD.Diagnosis", "Diagnóstico")}`,
    "",
    ...markdownListOrEmpty(
      reasons,
      t("BATATAOU_NAO.HUD.NoDiagnosis", "Nenhum diagnóstico disponível."),
    ),
    "",
    `## ${t("BATATAOU_NAO.Dialog.ReliabilityWarnings", "Avisos de confiabilidade")}`,
    "",
    ...markdownListOrEmpty(
      warnings,
      t("BATATAOU_NAO.HUD.NoWarnings", "Nenhum aviso crítico detectado."),
    ),
    "",
    `## ${t("BATATAOU_NAO.Journal.PageVitals", "Sinais Vitais")}`,
    "",
    `- **${t("BATATAOU_NAO.Metric.AvgFps", "FPS médio")}:** ${fps(baseline.avgFps)}`,
    `- **${t("BATATAOU_NAO.Metric.Low1Fps", "1% low")}:** ${fps(baseline.low1Fps)}`,
    `- **${t("BATATAOU_NAO.Metric.LongFrames", "Frames longos")}:** ${valueOrDash(baseline.longFrames)}`,
    `- **${t("BATATAOU_NAO.Metric.Samples", "Amostras")}:** ${valueOrDash(baseline.sampleCount)}`,
    `- **p95:** ${ms(baseline.p95FrameMs)}`,
    `- **p99:** ${ms(baseline.p99FrameMs)}`,
    "",
    `## ${t("BATATAOU_NAO.Journal.PageSceneRender", "Cena e Render")}`,
    "",
    `- **${t("BATATAOU_NAO.Dialog.SceneWeight", "Peso da cena")}:** ${valueOrDash(benchmark.sceneWeight?.score)}`,
    `- **Renderer:** ${valueOrDash(benchmark.gpuInfo?.renderer)}`,
    `- **${t("BATATAOU_NAO.Metric.MeasurementSource", "Fonte da medição")}:** ${valueOrDash(baseline.fpsSource ?? benchmark.fpsSource)}`,
  ];

  if (applySummary) {
    lines.push(
      "",
      `## ${t("BATATAOU_NAO.Journal.ApplySummary", "Aplicação de preset")}`,
      "",
      `- **Applied:** ${valueOrDash(applySummary.applied)}`,
      `- **Skipped:** ${valueOrDash(applySummary.skipped)}`,
      `- **Failed:** ${valueOrDash(applySummary.failed)}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function downloadTextFile(content, filename, mime) {
  if (typeof globalThis.saveDataToFile === "function") {
    globalThis.saveDataToFile(content, mime, filename);
    return;
  }

  if (typeof globalThis.foundry?.utils?.saveDataToFile === "function") {
    globalThis.foundry.utils.saveDataToFile(content, mime, filename);
    return;
  }

  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error("BatataOuNao | Falha ao salvar arquivo:", err);

    try {
      globalThis.navigator?.clipboard?.writeText?.(content);
      globalThis.ui?.notifications?.warn?.(
        "Batata Ou Não | Não foi possível baixar o arquivo; conteúdo copiado para a área de transferência.",
      );
    } catch {
      globalThis.ui?.notifications?.error?.(
        "Batata Ou Não | Não foi possível exportar o relatório.",
      );
    }
  }
}

function assertBenchmark(benchmark) {
  if (!benchmark || typeof benchmark !== "object") {
    throw new Error("Benchmark inválido ou ausente.");
  }
}

function recommendedLabel(benchmark) {
  const tier = benchmark.tier ?? benchmark.recommendation?.tier;
  if (tier === 0) return t("BATATAOU_NAO.Quality.Low", "Batata");
  if (tier === 1) return t("BATATAOU_NAO.Quality.Medium", "Batata Boa");
  if (tier === 2) return t("BATATAOU_NAO.Quality.High", "Premium");
  return valueOrDash(
    benchmark.recommendedLabel ?? benchmark.recommendation?.label,
  );
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat(globalThis.game?.i18n?.lang ?? undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function slugTimestamp(date) {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function fps(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)} FPS` : "—";
}

function ms(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100) / 100}ms` : "—";
}

function pct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100) / 100}%` : "—";
}

function yesNo(value) {
  if (value === true) return t("BATATAOU_NAO.Journal.Reliable", "Confiável");
  if (value === false)
    return t("BATATAOU_NAO.Journal.Unreliable", "Não confiável");
  return "—";
}

function arrayOfText(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function htmlListOrEmpty(items, emptyText) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function markdownListOrEmpty(items, emptyText) {
  if (!items.length) return [`- ${emptyText}`];
  return items.map((item) => `- ${item}`);
}

function compactBenchmarkPayload(benchmark) {
  const data = toPlainData(benchmark) ?? {};

  const sampleKeys = [
    "samples",
    "fpsSamples",
    "frameSamples",
    "frameMsSamples",
    "qualitySamples",
    "stutterSamples",
    "chart",
  ];

  const summary = { ...data };

  for (const key of sampleKeys) {
    const value = summary[key];

    if (Array.isArray(value)) {
      summary[`${key}Count`] = value.length;
      delete summary[key];
    } else if (value && typeof value === "object") {
      summary[`${key}Keys`] = Object.keys(value);
      summary[`${key}Counts`] = Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
          childKey,
          Array.isArray(childValue) ? childValue.length : null,
        ]),
      );
      delete summary[key];
    }
  }

  if (summary.baseline && typeof summary.baseline === "object") {
    for (const key of sampleKeys) {
      if (Array.isArray(summary.baseline[key])) {
        summary.baseline[`${key}Count`] = summary.baseline[key].length;
        delete summary.baseline[key];
      }
    }
  }

  return summary;
}

function toPlainData(value) {
  if (value === null || value === undefined) return value;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
