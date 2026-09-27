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
    <span class="n">${r.n}.</span><span class="mark">${r.mark}</span><span class="label">${r.label}${r.from && html`<span class="from">${r.from}/.side-eye</span>`}</span><span class="pct">${pct}%</span>
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

// ---- rules tab: one section per .side-eye (root plus nested folders). Add, edit, delete. Every change is
// validated by the server and written to that file. Nested rules merge on top of the root by key, nearest wins.
const rulesEl = document.getElementById("rules");
let config = null;
let editing = null;   // "dir|key" of the rule being edited, "dir|" for the add form of that scope
let armed = null;     // "dir|key" of the rule whose delete button was clicked once
let error = "";       // shown next to the form that failed
let errorAt = null;   // "dir|key" the error belongs to
let preview = { path: "", rules: null };

function id(dir, key) { return dir + "|" + key; }
function fileName(dir) { return dir ? dir + "/.side-eye" : ".side-eye"; }

function pct(x) { return Math.round(x * 100) + "%"; }
function chips(items) { return items.map((x) => html`<span class="chip">${x}</span>`); }

function field(name, label, value, wide, placeholder) {
  return html`<label class="${wide ? "wide" : ""}">${label}<input name="${name}" value="${value}" placeholder="${placeholder}" required></label>`;
}

function ruleForm(dir, r, cls, submitText) {
  const mine = errorAt === id(dir, r.key);
  return html`<form class="rule-form ${cls}" data-dir="${dir}" data-key="${r.key}">
    ${field("label", "label (what you see)", r.label, false, "Network call is made")}
    ${field("key", "key (letters, digits, underscores)", r.key, false, "network")}
    ${field("question", "question (what Jev is asked, say the same thing as the label)", r.question, true, "Does this code change make a network call?")}
    <div class="acts">
      <button class="btn primary" type="submit">${submitText}</button>
      ${cls !== "add" && html`<button class="btn" type="button" data-act="cancel">cancel</button>`}
      ${mine && error && html`<span class="err">${error}</span>`}
    </div>
  </form>`;
}

function ruleRow(dir, r, overrides) {
  const del = armed === id(dir, r.key)
    ? html`<button class="btn armed" data-act="delete" data-dir="${dir}" data-key="${r.key}">really delete?</button>`
    : html`<button class="btn danger" data-act="delete" data-dir="${dir}" data-key="${r.key}">delete</button>`;
  return html`<div class="rule">
    <div><span class="label">${r.label}</span><span class="key">${r.key}</span>${overrides && html`<span class="key">overrides ${overrides}</span>`}</div>
    <div class="acts"><button class="btn" data-act="edit" data-dir="${dir}" data-key="${r.key}">edit</button>${del}</div>
    <p class="q">${r.question}</p>
  </div>`;
}

/** The folder above dir that already defines key, if any. Only for the "overrides" hint. */
function definedAbove(dir, key) {
  if (config.rules.some((r) => r.key === key)) return ".side-eye";
  const above = config.scopes.filter((s) => dir.startsWith(s.dir + "/")).sort((a, b) => b.dir.length - a.dir.length);
  const s = above.find((s) => s.rules.some((r) => r.key === key));
  return s ? fileName(s.dir) : "";
}

function scopeSection(dir, rules) {
  const empty = { key: "", label: "", question: "" };
  const note = dir
    ? html`<p class="tag">applies to files under <b>${dir}/</b>, on top of the root rules. A rule with the same key as a parent replaces it there.</p>`
    : html`<p class="tag">applies to every source file in the repo.</p>`;
  return html`<section class="scope" data-dir="${dir}">
    <h2>${fileName(dir)} <span class="count">${rules.length} rule${rules.length === 1 ? "" : "s"}</span></h2>
    ${note}
    ${editing === id(dir, "") ? ruleForm(dir, empty, "add", "add rule") : html`<button class="btn" data-act="new" data-dir="${dir}">add a rule</button>`}
    ${rules.map((r) => (editing === id(dir, r.key) ? ruleForm(dir, r, "edit", "save") : ruleRow(dir, r, dir ? definedAbove(dir, r.key) : "")))}
  </section>`;
}

function previewBox() {
  const rows = preview.rules && (preview.rules.length
    ? preview.rules.map((r) => html`<div class="rule"><div><span class="label">${r.label}</span><span class="key">${fileName(r.from)}</span></div><p class="q">${r.question}</p></div>`)
    : html`<p class="tag">no rules apply, nothing would be sent.</p>`);
  return html`<section class="scope">
    <h2>which rules apply to a file?</h2>
    <form id="preview-form" class="inline"><input name="path" value="${preview.path}" placeholder="frontend/components/Button.tsx"><button class="btn" type="submit">show</button></form>
    ${rows}
  </section>`;
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
    ${scopeSection("", c.rules)}
    ${c.scopes.map((s) => scopeSection(s.dir, s.rules))}
    <section class="scope">
      <h2>rules for a folder</h2>
      <p class="tag">creates an empty <b>.side-eye</b> in that folder. Its rules apply only to files under it.</p>
      <form id="add-scope" class="inline"><input name="dir" placeholder="frontend" required><button class="btn primary" type="submit">add folder</button>${errorAt === "add-scope" && error && html`<span class="err">${error}</span>`}</form>
    </section>
    ${previewBox()}`;
}

function rulesOf(dir) {
  if (!dir) return config.rules;
  const s = config.scopes.find((s) => s.dir === dir);
  return s ? s.rules : [];
}

async function saveRules(dir, rules, at) {
  const r = await fetch("/api/rules", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ dir, rules }) });
  const body = await r.json();
  if (!r.ok) { error = body.error; errorAt = at; drawRules(); return false; }
  config = body; error = ""; errorAt = null; editing = null; armed = null;
  if (preview.path) await loadPreview(); else drawRules();
  status.textContent = "rules saved to " + fileName(dir) + " at " + when(Date.now()) + ". re-checking your changes with the new rules.";
  return true;
}

async function loadPreview() {
  const r = await fetch("/api/rules-for?path=" + encodeURIComponent(preview.path));
  preview.rules = (await r.json()).rules;
  drawRules();
}

rulesEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const dir = b.dataset.dir ?? "";
  const key = b.dataset.key ?? "";
  if (b.dataset.act === "new") { editing = id(dir, ""); armed = null; error = ""; drawRules(); }
  if (b.dataset.act === "edit") { editing = id(dir, key); armed = null; error = ""; drawRules(); }
  if (b.dataset.act === "cancel") { editing = null; error = ""; drawRules(); }
  if (b.dataset.act === "delete") {
    if (armed !== id(dir, key)) { armed = id(dir, key); drawRules(); return; }
    saveRules(dir, rulesOf(dir).filter((r) => r.key !== key), id(dir, key));
  }
});

rulesEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  if (form.id === "add-scope") { saveRules(data.dir.trim(), [], "add-scope"); return; }
  if (form.id === "preview-form") { preview.path = data.path.trim(); loadPreview(); return; }
  const dir = form.dataset.dir ?? "";
  const rule = { key: data.key.trim(), label: data.label.trim(), question: data.question.trim() };
  const isAdd = form.classList.contains("add");
  const current = rulesOf(dir);
  const rules = isAdd ? [...current, rule] : current.map((r) => (r.key === form.dataset.key ? rule : r));
  saveRules(dir, rules, id(dir, isAdd ? "" : form.dataset.key));
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
