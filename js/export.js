/* =============================================================================
   Ledger Lab — export
   -----------------------------------------------------------------------------
   Turn a result grid (column names + row arrays) back into a CSV/TSV the user
   can download or paste into Excel. Closes the loop: import messy → clean →
   take the clean version with you.
   ============================================================================= */
(function (LL) {
  "use strict";

  function cell(v, delim) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.indexOf('"') >= 0 || s.indexOf(delim) >= 0 || s.indexOf("\n") >= 0 || s.indexOf("\r") >= 0)
      return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toDelimited(columns, rows, delim) {
    const head = columns.map((c) => cell(c, delim)).join(delim);
    const body = rows.map((r) => r.map((c) => cell(c, delim)).join(delim)).join("\r\n");
    return head + "\r\n" + body;
  }
  const toCSV = (columns, rows) => toDelimited(columns, rows, ",");
  const toTSV = (columns, rows) => toDelimited(columns, rows, "\t");

  function download(filename, text) {
    const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  LL.Export = { toCSV, toTSV, download, copy };
})(window.LL = window.LL || {});
