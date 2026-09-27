const list = document.getElementById("list");
const dot = document.getElementById("dot");
const status = document.getElementById("status");
let findings = [];

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function when(t) { return new Date(t).toLocaleTimeString(); }

function diffHtml(text) {
  return text.split("\n").map((l) => {
    const cls = l.startsWith("@@") ? "hdr" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
    return '<span class="' + cls + '">' + esc(l) + '</span>';
  }).join("\n");
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
    '</span><span class="radius ' + esc(f.radius) + '">' + esc(f.radius) + '</span>' +
    '<button class="fold" type="button" aria-expanded="false"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 4l4 4 4-4"/></svg><span>diff</span></button></div>' + rows +
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

function field(name, label, value, wide, placeholder) {
  return '<label class="' + (wide ? "wide" : "") + '">' + label + '<input name="' + name + '" value="' + esc(value) +
    '" placeholder="' + esc(placeholder || "") + '" required></label>';
}

function ruleForm(r, cls, submitText) {
  return '<form class="rule-form ' + cls + '" data-key="' + esc(r.key) + '">' +
    field("label", "label (what you see)", r.label, false, "Network call is made") +
    field("key", "key (letters, digits, underscores)", r.key, false, "network") +
    field("question", "question (what Jev is asked, say the same thing as the label)", r.question, true, "Does this code change make a network call?") +
    '<div class="acts"><button class="btn primary" type="submit">' + submitText + '</button>' +
    (cls === "add" ? "" : '<button class="btn" type="button" data-act="cancel">cancel</button>') +
    (error ? '<span class="err">' + esc(error) + '</span>' : "") + '</div></form>';
}

function ruleRow(r) {
  const del = armed === r.key ? '<button class="btn armed" data-act="delete" data-key="' + esc(r.key) + '">really delete?</button>'
                              : '<button class="btn danger" data-act="delete" data-key="' + esc(r.key) + '">delete</button>';
  return '<div class="rule"><div><span class="label">' + esc(r.label) + '</span><span class="key">' + esc(r.key) + '</span></div>' +
    '<div class="acts"><button class="btn" data-act="edit" data-key="' + esc(r.key) + '">edit</button>' + del + '</div>' +
    '<p class="q">' + esc(r.question) + '</p></div>';
}

function drawRules() {
  const c = config;
  if (!c) return;
  const rules = c.rules.map((r) => (editing === r.key ? ruleForm(r, "edit", "save") : ruleRow(r))).join("");
  rulesEl.innerHTML =
    '<dl class="meta"><dt>sure</dt><dd>' + pct(c.sure) + ' and up prints loud</dd>' +
    '<dt>maybe</dt><dd>' + pct(c.maybe) + ' to ' + pct(c.sure) + ' prints dim</dd>' +
    '<dt>blast radius</dt><dd>' + c.blastRadius.map((b) => '<span class="chip">' + esc(b) + '</span>').join("") + '</dd>' +
    '<dt>sent</dt><dd>' + c.extensions.map((e) => '<span class="chip">' + esc(e) + '</span>').join("") + '<br><small>only these extensions ever leave the machine</small></dd></dl>' +
    '<h2 style="font-size:15px;margin:0 0 10px">add a rule</h2>' +
    '<div id="add-rule">' + ruleForm({ key: "", label: "", question: "" }, "add", "add rule") + '</div>' +
    '<h2 style="font-size:15px;margin:0 0 4px">' + c.rules.length + ' rules, one yes/no question each</h2>' + rules;
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
  if (isAdd) editing = ""; else editing = form.dataset.key;
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
