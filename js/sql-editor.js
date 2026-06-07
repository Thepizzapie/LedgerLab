/* =============================================================================
   Ledger Lab — SQL editor component
   -----------------------------------------------------------------------------
   A real code editor in vanilla JS: syntax highlighting (a transparent textarea
   over a highlighted <pre>), a line-number gutter, and autocomplete for tables,
   columns, and keywords. LL.makeSqlEditor(host, { value, onChange, onRun }).
   ============================================================================= */
(function (LL) {
  "use strict";

  const KEYWORDS = [
    "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "JOIN", "LEFT JOIN", "RIGHT JOIN",
    "INNER JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "ON", "AS", "AND", "OR", "NOT",
    "NULL", "IS", "IN", "LIKE", "BETWEEN", "DISTINCT", "ALL", "UNION", "WITH", "CASE", "WHEN", "THEN",
    "ELSE", "END", "LIMIT", "OFFSET", "ASC", "DESC", "EXISTS", "COUNT", "SUM", "AVG", "MIN", "MAX",
    "CAST", "COALESCE", "TRIM", "UPPER", "LOWER", "REPLACE", "SUBSTR", "ROUND", "ABS", "LENGTH",
    "INSTR", "IFNULL", "NULLIF", "STRFTIME", "JULIANDAY", "DATE", "INTEGER", "REAL", "TEXT", "BY",
  ];
  const KWSET = new Set();
  KEYWORDS.forEach((k) => k.split(" ").forEach((w) => KWSET.add(w.toUpperCase())));

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const span = (cls, txt) => `<span class="${cls}">${esc(txt)}</span>`;

  function highlight(code) {
    let out = "", m;
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_]+)/g;
    while ((m = re.exec(code))) {
      if (m[1]) out += span("t-cmt", m[1]);
      else if (m[2] != null) out += span("t-str", m[2]);
      else if (m[3]) out += span("t-num", m[3]);
      else if (m[4]) out += KWSET.has(m[4].toUpperCase()) ? span("t-kw", m[4]) : span("t-id", m[4]);
      else if (m[5]) out += esc(m[5]);
      else if (m[6]) out += span("t-op", m[6]);
    }
    return out;
  }

  // Pixel position of the caret inside a textarea (mirror-div technique).
  function caretXY(ta) {
    const div = document.createElement("div");
    const st = getComputedStyle(ta);
    ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop",
      "paddingLeft", "paddingRight", "paddingBottom", "borderLeftWidth", "borderTopWidth",
      "boxSizing", "tabSize"].forEach((p) => (div.style[p] = st[p]));
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre";
    div.style.overflow = "hidden";
    div.style.width = ta.clientWidth + "px";
    div.textContent = ta.value.slice(0, ta.selectionStart);
    const mark = document.createElement("span");
    mark.textContent = "​";
    div.appendChild(mark);
    ta.parentElement.appendChild(div);
    const x = mark.offsetLeft - ta.scrollLeft;
    const y = mark.offsetTop - ta.scrollTop;
    div.remove();
    return { x, y, lh: parseFloat(st.lineHeight) || 20 };
  }

  function makeSqlEditor(host, opts) {
    opts = opts || {};
    host.classList.add("sqled");
    host.innerHTML = `
      <div class="sqled-gutter" aria-hidden="true"></div>
      <div class="sqled-wrap">
        <pre class="sqled-hl"><code></code></pre>
        <textarea class="sqled-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>
        <div class="sqled-ac" hidden></div>
      </div>`;
    const ta = host.querySelector(".sqled-ta");
    const codeEl = host.querySelector(".sqled-hl code");
    const hl = host.querySelector(".sqled-hl");
    const gutter = host.querySelector(".sqled-gutter");
    const ac = host.querySelector(".sqled-ac");
    ta.value = opts.value || "";
    let items = [], active = -1, tokenStart = 0;

    function refresh() {
      const v = ta.value;
      codeEl.innerHTML = highlight(v);
      const n = v.split("\n").length;
      let g = "";
      for (let i = 1; i <= n; i++) g += i + "\n";
      gutter.textContent = g;
      sync();
    }
    function sync() { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; }
    function emit() { if (opts.onChange) opts.onChange(ta.value); }
    function insertText(t) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + t + ta.value.slice(e);
      ta.selectionStart = ta.selectionEnd = s + t.length;
      refresh(); emit();
    }

    ta.addEventListener("input", () => { refresh(); emit(); updateAC(); });
    ta.addEventListener("scroll", sync);
    ta.addEventListener("blur", () => setTimeout(closeAC, 120));
    ta.addEventListener("keydown", (e) => {
      if (!ac.hidden) {
        if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); renderAC(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); renderAC(); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); accept(); return; }
        if (e.key === "Escape") { e.preventDefault(); closeAC(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (opts.onRun) opts.onRun(); return; }
      if (e.key === "Tab") { e.preventDefault(); insertText("  "); }
    });

    function schema() { try { return LL.DB.schema(); } catch (_) { return []; } }
    function aliasMap() {
      const map = {}, re = /\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)\s+(?:AS\s+)?([A-Za-z_]\w*)/gi;
      let m; while ((m = re.exec(ta.value))) map[m[2].toLowerCase()] = m[1].toLowerCase();
      return map;
    }
    function updateAC() {
      const pos = ta.selectionStart, before = ta.value.slice(0, pos);
      const lineStart = before.lastIndexOf("\n") + 1;
      if (before.slice(lineStart).indexOf("--") >= 0) return closeAC();
      if ((before.match(/'/g) || []).length % 2 === 1) return closeAC();
      const tk = before.match(/[\w.]*$/)[0];
      if (tk.length < 1) return closeAC();
      tokenStart = pos - tk.length;
      const sc = schema();
      let sug = [];
      if (tk.indexOf(".") >= 0) {
        const pfx = tk.slice(0, tk.lastIndexOf(".")).toLowerCase();
        const partial = tk.slice(tk.lastIndexOf(".") + 1).toLowerCase();
        const tbl = aliasMap()[pfx] || pfx;
        const t = sc.find((x) => x.name.toLowerCase() === tbl);
        if (t) sug = t.columns.filter((c) => c.name.toLowerCase().startsWith(partial)).map((c) => ({ label: c.name, kind: "col", detail: c.type.toLowerCase() }));
        tokenStart = pos - partial.length;
      } else {
        const low = tk.toLowerCase();
        const tables = sc.filter((t) => t.name.toLowerCase().startsWith(low)).map((t) => ({ label: t.name, kind: "table" }));
        const cols = new Map();
        sc.forEach((t) => t.columns.forEach((c) => { if (c.name.toLowerCase().startsWith(low) && !cols.has(c.name)) cols.set(c.name, { label: c.name, kind: "col", detail: c.type.toLowerCase() }); }));
        const kws = KEYWORDS.filter((k) => k.toLowerCase().startsWith(low)).map((k) => ({ label: k, kind: "kw" }));
        sug = tables.concat(Array.from(cols.values())).concat(kws);
      }
      sug = sug.slice(0, 9);
      if (!sug.length) return closeAC();
      items = sug; active = 0; renderAC();
    }
    function renderAC() {
      ac.innerHTML = items.map((it, i) =>
        `<div class="ac-item${i === active ? " active" : ""}" data-i="${i}"><span class="ac-kind ac-${it.kind}">${it.kind === "kw" ? "K" : it.kind === "table" ? "T" : "C"}</span><span class="ac-label">${esc(it.label)}</span>${it.detail ? `<span class="ac-detail">${esc(it.detail)}</span>` : ""}</div>`).join("");
      ac.hidden = false;
      const { x, y, lh } = caretXY(ta);
      ac.style.left = Math.max(2, x) + "px";
      ac.style.top = (y + lh + 3) + "px";
      Array.from(ac.children).forEach((el) => (el.onmousedown = (e) => { e.preventDefault(); active = +el.dataset.i; accept(); }));
    }
    function accept() {
      const it = items[active];
      if (!it) return closeAC();
      const pos = ta.selectionStart;
      ta.value = ta.value.slice(0, tokenStart) + it.label + ta.value.slice(pos);
      const np = tokenStart + it.label.length;
      ta.selectionStart = ta.selectionEnd = np;
      closeAC(); refresh(); emit(); ta.focus();
    }
    function closeAC() { ac.hidden = true; items = []; active = -1; }

    refresh();
    return {
      getValue: () => ta.value,
      setValue: (v) => { ta.value = v; closeAC(); refresh(); emit(); },
      focus: () => ta.focus(),
      insert: (t) => { ta.focus(); insertText(t); },
    };
  }

  LL.makeSqlEditor = makeSqlEditor;
})(window.LL = window.LL || {});
