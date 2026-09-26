// The local page. One file, no build step, no external assets. Styled to match a terminal.

export const LOGO = `<svg class="logo" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="side-eye logo">
  <path class="brow" d="M16 28 Q 58 4 106 18" fill="none" stroke-width="7" stroke-linecap="round"/>
  <path class="white" d="M8 52 Q 60 12 112 52 Q 60 92 8 52 Z"/>
  <g class="gaze">
    <circle class="iris" cx="84" cy="52" r="15"/>
    <circle class="pupil" cx="88" cy="52" r="7"/>
    <circle class="glint" cx="92" cy="47" r="3"/>
  </g>
  <path class="lid" d="M8 52 Q 60 12 112 52 Q 60 38 8 52 Z"/>
</svg>`;

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>side-eye</title>
<style>
  :root {
    --bg: #1d1f21; --panel: #26282b; --ink: #e8dcc3; --dim: #9a917d; --line: #3a3d41;
    --sure: #e0a06a; --maybe: #8aa0b3; --ok: #8fb58a; --del: #d98b80; --code: #1a1c1e; --eye-white: #f2e9d4; --iris: #6b8f9e; --pupil: #1d1f21;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --bg: #f6f1e6; --panel: #fffaf0; --ink: #2a2622; --dim: #7a7264; --line: #e2d9c6;
      --sure: #b8642a; --maybe: #4f6b83; --ok: #4d7f47; --del: #b5473a; --code: #f1ebdd; --eye-white: #ffffff; --iris: #4f7f92; --pupil: #2a2622;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 16px 64px; }
  header { display: flex; align-items: center; gap: 20px; margin-bottom: 8px; }
  .logo { width: 96px; height: 64px; flex: none; }
  .logo .brow { stroke: var(--ink); }
  .logo .white { fill: var(--eye-white); }
  .logo .iris { fill: var(--iris); }
  .logo .pupil { fill: var(--pupil); }
  .logo .glint { fill: var(--eye-white); }
  .logo .lid { fill: var(--bg); }
  .logo .gaze { animation: glance 7s ease-in-out infinite; }
  @keyframes glance {
    0%, 55%, 100% { transform: translateX(0); }
    62%, 78% { transform: translateX(-44px); }
    85% { transform: translateX(0); }
  }
  h1 { margin: 0; font-size: 28px; letter-spacing: 0.02em; }
  .tag { color: var(--dim); margin: 0; }
  .status { display: flex; gap: 12px; align-items: center; color: var(--dim); margin: 20px 0 28px; font-size: 13px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ok); display: inline-block; }
  .dot.off { background: var(--sure); }
  nav.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 20px; }
  nav.tabs button { background: none; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; color: var(--dim);
    font: inherit; padding: 8px 14px; cursor: pointer; }
  nav.tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--sure); }
  nav.tabs button:focus-visible { outline: 2px solid var(--maybe); outline-offset: 2px; border-radius: 4px; }
  .panel[hidden] { display: none; }
  .meta { display: grid; grid-template-columns: 12ch 1fr; gap: 6px 12px; margin-bottom: 20px; font-size: 14px; }
  .meta dt { color: var(--dim); }
  .meta dd { margin: 0; }
  .chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; margin: 2px 4px 2px 0; font-size: 12px; color: var(--dim); }
  .rule { border-top: 1px solid var(--line); padding: 12px 0; }
  .rule .label { font-weight: 600; }
  .rule .key { color: var(--dim); font-size: 12px; margin-left: 10px; }
  .rule .q { color: var(--dim); margin: 4px 0 0; }
  .empty { border: 1px dashed var(--line); border-radius: 10px; padding: 40px 16px; text-align: center; color: var(--dim); }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .card.new { animation: pop 0.5s ease-out; }
  @keyframes pop { from { transform: translateY(-6px); opacity: 0; } to { transform: none; opacity: 1; } }
  .card .head { cursor: pointer; }
  .card .head::before { content: "▸"; color: var(--dim); font-size: 12px; margin-right: -4px; }
  .card.open .head::before { content: "▾"; }
  .diff { margin: 12px 0 0; padding: 10px 12px; background: var(--code); border: 1px solid var(--line); border-radius: 8px;
    font-size: 13px; line-height: 1.45; overflow-x: auto; white-space: pre; }
  .diff .add { color: var(--ok); }
  .diff .del { color: var(--del); }
  .diff .hdr { color: var(--dim); }
  .head { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline; margin-bottom: 10px; }
  .path { font-weight: 600; }
  .lines, .time { color: var(--dim); font-size: 13px; }
  .radius { margin-left: auto; font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--dim); }
  .radius.service, .radius.system-wide { border-color: var(--sure); color: var(--sure); }
  .row { display: grid; grid-template-columns: 2ch 6ch 1fr 5ch; gap: 8px; align-items: center; padding: 4px 0; }
  .row .n { color: var(--dim); text-align: right; }
  .row .mark { font-weight: 700; }
  .row.sure .mark { color: var(--sure); }
  .row.maybe .mark, .row.maybe .label { color: var(--maybe); }
  .row .pct { text-align: right; font-variant-numeric: tabular-nums; }
  .bar { grid-column: 3 / 5; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; margin-top: -2px; }
  .bar i { display: block; height: 100%; background: var(--sure); }
  .row.maybe .bar i { background: var(--maybe); }
  @media (max-width: 480px) { .row { grid-template-columns: 2ch 6ch 1fr 5ch; font-size: 13px; } .logo { width: 72px; height: 48px; } h1 { font-size: 22px; } }
</style>
</head>
<body>
<main>
  <header>
    ${LOGO}
    <div>
      <h1>side-eye</h1>
      <p class="tag">giving your side effects the side-eye</p>
    </div>
  </header>
  <div class="status"><span class="dot" id="dot"></span><span id="status">connecting to /events</span></div>
  <nav class="tabs" role="tablist">
    <button role="tab" data-tab="flags" aria-selected="true">Flags</button>
    <button role="tab" data-tab="rules" aria-selected="false">Rules</button>
  </nav>
  <section class="panel" id="flags" role="tabpanel"><div id="list"><div class="empty">Nothing to side-eye yet. Save a source file.</div></div></section>
  <section class="panel" id="rules" role="tabpanel" hidden><div id="ruleset" class="empty">Loading .side-eye</div></section>
</main>
<script>
  const list = document.getElementById("list");
  const dot = document.getElementById("dot");
  const status = document.getElementById("status");
  let findings = [];

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function when(t) { return new Date(t).toLocaleTimeString(); }

  function diffHtml(text) {
    return text.split("\\n").map((l) => {
      const cls = l.startsWith("@@") ? "hdr" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
      return '<span class="' + cls + '">' + esc(l) + '</span>';
    }).join("\\n");
  }

  function card(f, fresh) {
    const rows = f.rows.map((r) => {
      const pct = Math.round(r.p * 100);
      const cls = r.mark === "!!" ? "sure" : "maybe";
      return '<div class="row ' + cls + '"><span class="n">' + r.n + '.</span><span class="mark">' + esc(r.mark) +
        '</span><span class="label">' + esc(r.label) + '</span><span class="pct">' + pct + '%</span>' +
        '<span class="bar"><i style="width:' + pct + '%"></i></span></div>';
    }).join("");
    return '<article class="card' + (fresh ? " new" : "") + '"><div class="head"><span class="path">' + esc(f.path) +
      '</span><span class="lines">lines ' + esc(f.lines) + '</span><span class="time">' + when(f.at) +
      '</span><span class="radius ' + esc(f.radius) + '">' + esc(f.radius) + '</span></div>' + rows +
      '<pre class="diff" hidden>' + diffHtml(f.diff) + '</pre></article>';
  }

  function draw(freshAt) {
    if (!findings.length) { list.innerHTML = '<div class="empty">Nothing to side-eye yet. Save a source file.</div>'; return; }
    list.innerHTML = findings.map((f) => card(f, f.at === freshAt)).join("");
  }

  fetch("/api/findings").then((r) => r.json()).then((d) => { findings = d.findings; draw(); });

  list.addEventListener("click", (e) => {
    const head = e.target.closest(".head");
    if (!head) return;
    const card = head.parentElement;
    const pre = card.querySelector(".diff");
    pre.hidden = !pre.hidden;
    card.classList.toggle("open", !pre.hidden);
  });

  for (const b of document.querySelectorAll("nav.tabs button")) {
    b.addEventListener("click", () => {
      for (const o of document.querySelectorAll("nav.tabs button")) o.setAttribute("aria-selected", String(o === b));
      for (const p of document.querySelectorAll(".panel")) p.hidden = p.id !== b.dataset.tab;
    });
  }

  function pct(x) { return Math.round(x * 100) + "%"; }
  fetch("/api/config").then((r) => r.json()).then((c) => {
    const rules = c.rules.map((r) => '<div class="rule"><span class="label">' + esc(r.label) + '</span><span class="key">' + esc(r.key) +
      '</span><p class="q">' + esc(r.question) + '</p></div>').join("");
    document.getElementById("ruleset").outerHTML =
      '<dl class="meta"><dt>sure</dt><dd>' + pct(c.sure) + ' and up prints loud</dd>' +
      '<dt>maybe</dt><dd>' + pct(c.maybe) + ' to ' + pct(c.sure) + ' prints dim</dd>' +
      '<dt>blast radius</dt><dd>' + c.blastRadius.map((b) => '<span class="chip">' + esc(b) + '</span>').join("") + '</dd>' +
      '<dt>sent</dt><dd>' + c.extensions.map((e) => '<span class="chip">' + esc(e) + '</span>').join("") + '<br><small>only these extensions ever leave the machine</small></dd></dl>' +
      '<h2 style="font-size:15px;margin:0 0 4px">' + c.rules.length + ' rules, one yes/no question each</h2>' + rules;
  });

  const es = new EventSource("/events");
  es.onopen = () => { dot.className = "dot"; status.textContent = "watching. flags appear here as you save."; };
  es.onerror = () => { dot.className = "dot off"; status.textContent = "disconnected. is side-eye watch still running?"; };
  es.addEventListener("finding", (e) => {
    const f = JSON.parse(e.data);
    findings.unshift(f);
    draw(f.at);
    status.textContent = "last flag " + when(f.at) + " in " + f.path;
  });
  es.addEventListener("clean", (e) => {
    const path = JSON.parse(e.data).path;
    findings = findings.filter((f) => f.path !== path);
    draw();
    status.textContent = "ok " + path + " at " + when(Date.now());
  });
</script>
</body>
</html>
`;
