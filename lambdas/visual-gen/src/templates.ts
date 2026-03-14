/**
 * 8 dark-themed HTML templates for data visualisations.
 * Design system: #0a0a0a bg, Syne headings, DM Mono labels,
 * amber #f5a623 accent, #f0ece4 text.
 */

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Lora:wght@400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    font-family: 'Syne', sans-serif;
    color: #f0ece4;
    width: 1920px;
    height: 1080px;
    padding: 60px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .accent  { color: #f5a623; }
  .success { color: #22c55e; }
  .source, .citation-bar {
    color: #666;
    font-size: 14px;
    font-family: 'DM Mono', monospace;
  }
  .citation-bar {
    position: absolute;
    bottom: 20px;
    left: 60px;
    right: 60px;
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  h1, h2, h3 { font-family: 'Syne', sans-serif; font-weight: 700; }
  h1 { font-size: 48px; margin-bottom: 32px; }
  h2 { font-size: 36px; margin-bottom: 24px; }
`;

const CHARTJS_CDN =
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
const MERMAID_CDN =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

type TemplateData = Record<string, unknown>;

export function buildHTML(
  type: string,
  data: TemplateData,
  citations: string[]
): string {
  const citationFooter = citations.length > 0
    ? `<div class="citation-bar">${citations.map((c) => `<span>${escapeHTML(c)}</span>`).join("")}</div>`
    : "";

  switch (type) {
    case "comparison-table":
      return comparisonTable(data, citationFooter);
    case "bar-chart":
      return chartTemplate("bar", data, citationFooter);
    case "line-chart":
      return chartTemplate("line", data, citationFooter);
    case "radar-chart":
      return radarChart(data, citationFooter);
    case "flow-diagram":
      return flowDiagram(data, citationFooter);
    case "infographic-card":
    case "stat-callout":
      return statCallout(data, citationFooter);
    case "personality-card":
      return personalityCard(data, citationFooter);
    case "news-timeline":
      return newsTimeline(data, citationFooter);
    default:
      return statCallout(data, citationFooter);
  }
}

// ─── Templates ────────────────────────────────────────────────────────────

function comparisonTable(data: TemplateData, footer: string): string {
  const columns = (data.columns as string[]) ?? [];
  const rows = (data.rows as string[][]) ?? [];
  const footnote = (data.footnote as string) ?? "";
  const winnerCol = (data.winnerCol as number) ?? -1;

  return wrap(`
    <style>
      ${BASE_CSS}
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; padding: 16px 20px; font-family: 'DM Mono', monospace;
           font-size: 16px; color: #f5a623; border-bottom: 2px solid #222; }
      td { padding: 16px 20px; font-size: 20px; border-bottom: 1px solid #1a1a1a; }
      .feature-label { font-weight: 600; color: #f5a623; }
      tr { opacity: 0; animation: fadeIn 0.4s ease forwards; }
      ${rows.map((_, i) => `tr:nth-child(${i + 2}) { animation-delay: ${i * 200}ms; }`).join("\n")}
      .winner { color: #22c55e; font-weight: 700; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
    <table>
      <thead><tr>${columns.map((c) => `<th>${escapeHTML(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr>${row.map((cell, ci) => `<td class="${ci === 0 ? "feature-label" : ""}${ci === winnerCol ? " winner" : ""}">${escapeHTML(cell)}</td>`).join("")}</tr>`
        )
        .join("")}</tbody>
    </table>
    <div class="source" style="margin-top:16px">${escapeHTML(footnote)}</div>
    ${footer}
  `);
}

function chartTemplate(
  chartType: "bar" | "line",
  data: TemplateData,
  footer: string
): string {
  const title = (data.title as string) ?? "";
  const labels = (data.labels as string[]) ?? [];
  const datasets = (data.datasets as Array<{ label: string; data: number[]; color?: string }>) ?? [];

  const colors = ["#f5a623", "#22c55e", "#3b82f6", "#ef4444", "#a855f7"];

  const chartDatasets = datasets.map((ds, i) => ({
    label: ds.label,
    data: ds.data,
    backgroundColor: ds.color ?? colors[i % colors.length] + "88",
    borderColor: ds.color ?? colors[i % colors.length],
    borderWidth: 2,
  }));

  return wrap(`
    <style>${BASE_CSS}
      canvas { max-width: 1800px; max-height: 900px; }
    </style>
    <canvas id="chart" width="1800" height="900"></canvas>
    <script src="${CHARTJS_CDN}"></script>
    <script>
      new Chart(document.getElementById('chart'), {
        type: '${chartType}',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: ${JSON.stringify(chartDatasets)}
        },
        options: {
          responsive: false,
          animation: { duration: 1500, easing: 'easeOutQuart' },
          plugins: {
            legend: { labels: { color: '#f0ece4', font: { size: 18, family: 'DM Mono' } } },
            title: { display: true, text: ${JSON.stringify(title)}, color: '#f0ece4', font: { size: 28, family: 'Syne' } }
          },
          scales: {
            x: { ticks: { color: '#f0ece4', font: { size: 16 } }, grid: { color: '#222' } },
            y: { ticks: { color: '#f0ece4', font: { size: 16 } }, grid: { color: '#222' } }
          }
        }
      });
    </script>
    ${footer}
  `);
}

function radarChart(data: TemplateData, footer: string): string {
  const dimensions = (data.dimensions as string[]) ?? [];
  const subjects = (data.subjects as Array<{ label: string; scores: number[]; colour: string }>) ?? [];

  const chartDatasets = subjects.map((s) => ({
    label: s.label,
    data: s.scores,
    backgroundColor: s.colour + "33",
    borderColor: s.colour,
    borderWidth: 2,
    pointBackgroundColor: s.colour,
  }));

  return wrap(`
    <style>${BASE_CSS}
      canvas { max-width: 900px; max-height: 900px; margin: 0 auto; }
    </style>
    <canvas id="radar" width="900" height="900"></canvas>
    <script src="${CHARTJS_CDN}"></script>
    <script>
      new Chart(document.getElementById('radar'), {
        type: 'radar',
        data: {
          labels: ${JSON.stringify(dimensions)},
          datasets: ${JSON.stringify(chartDatasets)}
        },
        options: {
          responsive: false,
          scales: {
            r: {
              min: 0, max: 10,
              ticks: { color: '#f0ece4', backdropColor: 'transparent', font: { size: 14 } },
              grid: { color: '#333' },
              pointLabels: { color: '#f0ece4', font: { size: 18, family: 'Syne' } }
            }
          },
          plugins: {
            legend: { labels: { color: '#f0ece4', font: { size: 18, family: 'DM Mono' } } }
          }
        }
      });
    </script>
    ${footer}
  `);
}

function flowDiagram(data: TemplateData, footer: string): string {
  const diagram = (data.mermaid as string) ?? "graph LR\n  A --> B";

  return wrap(`
    <style>${BASE_CSS}
      .mermaid { display: flex; justify-content: center; align-items: center; min-height: 800px; }
      .mermaid svg { max-width: 1800px; }
    </style>
    <div class="mermaid">${escapeHTML(diagram)}</div>
    <script src="${MERMAID_CDN}"></script>
    <script>
      mermaid.initialize({
        startOnLoad: true,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#1a1a1a',
          primaryTextColor: '#f0ece4',
          primaryBorderColor: '#f5a623',
          lineColor: '#f5a623',
          secondaryColor: '#111',
          tertiaryColor: '#1a1a1a',
          fontSize: '18px',
          fontFamily: 'Syne'
        }
      });
    </script>
    ${footer}
  `);
}

function statCallout(data: TemplateData, footer: string): string {
  const stat = (data.stat as string) ?? "";
  const label = (data.label as string) ?? "";
  const context = (data.context as string) ?? "";
  const source = (data.source as string) ?? "";

  return wrap(`
    <style>${BASE_CSS}
      .stat-card {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center; height: 100%;
      }
      .big-stat {
        font-size: 120px; font-weight: 800; color: #f5a623;
        line-height: 1; margin-bottom: 24px;
        animation: countUp 1s ease-out;
      }
      .label { font-size: 36px; font-weight: 600; margin-bottom: 16px; }
      .context { font-size: 22px; color: #999; max-width: 800px; }
      @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    </style>
    <div class="stat-card">
      <div class="big-stat">${escapeHTML(stat)}</div>
      <div class="label">${escapeHTML(label)}</div>
      <div class="context">${escapeHTML(context)}</div>
      <div class="source" style="margin-top:24px">${escapeHTML(source)}</div>
    </div>
    ${footer}
  `);
}

function personalityCard(data: TemplateData, footer: string): string {
  const name = (data.name as string) ?? "";
  const role = (data.role as string) ?? "";
  const organisation = (data.organisation as string) ?? "";
  const facts = (data.facts as string[]) ?? [];
  const imageUrl = (data.imageUrl as string) ?? "";
  const source = (data.source as string) ?? "";

  return wrap(`
    <style>${BASE_CSS}
      .card {
        display: flex; gap: 48px; align-items: center;
        height: 100%;
      }
      .avatar-img {
        width: 400px; height: 400px; object-fit: cover;
        border-radius: 16px; border: 2px solid #222;
      }
      .facts h2 { margin-bottom: 8px; }
      .role { font-size: 20px; margin-bottom: 24px; }
      ul { list-style: none; padding: 0; }
      li { font-size: 22px; padding: 8px 0; border-bottom: 1px solid #1a1a1a; }
      li::before { content: '→ '; color: #f5a623; }
    </style>
    <div class="card">
      ${imageUrl ? `<img src="${escapeHTML(imageUrl)}" class="avatar-img" />` : ""}
      <div class="facts">
        <h2>${escapeHTML(name)}</h2>
        <p class="role accent">${escapeHTML(role)} · ${escapeHTML(organisation)}</p>
        <ul>${facts.map((f) => `<li>${escapeHTML(f)}</li>`).join("")}</ul>
        <span class="source">${escapeHTML(source)}</span>
      </div>
    </div>
    ${footer}
  `);
}

function newsTimeline(data: TemplateData, footer: string): string {
  const events = (data.events as Array<{ date: string; headline: string; detail: string }>) ?? [];

  return wrap(`
    <style>${BASE_CSS}
      .timeline { display: flex; flex-direction: column; gap: 24px; padding-left: 40px;
                  border-left: 3px solid #222; }
      .event {
        opacity: 0; animation: fadeIn 0.5s ease forwards;
        padding-left: 32px; position: relative;
      }
      .event::before {
        content: ''; width: 14px; height: 14px; background: #f5a623;
        border-radius: 50%; position: absolute; left: -9px; top: 6px;
      }
      ${events.map((_, i) => `.event:nth-child(${i + 1}) { animation-delay: ${i * 400}ms; }`).join("\n")}
      .date { font-family: 'DM Mono', monospace; color: #f5a623; font-size: 18px; margin-bottom: 4px; }
      .headline { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
      .detail { font-size: 18px; color: #999; }
      @keyframes fadeIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    </style>
    <div class="timeline">
      ${events
        .map(
          (e) => `
        <div class="event">
          <div class="date">${escapeHTML(e.date)}</div>
          <div class="headline">${escapeHTML(e.headline)}</div>
          <div class="detail">${escapeHTML(e.detail)}</div>
        </div>`
        )
        .join("")}
    </div>
    ${footer}
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
