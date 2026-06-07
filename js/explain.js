/* =============================================================================
   Ledger Lab — plain-English SQL explainer
   -----------------------------------------------------------------------------
   Turns a SELECT query into a friendly, clause-by-clause description for a
   non-technical reader. Rule based (no API), tuned for the single-SELECT shapes
   this app teaches: filters, joins, group-by pivots, text cleanup, CASE, CTEs.
   LL.explainSQL(sql) -> { summary, steps:[htmlString] }
   ============================================================================= */
(function (LL) {
  "use strict";

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const col = (s) => `<b>${esc(String(s).trim().replace(/^[A-Za-z_]\w*\./, ""))}</b>`;

  function splitTopLevel(s, sep) {
    sep = sep || ",";
    const out = [];
    let depth = 0, inStr = false, cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { cur += ch; if (ch === "'") inStr = false; continue; }
      if (ch === "'") { inStr = true; cur += ch; continue; }
      if (ch === "(") { depth++; cur += ch; continue; }
      if (ch === ")") { depth--; cur += ch; continue; }
      if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function splitClauses(q) {
    const KW = [["select", /^select\b/i], ["from", /^from\b/i], ["where", /^where\b/i],
      ["group", /^group\s+by\b/i], ["having", /^having\b/i], ["order", /^order\s+by\b/i], ["limit", /^limit\b/i]];
    let depth = 0, inStr = false;
    const pos = [];
    for (let i = 0; i < q.length; i++) {
      const ch = q[i];
      if (inStr) { if (ch === "'") inStr = false; continue; }
      if (ch === "'") { inStr = true; continue; }
      if (ch === "(") { depth++; continue; }
      if (ch === ")") { depth--; continue; }
      if (depth !== 0) continue;
      if (i > 0 && /\w/.test(q[i - 1])) continue;
      const rest = q.slice(i);
      for (const [name, re] of KW) { const m = rest.match(re); if (m) { pos.push({ name, start: i, len: m[0].length }); break; } }
    }
    const parts = {};
    for (let k = 0; k < pos.length; k++) {
      const p = pos[k], next = pos[k + 1];
      parts[p.name] = q.slice(p.start + p.len, next ? next.start : q.length).trim();
    }
    return parts;
  }

  function tableRef(s) {
    const m = s.trim().match(/^([A-Za-z_]\w*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/i);
    return m ? { name: m[1], alias: m[2] || "" } : { name: s.trim(), alias: "" };
  }
  function parseFrom(f) {
    const joinRe = /\b(LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|JOIN)\b/gi;
    const first = f.search(joinRe);
    const base = tableRef((first >= 0 ? f.slice(0, first) : f).trim());
    const joins = [];
    if (first >= 0) {
      const rest = f.slice(first);
      const ms = [];
      let m; joinRe.lastIndex = 0;
      while ((m = joinRe.exec(rest))) ms.push({ kw: m[1], idx: m.index });
      for (let j = 0; j < ms.length; j++) {
        const cur = ms[j], nx = ms[j + 1];
        const seg = rest.slice(cur.idx + cur.kw.length, nx ? nx.idx : rest.length).trim();
        const onM = seg.match(/\bON\b([\s\S]+)$/i);
        const tref = tableRef((onM ? seg.slice(0, onM.index) : seg).trim());
        joins.push({ left: /LEFT/i.test(cur.kw), name: tref.name, alias: tref.alias, on: onM ? onM[1].trim() : "" });
      }
    }
    return { base, joins };
  }

  // Describe a (possibly nested) text-cleanup expression naturally.
  function describeArg(x) {
    x = x.trim();
    let m;
    if ((m = x.match(/^TRIM\((.+)\)$/i))) return `${describeArg(m[1])}, spaces trimmed`;
    if ((m = x.match(/^UPPER\((.+)\)$/i))) return `${describeArg(m[1])}, in capitals`;
    if ((m = x.match(/^LOWER\((.+)\)$/i))) return `${describeArg(m[1])}, in lowercase`;
    return col(x);
  }

  function describeColumn(eRaw) {
    let e = eRaw.trim(), alias = "";
    const am = e.match(/\s+AS\s+([A-Za-z_]\w*)\s*$/i);
    if (am) { alias = am[1]; e = e.slice(0, am.index).trim(); }
    let d, m;
    if (e === "*") d = "every column";
    else if (/^[A-Za-z_]\w*\.\*$/.test(e)) d = `every column from <b>${esc(e.split(".")[0])}</b>`;
    else if (/^COUNT\(\s*\*\s*\)$/i.test(e)) d = "a count of the rows";
    else if ((m = e.match(/^SUM\((.+)\)$/i))) d = `the total of ${col(m[1])}`;
    else if ((m = e.match(/^COUNT\((.+)\)$/i))) d = `a count of ${col(m[1])}`;
    else if ((m = e.match(/^AVG\((.+)\)$/i))) d = `the average ${col(m[1])}`;
    else if ((m = e.match(/^MIN\((.+)\)$/i))) d = `the smallest ${col(m[1])}`;
    else if ((m = e.match(/^MAX\((.+)\)$/i))) d = `the largest ${col(m[1])}`;
    else if (/^(TRIM|UPPER|LOWER)\(.+\)$/i.test(e)) d = describeArg(e);
    else if (/^CASE\b/i.test(e)) d = "a label chosen by a set of rules (a CASE)";
    else if (/julianday/i.test(e)) d = "a number of days (a date calculation)";
    else if (/^CAST\(/i.test(e) || /^REPLACE\(/i.test(e)) d = "a cleaned-up value (text turned into a real number)";
    else if ((m = e.match(/^COALESCE\(([^,]+),(.+)\)$/i))) d = `${col(m[1])}, or ${col(m[2])} when it is empty`;
    else d = col(e);
    return d + (alias ? ` (shown as <b>${esc(alias)}</b>)` : "");
  }

  function humanize(cond) {
    let s = " " + cond + " ";
    s = s.replace(/\s+IS\s+NOT\s+NULL\s+/gi, " is not empty ")
      .replace(/\s+IS\s+NULL\s+/gi, " is empty ")
      .replace(/\s*<>\s*/g, " is not ").replace(/\s*!=\s*/g, " is not ")
      .replace(/\s*>=\s*/g, " is at least ").replace(/\s*<=\s*/g, " is at most ")
      .replace(/\s*=\s*/g, " is ").replace(/\s*>\s*/g, " is more than ").replace(/\s*<\s*/g, " is less than ")
      .replace(/\s+AND\s+/gi, " and ").replace(/\s+OR\s+/gi, " or ").replace(/\s+LIKE\s+/gi, " looks like ");
    s = s.replace(/\b[A-Za-z_]\w*\.([A-Za-z_]\w*)/g, "$1");
    return s.replace(/\s+/g, " ").trim();
  }

  function describeOrder(o) {
    const cols = splitTopLevel(o).map((c) => {
      const m = c.trim().match(/^([\s\S]+?)(?:\s+(ASC|DESC))?$/i);
      const dir = m[2] && /DESC/i.test(m[2]) ? "highest first" : "lowest first";
      return `${col(m[1])} (${dir})`;
    });
    return "Sorts the result by " + cols.join(", then ") + ".";
  }

  function summary(C, hasAgg) {
    if (C.group && hasAgg) return "This summarizes your data by group, much like a PivotTable.";
    if (C.from && /\bJOIN\b/i.test(C.from)) return "This combines two tables and lists the rows that match.";
    if (hasAgg) return "This calculates a single summary figure.";
    if (C.group) return "This groups your rows together.";
    if (C.where) return "This filters the table down to the rows you care about.";
    return "This lists rows from the table.";
  }

  function explainSQL(sql) {
    let q = String(sql || "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").trim().replace(/;+\s*$/, "");
    if (!q) return { summary: "There is no query to explain yet.", steps: [] };
    const steps = [];
    const cte = q.match(/^WITH\s+([A-Za-z_]\w*)\s+AS\s*\(([\s\S]+)\)\s*(SELECT[\s\S]+)$/i);
    if (cte) { steps.push(`First it builds a temporary staging table called <b>${esc(cte[1])}</b> from a sub-query, then works with that below.`); q = cte[3]; }
    if (!/^SELECT/i.test(q)) return { summary: "This is not a standard SELECT, so here is the raw statement.", steps: [`<code>${esc(q)}</code>`] };

    const C = splitClauses(q);
    const hasAgg = /\b(SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(C.select || "");

    if (C.from) {
      const { base, joins } = parseFrom(C.from);
      if (base.name) steps.push(`Reads from the <b>${esc(base.name)}</b> table.`);
      joins.forEach((j) => {
        const how = j.left
          ? `Keeps every row and brings in matching details from <b>${esc(j.name)}</b>`
          : `Matches each row to <b>${esc(j.name)}</b> and brings its columns alongside`;
        let onTxt = "";
        if (j.on) {
          const k = j.on.match(/^(?:\w+\.)?(\w+)\s*=\s*(?:\w+\.)?(\w+)$/);
          onTxt = k && k[1] === k[2] ? `, matching on <b>${esc(k[1])}</b>` : `, lined up where ${esc(humanize(j.on))}`;
        }
        steps.push(`${how}${onTxt}.`);
      });
    }
    if (C.where) steps.push(`Keeps only the rows where ${esc(humanize(C.where))}.`);
    if (C.group) steps.push(`Groups the rows by ${splitTopLevel(C.group).map(col).join(" and ")}, so you get one row per group.`);
    if (C.select) steps.push(describeSelect(C.select));
    if (C.having) steps.push(`Then keeps only the groups where ${esc(humanize(C.having))}.`);
    if (C.order) steps.push(describeOrder(C.order));
    if (C.limit) steps.push(`Shows only the first <b>${esc(C.limit)}</b> rows.`);

    return { summary: summary(C, hasAgg), steps };
  }

  function describeSelect(sel) {
    let distinct = false, s = sel;
    if (/^DISTINCT\b/i.test(s)) { distinct = true; s = s.replace(/^DISTINCT\b/i, "").trim(); }
    const cols = splitTopLevel(s).map(describeColumn);
    const body = cols.length === 1 ? cols[0] : cols.slice(0, -1).join("; ") + "; and " + cols[cols.length - 1];
    return (distinct ? "Returns the unique combinations of: " : "Returns: ") + body + ".";
  }

  LL.explainSQL = explainSQL;
})(window.LL = window.LL || {});
