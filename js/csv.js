/* =============================================================================
   Ledger Lab — CSV / TSV import
   -----------------------------------------------------------------------------
   A small RFC-4180-ish parser (handles quoted fields, embedded commas/newlines,
   and "" escapes) plus light type inference, so an accountant can drop in their
   own export and practice on real mess. Numbers that arrive wrapped in $ signs,
   commas, or parentheses stay TEXT on purpose — that's the stuff worth cleaning.
   ============================================================================= */
(function (LL) {
  "use strict";

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const counts = { ",": 0, "\t": 0, ";": 0, "|": 0 };
    let inQ = false;
    for (const ch of firstLine) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && counts.hasOwnProperty(ch)) counts[ch]++;
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ",";
  }

  // Parse delimited text into an array of row-arrays.
  function parse(text, delim) {
    text = text.replace(/^﻿/, ""); // strip BOM
    delim = delim || detectDelimiter(text);
    const rows = [];
    let row = [], field = "", inQ = false, i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += ch; i++;
    }
    row.push(field);
    rows.push(row);
    // Drop a trailing empty line.
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
    return rows;
  }

  const INT_RE = /^-?\d{1,15}$/;
  const NUM_RE = /^-?\d*\.\d+$|^-?\d+\.?\d*$/;

  // Turn raw rows (first row = header) into a dataset definition with inferred
  // column types and converted values.
  function toTable(rawRows) {
    if (!rawRows || rawRows.length < 1) throw new Error("Nothing to import — no rows found.");
    const header = rawRows[0].map((h, i) => {
      const name = String(h || "").trim();
      return name || `column_${i + 1}`;
    });
    // De-duplicate column names.
    const seen = {};
    const names = header.map((name) => {
      if (seen[name] === undefined) { seen[name] = 0; return name; }
      seen[name]++; return `${name}_${seen[name]}`;
    });
    const data = rawRows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
    if (data.length === 0) throw new Error("Found a header but no data rows.");

    const types = names.map((_, col) => {
      let sawValue = false, allInt = true, allNum = true;
      for (const r of data) {
        const v = (r[col] === undefined ? "" : String(r[col])).trim();
        if (v === "") continue;
        sawValue = true;
        if (!INT_RE.test(v)) allInt = false;
        if (!NUM_RE.test(v)) allNum = false;
        if (!allInt && !allNum) break;
      }
      if (!sawValue) return "TEXT";
      return allInt ? "INTEGER" : allNum ? "REAL" : "TEXT";
    });

    const columns = names.map((name, i) => ({ name, type: types[i] }));
    const rows = data.map((r) => {
      const obj = {};
      names.forEach((name, i) => {
        const raw = r[i] === undefined ? "" : String(r[i]);
        const v = raw.trim();
        if (v === "") obj[name] = null;
        else if (types[i] === "TEXT") obj[name] = raw;
        else obj[name] = Number(v);
      });
      return obj;
    });
    return { columns, rows };
  }

  function sanitizeName(raw, taken) {
    let name = String(raw || "").replace(/\.[^.]+$/, ""); // drop extension
    name = name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!name) name = "imported";
    if (/^\d/.test(name)) name = "t_" + name;
    let candidate = name, k = 1;
    while (taken && taken.indexOf(candidate) >= 0) candidate = `${name}_${k++}`;
    return candidate;
  }

  LL.CSV = { parse, detectDelimiter, toTable, sanitizeName };
})(window.LL = window.LL || {});
