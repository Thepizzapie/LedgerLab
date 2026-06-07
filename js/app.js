/* =============================================================================
   Ledger Lab — application shell
   -----------------------------------------------------------------------------
   A single-screen spreadsheet-style workbench. The sandbox IS the app: browse
   the practice tables, write live SQL or stack Power Query steps against them,
   and optionally load a "drill" (a challenge with a goal + a Check button) into
   that same workbench. Flat, dense, native — no routing, no framework.
   ============================================================================= */
(function (LL) {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const escapeHtml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // App-icon glyph: sparkles → "freshly cleaned data".
  const APPICON = `<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2.6c.55 4.2 1.2 5.85 2.85 7.05C16.5 10.85 18.2 11.45 21.4 12c-3.2.55-4.9 1.15-6.55 2.35C13.2 15.55 12.55 17.2 12 21.4c-.55-4.2-1.2-5.85-2.85-7.05C7.5 13.15 5.8 12.55 2.6 12c3.2-.55 4.9-1.15 6.55-2.35C10.8 8.45 11.45 6.8 12 2.6Z"/><path d="M18.5 2.2c.2 1.5.45 2.1 1.05 2.55.55.45 1.2.65 2.45.85-1.25.2-1.9.4-2.45.85-.6.45-.85 1.05-1.05 2.55-.2-1.5-.45-2.1-1.05-2.55-.55-.45-1.2-.65-2.45-.85 1.25-.2 1.9-.4 2.45-.85.6-.45.85-1.05 1.05-2.55Z"/></svg>`;

  // -------------------------------------------------------------- app state
  const S = {
    mode: "sql", // 'sql' | 'pq'
    table: "vendors_raw", // table shown when sandboxing
    drill: null, // { kind:'sql'|'pq', lesson } when a challenge is loaded
    sqlQuery: "SELECT * FROM vendors_raw;",
    pqSteps: [],
    pqSourceName: "vendors_raw",
  };
  let PQ_CTX = null;

  // -------------------------------------------------------------- progress
  const PKEY = "ledgerlab.progress.v2";
  const getProgress = () => {
    try { return JSON.parse(localStorage.getItem(PKEY)) || { done: {} }; }
    catch (_) { return { done: {} }; }
  };
  const isDone = (id) => !!getProgress().done[id];
  const setDone = (id) => { const p = getProgress(); p.done[id] = true; localStorage.setItem(PKEY, JSON.stringify(p)); };
  const allDrills = () => LL.SQL_LESSONS.concat(LL.PQ_LESSONS);
  const doneCount = () => allDrills().filter((l) => isDone(l.id)).length;

  // -------------------------------------------------------------- helpers
  function colLetter(n) {
    let s = "";
    n++;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function formatCell(v) {
    if (v === null || v === undefined) return { cls: "c-null", text: "·" };
    if (typeof v === "number") {
      const neg = v < 0, abs = Math.abs(v);
      const body = Number.isInteger(v)
        ? abs.toLocaleString("en-US")
        : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return { cls: "c-num" + (neg ? " c-neg" : ""), text: neg ? `(${body})` : body };
    }
    const s = String(v);
    if (s.trim() === "") return { cls: "c-null", text: "(blank)" };
    return { cls: "c-text", text: escapeHtml(s) };
  }

  // Spreadsheet grid: column-letter row, name row, row-number gutter.
  function sheet(columns, rows, opts) {
    opts = opts || {};
    if (!columns || !columns.length) return `<div class="sheet-empty">No columns.</div>`;
    const names = columns.map((c, i) => {
      const ar = opts.sortCol === i ? `<span class="sort-ar">${opts.sortDir < 0 ? "▼" : "▲"}</span>` : "";
      const ci = opts.sortable ? ` data-ci="${i}"` : "";
      return `<th class="cn"${ci}>${escapeHtml(c)}${ar}</th>`;
    }).join("");
    const max = opts.limit || 200;
    const body = rows.slice(0, max).map((r, i) => {
      const tds = r.map((cell) => { const f = formatCell(cell); return `<td class="${f.cls}">${f.text}</td>`; }).join("");
      return `<tr><th class="rn">${i + 1}</th>${tds}</tr>`;
    }).join("");
    return `<div class="sheet-wrap"><table class="sheet">
      <thead><tr><th class="corner rn">#</th>${names}</tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }
  function pqToSheet(table) {
    const names = table.columns.map((c) => c.name);
    return sheet(names, table.rows.map((r) => names.map((n) => r[n])));
  }

  // Render a result grid whose columns sort when you click the header — the
  // spreadsheet move everyone reaches for.
  function mountResultGrid(container, columns, rows) {
    let col = -1, dir = 1;
    function draw() {
      let rws = rows;
      if (col >= 0) {
        rws = rows.slice().sort((a, b) => {
          const x = a[col], y = b[col];
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
          return (String(x).toLowerCase() > String(y).toLowerCase() ? 1 : -1) * dir;
        });
      }
      container.innerHTML = sheet(columns, rws, { sortCol: col, sortDir: dir, sortable: true });
      $$("thead .cn", container).forEach((th) => (th.onclick = () => {
        const i = +th.dataset.ci;
        if (col === i) dir = -dir; else { col = i; dir = 1; }
        draw();
      }));
    }
    draw();
  }

  const fmtNum = (n) => formatCell(n).text;
  const dlResult = (cols, rows, name) => LL.Export.download((name || "export") + ".csv", LL.Export.toCSV(cols, rows));
  const copyResult = (cols, rows) =>
    LL.Export.copy(LL.Export.toTSV(cols, rows))
      .then(() => toast("Copied — paste straight into Excel."))
      .catch(() => toast("Copy was blocked by the browser — use ⤓ CSV instead."));

  function datasetToPQ(def) {
    const tm = (t) => (/INT|REAL|NUM|DEC|FLOA|DOUB/i.test(t) ? "number" : "text");
    return { columns: def.columns.map((c) => ({ name: c.name, type: c.type ? tm(c.type) : "text" })), rows: def.rows.map((r) => ({ ...r })) };
  }
  function pqCtx() {
    if (PQ_CTX) return PQ_CTX;
    const tables = {};
    Object.keys(LL.DATASETS).forEach((n) => (tables[n] = datasetToPQ(LL.DATASETS[n])));
    PQ_CTX = { tables };
    return PQ_CTX;
  }
  function pqSourceOf(lesson) {
    if (!lesson || typeof lesson.source === "string")
      return datasetToPQ(LL.DATASETS[(lesson && lesson.source) || S.table]);
    return { columns: lesson.source.columns.map((c) => ({ ...c })), rows: lesson.source.rows.map((r) => ({ ...r })) };
  }

  // -------------------------------------------------------------- glossary
  const GLOSSARY = {
    SELECT: "Pick which columns to return.", FROM: "Names the table you're pulling from.",
    WHERE: "Keeps only rows that pass a test (a filter).", "GROUP BY": "Collapses rows that share a value — the rows of a pivot.",
    HAVING: "Like WHERE, but filters groups after GROUP BY.", "ORDER BY": "Sorts the result. DESC = largest first.",
    JOIN: "Stitches two tables together where a key matches (like VLOOKUP).", "LEFT JOIN": "A JOIN that keeps every left-table row even with no match.",
    "IS NULL": "True when a value is empty/missing.", TRIM: "Removes spaces from both ends of text.",
    UPPER: "Forces text to CAPITALS so values match.", LOWER: "Forces text to lowercase so values match.",
    REPLACE: "Swaps one piece of text for another (or deletes it).", CAST: "Converts text into a real number or date.",
    CASE: "SQL's IF / ELSE — map messy values to clean ones.", SUM: "Adds up a numeric column.", COUNT: "Counts rows.",
    DISTINCT: "Removes duplicate rows.", "Applied Steps": "Power Query's recorded list of transforms, run top to bottom.",
    Unpivot: "Turns columns (like months) into rows — makes wide data tall.", "Merge Queries": "Power Query's join — bring columns in from another table.",
    "Fill Down": "Copies the value above into blank cells below it.", "M code": "The language Power Query records your clicks into.",
    delimiter: "The character you split text on (a comma, dash, space…).",
  };
  function decorateGlossary(root) {
    $$("code", root).forEach((c) => {
      const key = Object.keys(GLOSSARY).find((k) => c.textContent.trim().toUpperCase() === k.toUpperCase());
      if (key) { c.classList.add("has-def"); c.title = GLOSSARY[key]; }
    });
  }
  function openJargon() {
    const rows = Object.keys(GLOSSARY).map((k) => `<dt><code>${escapeHtml(k)}</code></dt><dd>${GLOSSARY[k]}</dd>`).join("");
    const o = document.createElement("div");
    o.className = "modal-overlay";
    o.innerHTML = `<div class="sheet-modal"><div class="grabber"></div>
      <div class="sheet-head"><h2>Jargon buster</h2><button class="sheet-x" id="xJargon">✕</button></div>
      <p class="muted small">Plain English. Hover any <code class="has-def" title="like this">keyword</code> in a drill for the same note.</p>
      <dl class="glossary">${rows}</dl></div>`;
    o.addEventListener("click", (e) => { if (e.target === o || e.target.id === "xJargon") o.remove(); });
    document.body.appendChild(o);
  }

  // -------------------------------------------------------------- CSV import
  function openImport() {
    const o = document.createElement("div");
    o.className = "modal-overlay";
    o.innerHTML = `<div class="sheet-modal"><div class="grabber"></div>
      <div class="sheet-head"><h2>Import a CSV</h2><button class="sheet-x" id="xImp">✕</button></div>
      <p class="muted small">Drop in your own export and practice on real mess. It stays in your browser — nothing is uploaded.</p>
      <div class="imp-row">
        <label class="imp-field"><span>Table name</span><input id="impName" class="imp-input" placeholder="my_export" spellcheck="false"></label>
        <label class="imp-field"><span>Separator</span>
          <select id="impDelim" class="imp-input"><option value="auto">Auto-detect</option><option value=",">Comma</option><option value="tab">Tab</option><option value=";">Semicolon</option><option value="|">Pipe</option></select>
        </label>
      </div>
      <div class="imp-row">
        <label class="btn-tinted imp-file">Choose file…<input type="file" id="impFile" accept=".csv,.tsv,.txt,text/csv" hidden></label>
        <span class="muted small">or paste below</span>
      </div>
      <textarea id="impText" class="imp-text" spellcheck="false" placeholder="vendor,amount,status&#10;Acme Corp,&quot;$1,234.50&quot;,Open&#10;Globex LLC,(450.00),Overdue"></textarea>
      <div class="imp-foot">
        <span id="impStatus" class="muted small"></span>
        <span class="imp-actions"><button class="btn-plain" id="impCancel">Cancel</button><button class="btn-filled" id="impGo">Import</button></span>
      </div>
    </div>`;
    document.body.appendChild(o);
    const close = () => o.remove();
    const ta = $("#impText", o), nameI = $("#impName", o), delimI = $("#impDelim", o), status = $("#impStatus", o);
    const delimVal = () => { const v = delimI.value; return v === "auto" ? undefined : v === "tab" ? "\t" : v; };
    const detect = () => {
      const t = ta.value.trim();
      if (!t) { status.textContent = ""; return; }
      try { const d = LL.CSV.toTable(LL.CSV.parse(ta.value, delimVal())); status.textContent = `detected ${d.rows.length} row(s) × ${d.columns.length} col(s)`; status.className = "muted small"; }
      catch (e) { status.textContent = e.message; status.className = "small imp-err"; }
    };
    ta.addEventListener("input", detect);
    delimI.addEventListener("change", detect);
    $("#impFile", o).addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { ta.value = r.result; if (!nameI.value) nameI.value = f.name; detect(); };
      r.readAsText(f);
    });
    $("#xImp", o).onclick = close;
    $("#impCancel", o).onclick = close;
    o.addEventListener("click", (e) => { if (e.target === o) close(); });
    $("#impGo", o).onclick = () => {
      const res = doImport(ta.value, delimVal(), nameI.value);
      if (res.ok) close();
      else { status.textContent = res.error; status.className = "small imp-err"; }
    };
  }

  function doImport(text, delim, rawName) {
    if (!text || !text.trim()) return { ok: false, error: "Paste some data or choose a file first." };
    try {
      const def = LL.CSV.toTable(LL.CSV.parse(text, delim));
      const name = LL.CSV.sanitizeName(rawName || "imported", Object.keys(LL.DATASETS));
      LL.DB.addTable(name, def);
      PQ_CTX = null; // include the new table in the Power Query context
      persistTables();
      S.drill = null;
      buildExplorer();
      selectTable(name);
      return { ok: true, name };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  function dropImported(name) {
    LL.DB.dropTable(name);
    PQ_CTX = null; persistTables();
    if (S.table === name) S.table = Object.keys(LL.DATASETS)[0] || "vendors_raw";
    if (S.pqSourceName === name) { S.pqSourceName = S.table; S.pqSteps = []; }
    buildExplorer();
    renderWork();
    if (S.mode === "sql" && !S.drill) runSql();
  }

  // -------------------------------------------------------------- shell
  function renderShell() {
    document.getElementById("app").innerHTML = `
      <div class="ios">
        <aside class="sidebar">
          <div class="side-id">
            <div class="appicon">${APPICON}</div>
            <div class="side-name">Ledger Lab<span>clean data, beautifully</span></div>
          </div>
          <div class="list-section">
            <div class="list-header">Tables</div>
            <div class="list-group" id="tableList"></div>
            <button class="row-action" id="importBtn"><span class="ra-plus">+</span> Import a CSV…</button>
          </div>
          <div class="list-section">
            <div class="list-header">Drills <span id="drillCount"></span></div>
            <div id="drillList"></div>
          </div>
        </aside>
        <main class="detail">
          <div class="detail-bar">
            <div class="segmented" id="modeSeg" data-active="0">
              <div class="seg-ind"></div>
              <button class="seg" data-mode="sql">SQL</button>
              <button class="seg" data-mode="pq">Power Query</button>
              <button class="seg" data-mode="inspect">Inspect</button>
            </div>
            <div class="detail-actions">
              <span class="prog-pill" id="tbProg"></span>
              <button class="icon-btn" id="jargonBtn" title="Glossary">?</button>
              <button class="icon-btn" id="resetBtn" title="Reset progress">⟲</button>
            </div>
          </div>
          <div id="drillBar"></div>
          <div id="tool" class="tool"></div>
          <div class="statusbar" id="statusbar"></div>
        </main>
      </div>`;
    $("#jargonBtn").onclick = openJargon;
    $("#resetBtn").onclick = () => {
      localStorage.removeItem(PKEY);
      buildExplorer(); updateProg(); if (S.drill) renderDrillBar();
      toast("Progress reset.");
    };
    $("#importBtn").onclick = openImport;
    buildExplorer();
    renderWork();
    updateProg();
  }

  function updateProg() {
    const n = doneCount(), t = allDrills().length;
    $("#tbProg").textContent = `${n}/${t} drills`;
    const dc = $("#drillCount"); if (dc) dc.textContent = `${n}/${t}`;
  }

  function buildExplorer() {
    $("#tableList").innerHTML = Object.keys(LL.DATASETS).map((name) => {
      const cols = LL.DATASETS[name].columns.length, rws = LL.DATASETS[name].rows.length;
      const imported = LL.IMPORTED && LL.IMPORTED[name];
      return `<button class="list-row ${name === S.table ? "active" : ""}" data-table="${escapeHtml(name)}">
        <span class="lr-main"><span class="lr-title">${escapeHtml(name)}${imported ? ' <span class="lr-badge-img">mine</span>' : ""}</span><span class="lr-sub">${escapeHtml(LL.TABLE_NOTES[name] || "")}</span></span>
        <span class="lr-trail"><span class="lr-meta">${rws}×${cols}</span>${imported ? `<button class="lr-x" data-drop="${escapeHtml(name)}" title="Remove">✕</button>` : `<span class="chev">›</span>`}</span>
      </button>`;
    }).join("");
    $$("#tableList .list-row").forEach((li) => (li.onclick = () => selectTable(li.dataset.table)));
    $$("#tableList .lr-x").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); dropImported(b.dataset.drop); }));

    const group = (title, list, kind) => `<div class="list-subheader">${title}</div><div class="list-group">` + list.map((l, i) =>
      `<button class="list-row drill ${S.drill && S.drill.lesson.id === l.id ? "active" : ""} ${isDone(l.id) ? "done" : ""}" data-kind="${kind}" data-id="${l.id}">
        <span class="lr-badge">${isDone(l.id) ? "✓" : i + 1}</span>
        <span class="lr-main"><span class="lr-title">${escapeHtml(l.title)}</span><span class="lr-sub">${escapeHtml(l.tag)}</span></span>
        <span class="chev">›</span></button>`).join("") + `</div>`;
    $("#drillList").innerHTML = group("SQL", LL.SQL_LESSONS, "sql") + group("Power Query", LL.PQ_LESSONS, "pq");
    $$("#drillList .list-row").forEach((b) => (b.onclick = () => loadDrill(b.dataset.kind, b.dataset.id)));
  }

  function selectTable(name) {
    S.table = name;
    $$("#tableList .list-row").forEach((li) => li.classList.toggle("active", li.dataset.table === name));
    if (S.mode === "inspect") { renderInspect(); return; }
    if (S.mode === "sql") {
      S.sqlQuery = `SELECT * FROM ${name};`;
      const ed = $("#sqlEditor");
      if (S.drill && ed) { ed.value = S.sqlQuery; runSql(); } // peek without dropping the drill
      else { renderWork(); runSql(); }
      return;
    }
    // power query
    S.pqSourceName = name; S.pqSteps = []; S.drill = null;
    renderWork();
  }

  // -------------------------------------------------------------- work area
  function renderWork() {
    const seg = $("#modeSeg");
    if (seg) seg.dataset.active = S.mode === "sql" ? 0 : S.mode === "pq" ? 1 : 2;
    $$(".seg").forEach((t) => { t.classList.toggle("active", t.dataset.mode === S.mode); t.onclick = () => setMode(t.dataset.mode); });
    renderDrillBar();
    if (S.mode === "sql") renderSqlTool();
    else if (S.mode === "pq") renderPqTool();
    else renderInspect();
  }

  function setMode(m) {
    if (S.mode === m) return;
    S.mode = m;
    // A drill belongs to one mode; leaving that mode exits the drill.
    if (S.drill && S.drill.kind !== m) S.drill = null;
    buildExplorer();
    renderWork();
  }

  function renderDrillBar() {
    const bar = $("#drillBar");
    if (!S.drill) { bar.innerHTML = ""; bar.className = ""; return; }
    const l = S.drill.lesson;
    bar.className = "drillbar";
    bar.innerHTML = `
      <div class="db-top">
        <div class="db-goal"><span class="db-label">${S.drill.kind === "sql" ? "SQL" : "PQ"} drill</span> ${l.goal}</div>
        <div class="db-controls">
          <button class="btn-plain subtle" id="ctxBtn" title="Show the why">Why</button>
          <button class="btn-plain subtle" id="hintBtn">Hint</button>
          <button class="btn-plain subtle" id="solBtn">Solution</button>
          <button class="btn-plain" id="exitBtn" title="Back to free sandbox">Exit</button>
          <button class="btn-filled" id="checkBtn">Check</button>
        </div>
      </div>
      <div class="db-context" id="dbContext" hidden>
        <p>${l.scenario}</p>
        <div class="db-idea"><span class="db-label">The idea</span> ${l.teaches}</div>
        ${l.excel ? `<div class="db-excel"><span class="db-label">Excel → done-once</span> <em>${l.excel.from}</em> &nbsp;→&nbsp; ${l.excel.to}</div>` : ""}
      </div>
      <div class="db-hints" id="dbHints"></div>
      <div class="db-feedback" id="feedback"></div>`;
    let hints = 0;
    $("#exitBtn").onclick = exitDrill;
    $("#ctxBtn").onclick = () => { const c = $("#dbContext"); c.hidden = !c.hidden; };
    $("#hintBtn").onclick = () => {
      const box = $("#dbHints");
      if (hints >= l.hints.length) { box.insertAdjacentHTML("beforeend", `<div class="hint final">That's every hint — “Solution” will set it up so you can study it.</div>`); return; }
      box.insertAdjacentHTML("beforeend", `<div class="hint"><b>Hint ${hints + 1}</b> ${l.hints[hints++]}</div>`);
      decorateGlossary(box);
    };
    $("#checkBtn").onclick = () => (S.drill.kind === "sql" ? checkSqlDrill() : checkPqDrill());
    $("#solBtn").onclick = () => (S.drill.kind === "sql" ? showSqlSolution() : showPqSolution());
    decorateGlossary(bar);
  }

  function loadDrill(kind, id) {
    const lesson = (kind === "sql" ? LL.SQL_LESSONS : LL.PQ_LESSONS).find((l) => l.id === id);
    if (!lesson) return;
    S.drill = { kind, lesson };
    S.mode = kind;
    if (kind === "sql") { S.sqlQuery = lesson.starter; }
    else { S.pqSourceName = typeof lesson.source === "string" ? lesson.source : "Source"; S.pqSteps = []; }
    buildExplorer();
    renderWork(); // renderSqlTool shows a "your move" prompt for drills (no auto-run)
  }
  function exitDrill() {
    S.drill = null;
    buildExplorer();
    renderWork();
    if (S.mode === "sql") runSql();
  }

  // -------------------------------------------------------------- SQL tool
  function renderSqlTool() {
    $("#tool").innerHTML = `
      <div class="tool-inner">
        <div class="editor-card">
          <textarea id="sqlEditor" class="code-field" spellcheck="false" placeholder="SELECT * FROM vendors_raw;">${escapeHtml(S.sqlQuery)}</textarea>
          <div class="editor-foot">
            <span class="hint-text">⌘/Ctrl + Return to run · Tab indents</span>
            <button class="btn-filled" id="runBtn">Run</button>
          </div>
        </div>
        <div class="result-card card">
          <div class="card-head"><span class="card-title">Result <span class="muted">· tap a column to sort</span></span>
            <span class="card-actions"><button class="btn-soft" id="dlCsv">Export CSV</button><button class="btn-soft" id="cpRes">Copy</button></span></div>
          <div id="grid" class="grid"></div>
        </div>
      </div>`;
    const ed = $("#sqlEditor");
    $("#runBtn").onclick = runSql;
    $("#dlCsv").onclick = () => { if (S.lastSql && S.lastSql.values.length) dlResult(S.lastSql.columns, S.lastSql.values, S.table || "result"); else toast("Run a query first."); };
    $("#cpRes").onclick = () => { if (S.lastSql && S.lastSql.values.length) copyResult(S.lastSql.columns, S.lastSql.values); else toast("Run a query first."); };
    ed.addEventListener("input", () => (S.sqlQuery = ed.value));
    ed.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runSql(); }
      if (e.key === "Tab") { e.preventDefault(); const s = ed.selectionStart, en = ed.selectionEnd; ed.value = ed.value.slice(0, s) + "  " + ed.value.slice(en); ed.selectionStart = ed.selectionEnd = s + 2; S.sqlQuery = ed.value; }
    });
    // The free sandbox runs immediately so there's always data on screen. A
    // drill should NOT — leave the result blank so it's the learner who runs it.
    if (S.drill) {
      $("#grid").innerHTML = `<div class="sheet-empty">Write your query above, then press <strong>Run</strong> to see the result — or <strong>Check</strong> when you think it matches the goal.</div>`;
      setStatus("ready — your move");
    } else {
      runSql();
    }
  }

  function runSql() {
    const res = LL.DB.run(S.sqlQuery);
    const grid = $("#grid");
    if (!grid) return res;
    if (!res.ok) {
      grid.innerHTML = `<div class="errbox"><b>SQLite:</b> ${escapeHtml(res.error)}</div>`;
      S.lastSql = null;
      setStatus(`error`, true);
    } else {
      if (res.rowCount === 0) { grid.innerHTML = `<div class="sheet-empty">Query ran — 0 rows.</div>`; S.lastSql = { columns: res.columns, values: [] }; }
      else { mountResultGrid(grid, res.columns, res.values); S.lastSql = { columns: res.columns, values: res.values }; }
      setStatus(`${res.rowCount} row${res.rowCount === 1 ? "" : "s"} × ${res.columns.length} col · ${res.elapsedMs.toFixed(1)} ms`);
    }
    return res;
  }

  function checkSqlDrill() {
    const l = S.drill.lesson;
    const res = runSql();
    const fb = $("#feedback");
    if (!res.ok) { fb.className = "db-feedback bad"; fb.innerHTML = "Fix the error above, then Check again."; return; }
    let pass, reason;
    if (l.mode === "run") { pass = res.rowCount > 0; reason = "Run a query that returns the data."; }
    else { const g = LL.grade(res, LL.DB.run(l.solution), l.mode); pass = g.pass; reason = g.reason; }
    if (pass) {
      setDone(l.id); markDrillDone(l.id); updateProg();
      fb.className = "db-feedback good";
      fb.innerHTML = `<b>✓ Clean.</b> ${l.pro || "Nicely done."}`;
      decorateGlossary(fb);
    } else {
      fb.className = "db-feedback bad";
      fb.innerHTML = `Not yet — ${escapeHtml(reason || "compare your output to the goal.")}`;
    }
  }
  function showSqlSolution() {
    S.sqlQuery = S.drill.lesson.solution;
    const ed = $("#sqlEditor"); if (ed) ed.value = S.sqlQuery;
    runSql();
    const fb = $("#feedback"); fb.className = "db-feedback"; fb.innerHTML = `<span class="muted">Solution loaded — Run it, then read it line by line.</span>`;
  }

  // -------------------------------------------------------------- PQ tool
  function pqPalette() {
    if (S.drill) return S.drill.lesson.palette;
    return sandboxPalette(datasetToPQ(LL.DATASETS[S.pqSourceName]));
  }
  function pqSourceTable() {
    if (S.drill) return pqSourceOf(S.drill.lesson);
    return datasetToPQ(LL.DATASETS[S.pqSourceName]);
  }
  function pqSourceLabel() {
    return S.drill ? (typeof S.drill.lesson.source === "string" ? S.drill.lesson.source : "Source") : S.pqSourceName;
  }

  function renderPqTool() {
    const palette = pqPalette();
    const sourcePicker = S.drill
      ? `<code>${escapeHtml(pqSourceLabel())}</code>`
      : `<select id="pqTable" class="ios-select">${Object.keys(LL.DATASETS).map((t) => `<option ${t === S.pqSourceName ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    $("#tool").innerHTML = `
      <div class="tool-inner">
        <div class="card pq-source-card">
          <div class="pq-source-row"><label>Source</label> ${sourcePicker}</div>
          <div class="palette-label">Transform — tap to add a step</div>
          <div class="palette">${palette.map((b, i) => `<button class="pqstep" data-i="${i}">${escapeHtml(b.label)}</button>`).join("")}</div>
        </div>
        <div class="pq-columns">
          <div class="result-card card">
            <div class="card-head"><span class="card-title">Preview</span>
              <span class="card-actions"><button class="btn-soft" id="pqDl">Export CSV</button><button class="btn-soft" id="pqCopy">Copy</button><button class="btn-tinted" id="pqLoad">Load to table</button></span></div>
            <div id="grid" class="grid"></div>
          </div>
          <div class="applied-card card">
            <div class="card-title">Applied Steps</div>
            <ol id="applied" class="applied"></ol>
            <button class="btn-plain subtle" id="clearSteps">Clear steps</button>
          </div>
        </div>
        <details class="card mcard"><summary>M code — what Power Query records</summary><pre id="mcode" class="mcode"></pre></details>
      </div>`;
    if (!S.drill) $("#pqTable").onchange = (e) => { S.pqSourceName = e.target.value; S.pqSteps = []; renderPqTool(); };
    $$(".pqstep").forEach((btn) => (btn.onclick = () => { S.pqSteps.push(JSON.parse(JSON.stringify(palette[+btn.dataset.i].step))); pqRerender(); clearFeedback(); }));
    $("#clearSteps").onclick = () => { S.pqSteps = []; pqRerender(); clearFeedback(); };
    $("#pqDl").onclick = () => { const r = currentPqResult(); dlResult(r.columns.map((c) => c.name), r.rows.map((row) => r.columns.map((c) => row[c.name])), pqSourceLabel() + "_clean"); };
    $("#pqCopy").onclick = () => { const r = currentPqResult(); copyResult(r.columns.map((c) => c.name), r.rows.map((row) => r.columns.map((c) => row[c.name]))); };
    $("#pqLoad").onclick = pqLoadToTable;
    pqRerender();
  }

  function currentPqResult() {
    return LL.PQ.run(pqSourceTable(), S.pqSteps, pqCtx());
  }

  // Save the current Power Query output as a real table — usable by SQL too.
  function pqLoadToTable() {
    const r = currentPqResult();
    const def = {
      columns: r.columns.map((c) => ({ name: c.name, type: c.type === "number" ? "REAL" : "TEXT" })),
      rows: r.rows.map((row) => Object.assign({}, row)),
    };
    const name = LL.CSV.sanitizeName((S.drill ? pqSourceLabel() : S.pqSourceName) + "_clean", Object.keys(LL.DATASETS));
    LL.DB.addTable(name, def, "cleaned in Power Query · " + def.rows.length + " rows");
    PQ_CTX = null; persistTables();
    S.drill = null; S.mode = "sql"; S.table = name; S.pqSourceName = name; S.sqlQuery = `SELECT * FROM ${name};`;
    buildExplorer(); renderWork();
    toast(`Saved “${name}” — it's a real table now, query it in SQL.`);
  }

  function pqRerender() {
    const src = pqSourceTable();
    let result;
    try { result = LL.PQ.run(src, S.pqSteps, pqCtx()); } catch (_) { result = src; }
    $("#grid").innerHTML = pqToSheet(result);
    $("#mcode").textContent = LL.PQ.toM(pqSourceLabel(), S.pqSteps);
    $("#applied").innerHTML =
      `<li class="ap-src">Source <span class="muted">(${pqSourceLabel()})</span></li>` +
      S.pqSteps.map((s, i) => `<li class="ap-item"><span>${LL.PQ.OPS[s.op].m(s).label}</span><button class="ap-x" data-i="${i}">✕</button></li>`).join("");
    $$("#applied .ap-x").forEach((b) => (b.onclick = () => { S.pqSteps.splice(+b.dataset.i, 1); pqRerender(); clearFeedback(); }));
    setStatus(`${result.rows.length} row${result.rows.length === 1 ? "" : "s"} × ${result.columns.length} col · ${S.pqSteps.length} step${S.pqSteps.length === 1 ? "" : "s"}`);
  }

  function checkPqDrill() {
    const l = S.drill.lesson;
    const src = pqSourceOf(l);
    const expected = LL.PQ.run(src, l.solution, pqCtx());
    const result = LL.PQ.run(src, S.pqSteps, pqCtx());
    const fb = $("#feedback");
    if (S.pqSteps.length === 0) { fb.className = "db-feedback bad"; fb.innerHTML = "Add a step or two first, then Check."; return; }
    const g = LL.PQ.tablesEqual(result, expected, { orderMatters: l.mode === "ordered" });
    if (g.pass) {
      setDone(l.id); markDrillDone(l.id); updateProg();
      fb.className = "db-feedback good"; fb.innerHTML = `<b>✓ That's the shape.</b> ${l.pro}`;
      decorateGlossary(fb);
    } else { fb.className = "db-feedback bad"; fb.innerHTML = `Not yet — ${escapeHtml(g.reason)}`; }
  }
  function showPqSolution() {
    S.pqSteps = JSON.parse(JSON.stringify(S.drill.lesson.solution));
    pqRerender();
    const fb = $("#feedback"); fb.className = "db-feedback"; fb.innerHTML = `<span class="muted">Solution built — read the Applied Steps top-to-bottom.</span>`;
  }

  // -------------------------------------------------------------- sandbox palette
  function sandboxPalette(table) {
    const textCols = table.columns.filter((c) => c.type === "text").map((c) => c.name);
    const numCols = table.columns.filter((c) => c.type === "number").map((c) => c.name);
    const p = [];
    textCols.forEach((c) => { p.push({ label: `Trim · ${c}`, step: { op: "trim", columns: [c] } }); p.push({ label: `Capitalize · ${c}`, step: { op: "case", columns: [c], mode: "proper" } }); });
    if (textCols.length) { p.push({ label: `Remove duplicates · ${textCols[0]}`, step: { op: "removeDuplicates", columns: [textCols[0]] } }); p.push({ label: `Fill down · ${textCols[0]}`, step: { op: "fillDown", columns: [textCols[0]] } }); }
    numCols.forEach((c) => p.push({ label: `Sort ↓ · ${c}`, step: { op: "sort", column: c, dir: "desc" } }));
    if (textCols.length && numCols.length) p.push({ label: `Group ${textCols[0]} · Sum ${numCols[0]}`, step: { op: "group", by: [textCols[0]], aggregations: [{ column: numCols[0], fn: "sum", as: "total" }] } });
    if (numCols.length >= 3) p.push({ label: `Unpivot numbers (keep ${textCols[0] || table.columns[0].name})`, step: { op: "unpivot", keep: [textCols[0] || table.columns[0].name], attributeName: "Attribute", valueName: "Value" } });
    return p;
  }

  // -------------------------------------------------------------- misc ui
  function setStatus(text, isErr) {
    const sb = $("#statusbar");
    if (!sb) return;
    sb.className = "statusbar" + (isErr ? " err" : "");
    const modeLabel = S.mode === "sql" ? "SQL" : S.mode === "pq" ? "Power Query" : "Inspect";
    const right = S.mode === "inspect" ? "health check" : S.drill ? "drill: " + escapeHtml(S.drill.lesson.title) : "free sandbox";
    sb.innerHTML = `<span class="sb-mode">${modeLabel}</span><span class="sb-dot">·</span><span class="sb-main">${text}</span><span class="sb-right">${right}</span>`;
  }
  function clearFeedback() { const f = $("#feedback"); if (f) { f.className = "db-feedback"; f.innerHTML = ""; } }
  function markDrillDone(id) {
    const b = $(`.list-row[data-id="${id}"]`);
    if (b) { b.classList.add("done"); const n = b.querySelector(".lr-badge"); if (n) n.textContent = "✓"; }
  }

  // -------------------------------------------------------------- inspect
  function renderInspect() {
    const def = LL.DATASETS[S.table];
    const { stats, issues } = LL.Profile.audit(def);
    const profRows = stats.map((s) => {
      const range = s.min !== null ? `${fmtNum(s.min)} … ${fmtNum(s.max)}` : "";
      const summary = (s.sum !== null ? `Σ ${fmtNum(s.sum)}  ` : "") + range;
      const ex = s.samples.length ? s.samples.map((v) => escapeHtml(String(v))).join(", ") : "—";
      return `<tr>
        <th class="rn cnamecell">${escapeHtml(s.name)}</th>
        <td class="c-text">${s.type.toLowerCase()}</td>
        <td class="c-num">${s.total}</td>
        <td class="c-num ${s.blanks ? "c-neg" : ""}">${s.blanks}</td>
        <td class="c-num">${s.distinct}</td>
        <td class="c-num">${s.numericShare > 0 ? Math.round(s.numericShare * 100) + "%" : "—"}</td>
        <td class="c-text">${summary || "—"}</td>
        <td class="c-text insp-ex">${ex}</td>
      </tr>`;
    }).join("");
    const issuesHtml = issues.length
      ? issues.map((is, i) => `
        <div class="issue card sev-${is.severity}">
          <span class="issue-icon">${is.severity === "low" ? "i" : "!"}</span>
          <div class="issue-body">
            <div class="issue-head"><strong>${escapeHtml(is.title)}</strong><span class="issue-col">${escapeHtml(is.column)}</span></div>
            <p>${escapeHtml(is.detail)}</p>
          </div>
          ${is.fix ? `<button class="btn-tinted fix-btn" data-fix="${i}">${escapeHtml(is.fix.label)}</button>` : ""}
        </div>`).join("")
      : `<div class="all-clean card"><span class="big">✨</span>Nothing obvious to clean — this table looks tidy.</div>`;

    $("#tool").innerHTML = `
      <div class="inspect">
        <div class="insp-head">
          <div><div class="insp-kicker">Inspecting</div><div class="insp-title">${escapeHtml(S.table)}</div></div>
          <div class="muted small">${def.rows.length} rows × ${def.columns.length} cols · pick another table to inspect it</div>
        </div>
        <div class="insp-section-h">Column profile</div>
        <div class="card"><div class="sheet-wrap insp-prof"><table class="sheet"><thead>
          <tr><th class="corner rn">column</th><th class="cn">type</th><th class="cn">rows</th><th class="cn">blank</th><th class="cn">distinct</th><th class="cn">numeric</th><th class="cn">range / total</th><th class="cn">examples</th></tr>
        </thead><tbody>${profRows}</tbody></table></div></div>
        <div class="insp-section-h">Health check — ${issues.length} issue${issues.length === 1 ? "" : "s"} found</div>
        <div class="issues">${issuesHtml}</div>
      </div>`;
    setStatus(`${issues.length} issue${issues.length === 1 ? "" : "s"} · ${def.columns.length} columns profiled`);
    $$(".fix-btn").forEach((b) => (b.onclick = () => applyFix(issues[+b.dataset.fix].fix)));
  }

  function applyFix(fix) {
    if (!fix) return;
    S.drill = null; S.mode = "pq"; S.pqSourceName = S.table; S.pqSteps = JSON.parse(JSON.stringify(fix.steps));
    renderWork();
    toast(`Applied “${fix.label}”. Tweak it, then ⤓ CSV or load it to a table.`);
  }

  // -------------------------------------------------------------- persistence + toast
  const TKEY = "ledgerlab.tables.v1";
  function persistTables() {
    try {
      const store = {};
      Object.keys(LL.IMPORTED || {}).forEach((n) => { if (LL.DATASETS[n]) store[n] = { def: LL.DATASETS[n], note: LL.TABLE_NOTES[n] }; });
      const s = JSON.stringify(store);
      if (s.length > 4000000) { toast("That table's too big to keep across reloads — it stays for this session."); return; }
      localStorage.setItem(TKEY, s);
    } catch (_) {}
  }
  function restoreTables() {
    try {
      const store = JSON.parse(localStorage.getItem(TKEY) || "{}");
      Object.keys(store).forEach((n) => { try { LL.DB.addTable(n, store[n].def, store[n].note); } catch (_) {} });
    } catch (_) {}
  }
  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // -------------------------------------------------------------- boot
  async function boot() {
    document.getElementById("app").innerHTML = `<div class="boot"><span class="appicon">${APPICON}</span><p>Starting your in-browser database…</p></div>`;
    try { await LL.DB.init(); }
    catch (err) {
      document.getElementById("app").innerHTML = `<div class="boot err"><h2>Couldn't start the SQL engine</h2><p>${escapeHtml(err.message)}</p>
        <p class="muted">Make sure the <code>lib/</code> folder sits next to index.html. <button class="btn-filled" onclick="location.reload()">Try again</button></p></div>`;
      return;
    }
    restoreTables();
    renderShell();
  }
  document.addEventListener("DOMContentLoaded", boot);
})(window.LL = window.LL || {});
