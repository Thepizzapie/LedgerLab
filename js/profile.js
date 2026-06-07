/* =============================================================================
   Ledger Lab — column profiler + data-health audit
   -----------------------------------------------------------------------------
   The thing pros do before touching anything: look at the data's shape and
   smell out problems. columnStats() summarizes every column; audit() runs
   heuristics for the classic accounting-data messes and, where it can, hands
   back a ready-made Power Query fix.
   ============================================================================= */
(function (LL) {
  "use strict";

  const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";
  const num = (v) => (typeof v === "number" ? v : LL.PQ.parseNumber(v));

  function columnStats(def) {
    return def.columns.map((col) => {
      const name = col.name;
      const vals = def.rows.map((r) => r[name]);
      const nonblank = vals.filter((v) => !isBlank(v));
      const blanks = vals.length - nonblank.length;
      const distinct = new Set(nonblank.map((v) => String(v))).size;
      const nums = nonblank.map(num).filter((n) => n !== null && !isNaN(n));
      const numericShare = nonblank.length ? nums.length / nonblank.length : 0;
      let min = null, max = null, sum = null;
      if (nums.length) { min = Math.min(...nums); max = Math.max(...nums); sum = nums.reduce((a, b) => a + b, 0); }
      const samples = [];
      const seen = new Set();
      for (let i = 0; i < vals.length && samples.length < 3; i++) {
        if (isBlank(vals[i])) continue;
        const s = String(vals[i]);
        if (!seen.has(s)) { seen.add(s); samples.push(vals[i]); }
      }
      return { name, type: (col.type || "TEXT").toUpperCase(), total: vals.length, blanks, distinct, numericShare, min, max, sum, samples };
    });
  }

  // Column names that are really identifiers/codes — numeric-looking, but you
  // should NOT convert them to numbers (you'd lose leading zeros / meaning).
  const ID_NAME = /(^|_)(id|code|acct|account|zip|postal|phone|fax|ssn|ein|no|num|number|ref|sku|invoice|inv)(_|$)/i;

  const DATE_PATS = [
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/,
    /^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/,
  ];

  function audit(def) {
    const stats = columnStats(def);
    const byName = {};
    stats.forEach((s) => (byName[s.name] = s));
    const issues = [];

    def.columns.forEach((col) => {
      const name = col.name;
      const isText = (col.type || "TEXT").toUpperCase() === "TEXT";
      const vals = def.rows.map((r) => r[name]);
      const nonblank = vals.filter((v) => !isBlank(v));
      const st = byName[name];
      if (!isText || nonblank.length === 0) {
        if (st.blanks > 0) blankIssue(issues, name, st, vals, isText);
        return;
      }

      // leading/trailing spaces
      const ws = vals.filter((v) => typeof v === "string" && v.trim() !== "" && v !== v.trim()).length;
      if (ws > 0)
        issues.push(mk("med", name, "Stray spaces",
          `${ws} value(s) in ${name} have leading or trailing spaces — enough to break a lookup or split a total in two.`,
          "Trim in Power Query", [{ op: "trim", columns: [name] }]));

      // case/spacing variants of the same thing
      const keyMap = {};
      nonblank.forEach((v) => { const k = String(v).trim().toLowerCase(); (keyMap[k] = keyMap[k] || new Set()).add(String(v)); });
      const variantGroups = Object.keys(keyMap).filter((k) => keyMap[k].size > 1).length;
      if (variantGroups > 0)
        issues.push(mk("med", name, "Inconsistent spelling",
          `${variantGroups} group(s) in ${name} are the same value written differently (case or spacing). They won't group or match until standardized.`,
          "Standardize (Trim + Capitalize)", [{ op: "trim", columns: [name] }, { op: "case", columns: [name], mode: "proper" }]));

      // numbers stored as text (but not for identifier/code columns)
      if (st.numericShare >= 0.7 && !ID_NAME.test(name))
        issues.push(mk("high", name, "Numbers stored as text",
          `${Math.round(st.numericShare * 100)}% of ${name} looks numeric but is stored as text — you can't SUM it until it's converted.`,
          "Change Type to Number", [{ op: "changeType", column: name, type: "number" }]));

      // mixed date formats
      const patCounts = DATE_PATS.map((p) => nonblank.filter((v) => p.test(String(v).trim())).length);
      const present = patCounts.filter((c) => c > 0).length;
      const covered = patCounts.reduce((a, b) => a + b, 0);
      if (present >= 2 && covered / nonblank.length >= 0.6)
        issues.push(mk("high", name, "Mixed date formats",
          `${name} mixes more than one date format — it won't sort or filter as a date until unified.`,
          "Change Type to Date", [{ op: "changeType", column: name, type: "date" }]));

      if (st.blanks > 0) blankIssue(issues, name, st, vals, isText);
    });

    // exact duplicate rows
    const seen = {};
    let dups = 0;
    def.rows.forEach((r) => {
      const k = def.columns.map((c) => String(r[c.name])).join("␟");
      if (seen[k]) dups++; else seen[k] = 1;
    });
    if (dups > 0)
      issues.push(mk("high", "(rows)", "Duplicate rows",
        `${dups} row(s) are exact duplicates of another row.`,
        "Remove Duplicates", [{ op: "removeDuplicates" }]));

    const order = { high: 0, med: 1, low: 2 };
    issues.sort((a, b) => order[a.severity] - order[b.severity]);
    return { stats, issues };
  }

  function blankIssue(issues, name, st, vals, isText) {
    let fillable = false, prev = null;
    for (let i = 0; i < vals.length; i++) {
      if (isBlank(vals[i])) { if (prev !== null) fillable = true; }
      else prev = vals[i];
    }
    if (isText && fillable)
      issues.push(mk("med", name, "Blank cells",
        `${st.blanks} blank cell(s) in ${name} — looks like repeated labels were left empty (merged-cell style).`,
        "Fill Down", [{ op: "fillDown", columns: [name] }]));
    else
      issues.push(mk("low", name, "Blank cells", `${st.blanks} blank cell(s) in ${name}.`, null, null));
  }

  function mk(severity, column, title, detail, fixLabel, steps) {
    return { severity, column, title, detail, fix: steps ? { label: fixLabel, steps } : null };
  }

  LL.Profile = { columnStats, audit };
})(window.LL = window.LL || {});
