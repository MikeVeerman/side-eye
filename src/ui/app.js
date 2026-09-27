// ---- html: a tagged template that escapes every interpolated value. Nested html`` results and arrays of them pass through
// as-is. The result stringifies itself, so it can be assigned to innerHTML directly.
class Html {
  constructor(text) { this.text = text; }
  toString() { return this.text; }
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function render(v) {
  if (v instanceof Html) return v.text;
  if (Array.isArray(v)) return v.map(render).join("");
  if (v === false || v == null) return "";
  return esc(v);
}
function html(strings, ...values) {
  return new Html(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ""), ""));
}

const list = document.getElementById("list");
const dot = document.getElementById("dot");
const status = document.getElementById("status");
let findings = [];

function when(t) { return new Date(t).toLocaleTimeString(); }

function diffHtml(text) {
  const lines = text.split("\n").map((l) => {
    const cls = l.startsWith("@@") ? "hdr" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
    return html`<span class="${cls}">${l}</span>`;
  });
  return new Html(lines.join("\n"));
}

function row(r) {
  const pct = Math.round(r.p * 100);
  return html`<div class="row ${r.mark === "!!" ? "sure" : "maybe"}">
    <span class="n">${r.n}.</span><span class="mark">${r.mark}</span><span class="label">${r.label}</span><span class="pct">${pct}%</span>
    <span class="bar"><i style="width:${pct}%"></i></span>
  </div>`;
}

function card(f, fresh) {
  return html`<article class="card${fresh ? " new" : ""}">
    <div class="head">
      <span class="path">${f.path}</span><span class="lines">lines ${f.lines}</span><span class="time">${when(f.at)}</span>
      <button class="fold" type="button" aria-expanded="false">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 4l4 4 4-4"/></svg><span>diff</span>
      </button>
    </div>
    ${f.rows.map(row)}
    <pre class="diff" hidden>${diffHtml(f.diff)}</pre>
  </article>`;
}

function draw(freshAt) {
  if (!findings.length) { list.innerHTML = html`<div class="empty">Nothing to side-eye yet. Save a source file.</div>`; return; }
  list.innerHTML = html`${findings.map((f) => card(f, f.at === freshAt))}`;
}

fetch("/api/findings").then((r) => r.json()).then((d) => { findings = d.findings; draw(); });

list.addEventListener("click", (e) => {
  const head = e.target.closest(".head");
  if (!head) return;
  const card = head.parentElement;
  const pre = card.querySelector(".diff");
  pre.hidden = !pre.hidden;
  card.classList.toggle("open", !pre.hidden);
  const btn = card.querySelector(".fold");
  btn.setAttribute("aria-expanded", String(!pre.hidden));
  btn.querySelector("span").textContent = pre.hidden ? "diff" : "hide";
});

for (const b of document.querySelectorAll("nav.tabs button")) {
  b.addEventListener("click", () => {
    for (const o of document.querySelectorAll("nav.tabs button")) o.setAttribute("aria-selected", String(o === b));
    for (const p of document.querySelectorAll(".panel")) p.hidden = p.id !== b.dataset.tab;
  });
}

// ---- rules tab: add, edit, delete. Every change is validated by the server and written to .side-eye.
const rulesEl = document.getElementById("rules");
let config = null;
let editing = null;   // key of the rule being edited
let armed = null;     // key of the rule whose delete button was clicked once
let error = "";

function pct(x) { return Math.round(x * 100) + "%"; }
function chips(items) { return items.map((x) => html`<span class="chip">${x}</span>`); }

function field(name, label, value, wide, placeholder) {
  return html`<label class="${wide ? "wide" : ""}">${label}<input name="${name}" value="${value}" placeholder="${placeholder}" required></label>`;
}

function ruleForm(r, cls, submitText) {
  return html`<form class="rule-form ${cls}" data-key="${r.key}">
    ${field("label", "label (what you see)", r.label, false, "Network call is made")}
    ${field("key", "key (letters, digits, underscores)", r.key, false, "network")}
    ${field("question", "question (what Jev is asked, say the same thing as the label)", r.question, true, "Does this code change make a network call?")}
    <div class="acts">
      <button class="btn primary" type="submit">${submitText}</button>
      ${cls !== "add" && html`<button class="btn" type="button" data-act="cancel">cancel</button>`}
      ${error && html`<span class="err">${error}</span>`}
    </div>
  </form>`;
}

function ruleRow(r) {
  const del = armed === r.key
    ? html`<button class="btn armed" data-act="delete" data-key="${r.key}">really delete?</button>`
    : html`<button class="btn danger" data-act="delete" data-key="${r.key}">delete</button>`;
  return html`<div class="rule">
    <div><span class="label">${r.label}</span><span class="key">${r.key}</span></div>
    <div class="acts"><button class="btn" data-act="edit" data-key="${r.key}">edit</button>${del}</div>
    <p class="q">${r.question}</p>
  </div>`;
}

function drawRules() {
  const c = config;
  if (!c) return;
  rulesEl.innerHTML = html`
    <dl class="meta">
      <dt>sure</dt><dd>${pct(c.sure)} and up prints loud</dd>
      <dt>maybe</dt><dd>${pct(c.maybe)} to ${pct(c.sure)} prints dim</dd>
      <dt>sent</dt><dd>${chips(c.extensions)}<br><small>only these extensions ever leave the machine</small></dd>
    </dl>
    <h2>add a rule</h2>
    <div id="add-rule">${ruleForm({ key: "", label: "", question: "" }, "add", "add rule")}</div>
    <h2>${c.rules.length} rules, one yes/no question each</h2>
    ${c.rules.map((r) => (editing === r.key ? ruleForm(r, "edit", "save") : ruleRow(r)))}`;
}

async function saveRules(rules) {
  const r = await fetch("/api/rules", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules }) });
  const body = await r.json();
  if (!r.ok) { error = body.error; drawRules(); return false; }
  config = body; error = ""; editing = null; armed = null; drawRules();
  status.textContent = "rules saved to .side-eye at " + when(Date.now()) + ". re-checking your changes with the new rules.";
  return true;
}

rulesEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const key = b.dataset.key;
  if (b.dataset.act === "edit") { editing = key; armed = null; error = ""; drawRules(); }
  if (b.dataset.act === "cancel") { editing = null; error = ""; drawRules(); }
  if (b.dataset.act === "delete") {
    if (armed !== key) { armed = key; drawRules(); return; }
    saveRules(config.rules.filter((r) => r.key !== key));
  }
});

rulesEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const rule = { key: data.key.trim(), label: data.label.trim(), question: data.question.trim() };
  const isAdd = form.classList.contains("add");
  const rules = isAdd ? [...config.rules, rule] : config.rules.map((r) => (r.key === form.dataset.key ? rule : r));
  editing = isAdd ? "" : form.dataset.key;
  saveRules(rules);
});

fetch("/api/config").then((r) => r.json()).then((c) => { config = c; drawRules(); });

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
