/* =============================================================================
   Ledger Lab — Power Query simulator
   -----------------------------------------------------------------------------
   Power Query's real engine (the "M" language) only runs inside Excel / Power
   BI, so we can't execute it in a browser. But Power Query is, at heart, an
   ordered list of small transformations — "Applied Steps" — over a table. That
   we CAN reproduce faithfully: each step here transforms the data exactly like
   the ribbon button it mimics, and emits the M code that step would generate.

   A table is { columns: [{name, type}], rows: [ {colName: value, ...} ] }
   where type is one of: "text" | "number" | "date".
   ============================================================================= */
(function (LL) {
  "use strict";

  // ---- small helpers --------------------------------------------------------
  function clone(table) {
    return {
      columns: table.columns.map((c) => ({ ...c })),
      rows: table.rows.map((r) => ({ ...r })),
    };
  }
  function colNames(table) {
    return table.columns.map((c) => c.name);
  }
  function hasCol(table, name) {
    return table.columns.some((c) => c.name === name);
  }
  function colType(table, name) {
    const c = table.columns.find((c) => c.name === name);
    return c ? c.type : "text";
  }
  function setColType(table, name, type) {
    const c = table.columns.find((c) => c.name === name);
    if (c) c.type = type;
  }
  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === "";
  }

  function properCase(s) {
    return String(s)
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  // Parse messy text into a real number. Handles $, thousands commas, stray
  // spaces, and the accountant's "(123.45)" = negative convention.
  function parseNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return v;
    let s = String(v).trim();
    if (s === "" || /^n\/?a$/i.test(s)) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) {
      neg = true;
      s = s.slice(1, -1);
    }
    s = s.replace(/[$£€,\s]/g, "");
    if (s === "" || isNaN(Number(s))) return null;
    const n = Number(s);
    return neg ? -n : n;
  }

  // Parse several common date shapes into ISO yyyy-mm-dd (kept as text).
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  function pad(n) { return String(n).padStart(2, "0"); }
  function parseDate(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).trim();
    if (s === "") return null;
    let m;
    if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)))
      return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)))
      return `${m[3]}-${pad(m[1])}-${pad(m[2])}`; // M/D/Y
    if ((m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/))) {
      const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
      if (mm) return `${m[3]}-${pad(mm)}-${pad(m[2])}`;
    }
    return s; // leave anything exotic untouched
  }

  // ---- the operations -------------------------------------------------------
  // Each op: apply(table, step) -> newTable, and m(step) -> { label, expr }
  // where expr uses the literal "PREV" placeholder for the previous step var.
  const OPS = {
    trim: {
      apply(t, s) {
        const cols = s.columns || colNames(t).filter((n) => colType(t, n) === "text");
        t.rows.forEach((r) =>
          cols.forEach((c) => {
            if (typeof r[c] === "string") r[c] = r[c].trim();
          })
        );
        return t;
      },
      m: (s) => ({
        label: "Trimmed Text",
        expr: `Table.TransformColumns(PREV, {${(s.columns || [])
          .map((c) => `{"${c}", Text.Trim, type text}`)
          .join(", ")}})`,
      }),
    },

    case: {
      apply(t, s) {
        const fn =
          s.mode === "upper"
            ? (x) => String(x).toUpperCase()
            : s.mode === "lower"
            ? (x) => String(x).toLowerCase()
            : properCase;
        (s.columns || []).forEach((c) =>
          t.rows.forEach((r) => {
            if (r[c] !== null && r[c] !== undefined) r[c] = fn(r[c]);
          })
        );
        return t;
      },
      m: (s) => {
        const fnName =
          s.mode === "upper" ? "Text.Upper" : s.mode === "lower" ? "Text.Lower" : "Text.Proper";
        const label =
          s.mode === "upper" ? "Uppercased Text" : s.mode === "lower" ? "Lowercased Text" : "Capitalized Each Word";
        return {
          label,
          expr: `Table.TransformColumns(PREV, {${(s.columns || [])
            .map((c) => `{"${c}", ${fnName}, type text}`)
            .join(", ")}})`,
        };
      },
    },

    replace: {
      apply(t, s) {
        t.rows.forEach((r) => {
          const cur = r[s.column];
          if (cur === null || cur === undefined) return;
          if (s.whole) {
            if (String(cur).trim() === s.find) r[s.column] = s.replace;
          } else {
            r[s.column] = String(cur).split(s.find).join(s.replace);
          }
        });
        return t;
      },
      m: (s) => ({
        label: "Replaced Value",
        expr: `Table.ReplaceValue(PREV, "${s.find}", ${
          s.replace === null ? "null" : `"${s.replace}"`
        }, Replacer.ReplaceText, {"${s.column}"})`,
      }),
    },

    changeType: {
      apply(t, s) {
        const conv =
          s.type === "number" ? parseNumber : s.type === "date" ? parseDate : (x) => (x == null ? x : String(x));
        t.rows.forEach((r) => (r[s.column] = conv(r[s.column])));
        setColType(t, s.column, s.type);
        return t;
      },
      m: (s) => {
        const mType = s.type === "number" ? "type number" : s.type === "date" ? "type date" : "type text";
        return {
          label: "Changed Type",
          expr: `Table.TransformColumnTypes(PREV, {{"${s.column}", ${mType}}})`,
        };
      },
    },

    removeColumns: {
      apply(t, s) {
        const drop = new Set(s.columns || []);
        t.columns = t.columns.filter((c) => !drop.has(c.name));
        t.rows.forEach((r) => (s.columns || []).forEach((c) => delete r[c]));
        return t;
      },
      m: (s) => ({
        label: "Removed Columns",
        expr: `Table.RemoveColumns(PREV, {${(s.columns || []).map((c) => `"${c}"`).join(", ")}})`,
      }),
    },

    removeDuplicates: {
      apply(t, s) {
        const keys = s.columns && s.columns.length ? s.columns : colNames(t);
        const seen = new Set();
        t.rows = t.rows.filter((r) => {
          const k = keys.map((c) => String(r[c])).join("␟");
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return t;
      },
      m: (s) => ({
        label: "Removed Duplicates",
        expr:
          s.columns && s.columns.length
            ? `Table.Distinct(PREV, {${s.columns.map((c) => `"${c}"`).join(", ")}})`
            : `Table.Distinct(PREV)`,
      }),
    },

    filter: {
      apply(t, s) {
        const test = makeTest(s);
        t.rows = t.rows.filter((r) => test(r[s.column]));
        return t;
      },
      m: (s) => ({
        label: "Filtered Rows",
        expr: `Table.SelectRows(PREV, each ${mPredicate(s)})`,
      }),
    },

    split: {
      apply(t, s) {
        const idx = t.columns.findIndex((c) => c.name === s.column);
        const [a, b] = s.into;
        t.rows.forEach((r) => {
          const val = r[s.column] == null ? "" : String(r[s.column]);
          const pos = val.indexOf(s.delimiter);
          if (pos === -1) {
            r[a] = val;
            r[b] = null;
          } else {
            r[a] = val.slice(0, pos).trim();
            r[b] = val.slice(pos + s.delimiter.length).trim();
          }
          delete r[s.column];
        });
        const newCols = [
          { name: a, type: "text" },
          { name: b, type: "text" },
        ];
        t.columns.splice(idx, 1, ...newCols);
        return t;
      },
      m: (s) => ({
        label: "Split Column by Delimiter",
        expr: `Table.SplitColumn(PREV, "${s.column}", Splitter.SplitTextByDelimiter("${s.delimiter}"), {"${s.into[0]}", "${s.into[1]}"})`,
      }),
    },

    conditional: {
      apply(t, s) {
        t.rows.forEach((r) => {
          let out = s.else;
          for (const c of s.cases) {
            if (makeTest(c)(r[c.column])) {
              out = c.then;
              break;
            }
          }
          r[s.newColumn] = out;
        });
        t.columns.push({ name: s.newColumn, type: "text" });
        return t;
      },
      m: (s) => ({
        label: "Added Conditional Column",
        expr:
          `Table.AddColumn(PREV, "${s.newColumn}", each ` +
          s.cases
            .map((c) => `if ${mPredicate(c)} then "${c.then}"`)
            .join(" else ") +
          ` else "${s.else}")`,
      }),
    },

    group: {
      apply(t, s) {
        const groups = new Map();
        t.rows.forEach((r) => {
          const k = s.by.map((c) => String(r[c])).join("␟");
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(r);
        });
        const rows = [];
        for (const bucket of groups.values()) {
          const out = {};
          s.by.forEach((c) => (out[c] = bucket[0][c]));
          s.aggregations.forEach((a) => {
            if (a.fn === "count") out[a.as] = bucket.length;
            else if (a.fn === "sum")
              out[a.as] = round2(bucket.reduce((sum, r) => sum + (Number(r[a.column]) || 0), 0));
          });
          rows.push(out);
        }
        const columns = s.by
          .map((c) => ({ name: c, type: colType(t, c) }))
          .concat(s.aggregations.map((a) => ({ name: a.as, type: "number" })));
        return { columns, rows };
      },
      m: (s) => ({
        label: "Grouped Rows",
        expr:
          `Table.Group(PREV, {${s.by.map((c) => `"${c}"`).join(", ")}}, {` +
          s.aggregations
            .map((a) =>
              a.fn === "count"
                ? `{"${a.as}", each Table.RowCount(_), Int64.Type}`
                : `{"${a.as}", each List.Sum([${a.column}]), type number}`
            )
            .join(", ") +
          `})`,
      }),
    },

    unpivot: {
      apply(t, s) {
        const keep = s.keep;
        const others = colNames(t).filter((c) => !keep.includes(c));
        const rows = [];
        t.rows.forEach((r) => {
          others.forEach((c) => {
            const out = {};
            keep.forEach((k) => (out[k] = r[k]));
            out[s.attributeName] = c;
            out[s.valueName] = r[c];
            rows.push(out);
          });
        });
        const columns = keep
          .map((k) => ({ name: k, type: colType(t, k) }))
          .concat([
            { name: s.attributeName, type: "text" },
            { name: s.valueName, type: "number" },
          ]);
        return { columns, rows };
      },
      m: (s) => ({
        label: "Unpivoted Columns",
        expr: `Table.UnpivotOtherColumns(PREV, {${s.keep
          .map((k) => `"${k}"`)
          .join(", ")}}, "${s.attributeName}", "${s.valueName}")`,
      }),
    },

    fillDown: {
      apply(t, s) {
        const last = {};
        t.rows.forEach((r) => {
          (s.columns || []).forEach((c) => {
            if (isBlank(r[c])) {
              if (last[c] !== undefined) r[c] = last[c];
            } else {
              last[c] = r[c];
            }
          });
        });
        return t;
      },
      m: (s) => ({
        label: "Filled Down",
        expr: `Table.FillDown(PREV, {${(s.columns || []).map((c) => `"${c}"`).join(", ")}})`,
      }),
    },

    fillUp: {
      apply(t, s) {
        const last = {};
        for (let i = t.rows.length - 1; i >= 0; i--) {
          const r = t.rows[i];
          (s.columns || []).forEach((c) => {
            if (isBlank(r[c])) { if (last[c] !== undefined) r[c] = last[c]; }
            else last[c] = r[c];
          });
        }
        return t;
      },
      m: (s) => ({
        label: "Filled Up",
        expr: `Table.FillUp(PREV, {${(s.columns || []).map((c) => `"${c}"`).join(", ")}})`,
      }),
    },

    merge: {
      // Power Query's "Merge Queries" = a join. We bring matching columns from
      // a second table (left-outer, so unmatched left rows survive with nulls).
      apply(t, s, ctx) {
        const right = ctx && ctx.tables ? ctx.tables[s.rightTable] : null;
        const index = new Map();
        if (right) {
          right.rows.forEach((r) => {
            const k = String(r[s.rightKey]);
            if (!index.has(k)) index.set(k, r);
          });
        }
        t.rows.forEach((row) => {
          const match = right ? index.get(String(row[s.leftKey])) : null;
          s.bring.forEach((col) => (row[col] = match ? match[col] : null));
        });
        s.bring.forEach((col) => {
          if (!hasCol(t, col)) t.columns.push({ name: col, type: "text" });
        });
        return t;
      },
      m: (s) => ({
        label: "Merged Queries",
        expr:
          `Table.ExpandTableColumn(Table.NestedJoin(PREV, {"${s.leftKey}"}, ${s.rightTable}, ` +
          `{"${s.rightKey}"}, "${s.rightTable}", JoinKind.LeftOuter), "${s.rightTable}", ` +
          `{${s.bring.map((c) => `"${c}"`).join(", ")}})`,
      }),
    },

    sort: {
      apply(t, s) {
        const dir = s.dir === "desc" ? -1 : 1;
        t.rows.sort((a, b) => {
          const av = a[s.column], bv = b[s.column];
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return (av > bv ? 1 : -1) * dir;
        });
        return t;
      },
      m: (s) => ({
        label: "Sorted Rows",
        expr: `Table.Sort(PREV, {{"${s.column}", Order.${s.dir === "desc" ? "Descending" : "Ascending"}}})`,
      }),
    },
  };

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // Shared row-test builder for filter / conditional.
  function makeTest(s) {
    const val = s.value;
    switch (s.test) {
      case "equals": return (x) => String(x) === String(val);
      case "notEquals": return (x) => String(x) !== String(val);
      case "contains": return (x) => x != null && String(x).includes(val);
      case "notContains": return (x) => x == null || !String(x).includes(val);
      case "notEmpty": return (x) => !isBlank(x);
      case "isEmpty": return (x) => isBlank(x);
      case "gt": return (x) => Number(x) > Number(val);
      case "lt": return (x) => Number(x) < Number(val);
      default: return () => true;
    }
  }
  function mPredicate(s) {
    const col = `[${s.column}]`;
    switch (s.test) {
      case "equals": return `${col} = "${s.value}"`;
      case "notEquals": return `${col} <> "${s.value}"`;
      case "contains": return `Text.Contains(${col}, "${s.value}")`;
      case "notContains": return `not Text.Contains(${col}, "${s.value}")`;
      case "notEmpty": return `${col} <> null and ${col} <> ""`;
      case "isEmpty": return `${col} = null or ${col} = ""`;
      case "gt": return `${col} > ${s.value}`;
      case "lt": return `${col} < ${s.value}`;
      default: return "true";
    }
  }

  // Run a pipeline of steps over a source table → final table. `ctx` carries
  // extra tables that some steps (Merge) need to reach.
  function run(source, steps, ctx) {
    let t = clone(source);
    (steps || []).forEach((step) => {
      const op = OPS[step.op];
      if (op) t = op.apply(t, step, ctx);
    });
    return t;
  }

  // Generate the full M query (let … in) for a pipeline. Each step is assigned
  // to a #"Step Name" variable that references the previous one, exactly as the
  // Power Query editor does.
  function toM(sourceName, steps) {
    const lines = [`    Source = ${sourceName}`];
    let prevVar = "Source";
    const used = {};
    (steps || []).forEach((step) => {
      const op = OPS[step.op];
      if (!op) return;
      const { label, expr } = op.m(step);
      used[label] = (used[label] || 0) + 1;
      const name = used[label] > 1 ? `${label} ${used[label]}` : label;
      const varRef = `#"${name}"`;
      lines.push(`    ${varRef} = ${expr.replace(/PREV/g, prevVar)}`);
      prevVar = varRef;
    });
    return `let\n${lines.join(",\n")}\nin\n    ${prevVar}`;
  }

  // Compare two tables for the grader. Lenient on row order by default;
  // requires the same columns (by name) and the same multiset of rows.
  function tablesEqual(a, b, opts) {
    opts = opts || {};
    const an = colNames(a).slice().sort();
    const bn = colNames(b).slice().sort();
    if (an.length !== bn.length || an.some((n, i) => n !== bn[i])) {
      return { pass: false, reason: "The columns don't match the goal yet." };
    }
    if (a.rows.length !== b.rows.length) {
      return {
        pass: false,
        reason: `Expected ${b.rows.length} row(s), but you have ${a.rows.length}.`,
      };
    }
    const norm = (r) =>
      an.map((c) => normVal(r[c])).join("␟");
    if (opts.orderMatters) {
      for (let i = 0; i < a.rows.length; i++) {
        if (norm(a.rows[i]) !== norm(b.rows[i]))
          return { pass: false, reason: "Right data, wrong order — check your sort step." };
      }
      return { pass: true };
    }
    const tally = (rows) => {
      const m = new Map();
      rows.forEach((r) => {
        const k = norm(r);
        m.set(k, (m.get(k) || 0) + 1);
      });
      return m;
    };
    const ta = tally(a.rows), tb = tally(b.rows);
    if (ta.size !== tb.size) return { pass: false, reason: "The rows don't match the goal yet." };
    for (const [k, n] of tb) if (ta.get(k) !== n) return { pass: false, reason: "The rows don't match the goal yet." };
    return { pass: true };
  }
  function normVal(v) {
    if (v === null || v === undefined) return "·null";
    if (typeof v === "number") return "#" + round2(v);
    const s = String(v).trim();
    const n = Number(s.replace(/,/g, ""));
    if (s !== "" && !isNaN(n) && /^[-+]?[\d.,]+$/.test(s)) return "#" + round2(n);
    return s.toLowerCase();
  }

  // Parse a generated M query back into our step model (Advanced Editor). It
  // recognizes the functions we emit; an unrecognized line throws, the way a
  // real editor rejects invalid M.
  function strs(s) { return (s.match(/"((?:[^"\\]|\\.)*)"/g) || []).map((x) => x.slice(1, -1)); }
  function parsePred(p, kind) {
    let m, r = null;
    if ((m = p.match(/^\[([^\]]+)\]\s*<>\s*null\s+and\s+\[[^\]]+\]\s*<>\s*""$/))) r = { column: m[1], test: "notEmpty", value: "" };
    else if ((m = p.match(/^\[([^\]]+)\]\s*=\s*null\s+or\s+\[[^\]]+\]\s*=\s*""$/))) r = { column: m[1], test: "isEmpty", value: "" };
    else if ((m = p.match(/^not\s+Text\.Contains\(\[([^\]]+)\],\s*"([^"]*)"\)$/))) r = { column: m[1], test: "notContains", value: m[2] };
    else if ((m = p.match(/^Text\.Contains\(\[([^\]]+)\],\s*"([^"]*)"\)$/))) r = { column: m[1], test: "contains", value: m[2] };
    else if ((m = p.match(/^\[([^\]]+)\]\s*<>\s*"([^"]*)"$/))) r = { column: m[1], test: "notEquals", value: m[2] };
    else if ((m = p.match(/^\[([^\]]+)\]\s*=\s*"([^"]*)"$/))) r = { column: m[1], test: "equals", value: m[2] };
    else if ((m = p.match(/^\[([^\]]+)\]\s*>\s*([\d.]+)$/))) r = { column: m[1], test: "gt", value: m[2] };
    else if ((m = p.match(/^\[([^\]]+)\]\s*<\s*([\d.]+)$/))) r = { column: m[1], test: "lt", value: m[2] };
    if (!r) return null;
    return kind === "filter" ? { op: "filter", column: r.column, test: r.test, value: r.value } : r;
  }
  function parseExpr(e) {
    let m;
    if (e.startsWith("Table.TransformColumns(")) {
      const fn = (e.match(/,\s*(Text\.\w+)/) || [])[1] || "";
      const cols = (e.match(/\{"([^"]*)",\s*Text\.\w+/g) || []).map((x) => x.match(/\{"([^"]*)"/)[1]);
      if (fn === "Text.Trim") return { op: "trim", columns: cols };
      const mode = fn === "Text.Upper" ? "upper" : fn === "Text.Lower" ? "lower" : fn === "Text.Proper" ? "proper" : null;
      return mode ? { op: "case", columns: cols, mode } : null;
    }
    if (e.startsWith("Table.TransformColumnTypes(")) {
      m = e.match(/\{\{"([^"]*)",\s*type\s+(\w+)/); if (!m) return null;
      return { op: "changeType", column: m[1], type: m[2] === "number" ? "number" : m[2] === "date" ? "date" : "text" };
    }
    if (e.startsWith("Table.ReplaceValue(")) {
      m = e.match(/Table\.ReplaceValue\([^,]+,\s*"([^"]*)",\s*(null|"[^"]*"),[^{]*\{"([^"]*)"\}/); if (!m) return null;
      return { op: "replace", column: m[3], find: m[1], replace: m[2] === "null" ? null : m[2].slice(1, -1), whole: false };
    }
    if (e.startsWith("Table.RemoveColumns(")) return { op: "removeColumns", columns: strs(e.replace(/^Table\.RemoveColumns\([^,]+,/, "")) };
    if (e.startsWith("Table.Distinct(")) { const c = strs(e.replace(/^Table\.Distinct\([^,)]+/, "")); return c.length ? { op: "removeDuplicates", columns: c } : { op: "removeDuplicates" }; }
    if (e.startsWith("Table.FillDown(")) return { op: "fillDown", columns: strs(e.replace(/^Table\.FillDown\([^,]+,/, "")) };
    if (e.startsWith("Table.FillUp(")) return { op: "fillUp", columns: strs(e.replace(/^Table\.FillUp\([^,]+,/, "")) };
    if (e.startsWith("Table.Sort(")) { m = e.match(/\{\{"([^"]*)",\s*Order\.(\w+)/); return m ? { op: "sort", column: m[1], dir: m[2] === "Descending" ? "desc" : "asc" } : null; }
    if (e.startsWith("Table.SplitColumn(")) { m = e.match(/Table\.SplitColumn\([^,]+,\s*"([^"]*)",\s*Splitter\.SplitTextByDelimiter\("([^"]*)"\),\s*\{"([^"]*)",\s*"([^"]*)"\}/); return m ? { op: "split", column: m[1], delimiter: m[2], into: [m[3], m[4]] } : null; }
    if (e.startsWith("Table.UnpivotOtherColumns(")) { m = e.match(/Table\.UnpivotOtherColumns\([^,]+,\s*\{([^}]*)\},\s*"([^"]*)",\s*"([^"]*)"/); return m ? { op: "unpivot", keep: strs("{" + m[1] + "}"), attributeName: m[2], valueName: m[3] } : null; }
    if (e.startsWith("Table.Group(")) {
      m = e.match(/Table\.Group\([^,]+,\s*\{([^}]*)\},\s*\{(.+)\}\s*\)$/); if (!m) return null;
      const by = strs("{" + m[1] + "}");
      const a = m[2].match(/\{"([^"]*)",\s*each\s+(List\.Sum\(\[([^\]]*)\]\)|Table\.RowCount\(_\))/); if (!a) return null;
      return /RowCount/.test(a[2]) ? { op: "group", by, aggregations: [{ column: by[0], fn: "count", as: a[1] }] } : { op: "group", by, aggregations: [{ column: a[3], fn: "sum", as: a[1] }] };
    }
    if (e.startsWith("Table.ExpandTableColumn(")) {
      m = e.match(/Table\.NestedJoin\([^,]+,\s*\{"([^"]*)"\},\s*(\w+),\s*\{"([^"]*)"\},\s*"[^"]*",\s*JoinKind\.LeftOuter\),\s*"[^"]*",\s*\{([^}]*)\}/);
      return m ? { op: "merge", rightTable: m[2], leftKey: m[1], rightKey: m[3], bring: strs("{" + m[4] + "}") } : null;
    }
    if (e.startsWith("Table.SelectRows(")) { m = e.match(/each\s+(.+)\)\s*$/); return m ? parsePred(m[1].trim(), "filter") : null; }
    if (e.startsWith("Table.AddColumn(")) {
      m = e.match(/Table\.AddColumn\([^,]+,\s*"([^"]*)",\s*each\s+(.+)\)\s*$/); if (!m) return null;
      const im = m[2].match(/^if\s+(.+?)\s+then\s+"([^"]*)"\s+else\s+"([^"]*)"$/); if (!im) return null;
      const cond = parsePred(im[1].trim(), "cond"); if (!cond) return null;
      return { op: "conditional", newColumn: m[1], cases: [{ column: cond.column, test: cond.test, value: cond.value, then: im[2] }], else: im[3] };
    }
    return null;
  }
  function parseM(text) {
    const lines = String(text).split(/\r?\n/);
    const steps = [];
    let inBody = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (line === "let" || line === "") continue;
      if (/^in\b/.test(line)) break;
      if (/^Source\s*=/.test(line)) { inBody = true; continue; }
      if (!inBody) continue;
      if (!/^#"[^"]*"\s*=/.test(line)) continue;
      const expr = line.replace(/^#"[^"]*"\s*=\s*/, "").replace(/,\s*$/, "");
      const step = parseExpr(expr);
      if (!step) throw new Error("Could not parse step: " + expr.slice(0, 70));
      steps.push(step);
    }
    return steps;
  }

  LL.PQ = { run, toM, parseM, tablesEqual, clone, parseNumber, parseDate, properCase, OPS };
})(window.LL = window.LL || {});
