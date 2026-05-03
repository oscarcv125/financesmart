// Tiny markdown→HTML→PDF helper. Uses zero npm deps; we ship just enough
// markdown for the SCMP doc (headings, lists, tables, code, bold, links, hr).
// Output: docs/SCMP.html, then `chrome --headless --print-to-pdf` produces SCMP.pdf.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'SCMP.md');
const HTML_OUT = path.join(__dirname, 'SCMP.html');

const md = fs.readFileSync(SRC, 'utf8');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  // inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  // bold **x**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *x*
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // links [t](u)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function renderTable(lines) {
  const rows = lines.map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const header = rows[0];
  const body = rows.slice(2);
  const thead = '<thead><tr>' + header.map(c => `<th>${inline(escapeHtml(c))}</th>`).join('') + '</tr></thead>';
  const tbody = '<tbody>' + body.map(r => '<tr>' + r.map(c => `<td>${inline(escapeHtml(c))}</td>`).join('') + '</tr>').join('') + '</tbody>';
  return `<table>${thead}${tbody}</table>`;
}

function render(src) {
  const lines = src.split(/\r?\n/);
  let out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { codeLines.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code${lang ? ` class="lang-${lang}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // table block (header line + separator)
    if (/^\|.*\|$/.test(line) && /^\|[\s\-:|]+\|$/.test(lines[i+1] || '')) {
      const block = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) { block.push(lines[i]); i++; }
      out.push(renderTable(block));
      continue;
    }

    // headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(escapeHtml(h[2]))}</h${level}>`);
      i++;
      continue;
    }

    // hr
    if (/^---+$/.test(line)) { out.push('<hr/>'); i++; continue; }

    // unordered list
    if (/^[\-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-*]\s+/, ''));
        i++;
      }
      out.push('<ul>' + items.map(it => `<li>${inline(escapeHtml(it))}</li>`).join('') + '</ul>');
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      out.push('<ol>' + items.map(it => `<li>${inline(escapeHtml(it))}</li>`).join('') + '</ol>');
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inline(escapeHtml(buf.join(' ')))}</blockquote>`);
      continue;
    }

    // blank line
    if (line.trim() === '') { i++; continue; }

    // paragraph (collect until blank/structural)
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^(#{1,6}\s|---+$|```|>|[-*]\s|\d+\.\s|\|.*\|$)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`);
  }
  return out.join('\n');
}

const body = render(md);

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>SCMP — FinanceSmart</title>
<style>
  @page { size: Letter; margin: 18mm 16mm; }
  :root {
    --fg: #1a1a1a;
    --muted: #555;
    --accent: #c8102e;
    --accent-soft: #f4d3d8;
    --border: #d8d8d8;
    --code-bg: #f6f6f6;
    --table-stripe: #fafafa;
    --table-head: #f0f0f0;
  }
  * { box-sizing: border-box; }
  html, body { background: white; color: var(--fg); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    margin: 0;
  }
  h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin: 1.4em 0 0.5em; page-break-after: avoid; }
  h1 {
    font-size: 22pt;
    color: var(--accent);
    border-bottom: 3px solid var(--accent);
    padding-bottom: 0.25em;
    margin-top: 0;
  }
  h2 {
    font-size: 16pt;
    color: var(--accent);
    border-bottom: 1px solid var(--accent-soft);
    padding-bottom: 0.2em;
    margin-top: 1.6em;
  }
  h3 { font-size: 13pt; color: #333; }
  h4 { font-size: 11.5pt; color: #444; font-weight: 600; }
  p { margin: 0.5em 0; orphans: 3; widows: 3; }
  ul, ol { margin: 0.4em 0 0.6em 1.2em; padding: 0; }
  li { margin: 0.15em 0; }
  blockquote {
    margin: 0.6em 0;
    padding: 0.4em 0.9em;
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    color: #4a1a22;
    font-style: italic;
    border-radius: 0 4px 4px 0;
  }
  hr { border: 0; border-top: 1px solid var(--border); margin: 1.5em 0; }
  code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 9.5pt;
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
  }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0.7em 0.9em;
    overflow: auto;
    page-break-inside: avoid;
  }
  pre code { background: transparent; padding: 0; font-size: 9pt; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.7em 0 1em;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }
  thead th { background: var(--table-head); font-weight: 600; }
  tbody tr:nth-child(even) { background: var(--table-stripe); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .cover {
    page-break-after: always;
    text-align: center;
    padding-top: 35vh;
  }
  .cover h1 { border: 0; font-size: 32pt; }
  .cover .sub { color: var(--muted); font-size: 14pt; margin-top: 0.4em; }
  .cover .meta { margin-top: 4em; font-size: 11pt; color: var(--muted); }
</style>
</head>
<body>
<section class="cover">
  <h1>Plan de Gestión de la Configuración de Software</h1>
  <div class="sub">Proyecto FinanceSmart</div>
  <div class="meta">
    Versión 1.0 · 3 de mayo de 2026<br/>
    Repositorio GitHub — FinanceSmart
  </div>
</section>
${body}
</body>
</html>`;

fs.writeFileSync(HTML_OUT, html, 'utf8');
console.log('HTML written:', HTML_OUT);
