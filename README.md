# Ledger Lab

Ledger Lab is a small, self contained web app that teaches non technical accountants how to clean up messy data using live SQL and a simulated Power Query, without overwhelming them. It runs entirely in your browser. There is no backend, no build step, no sign up, and nothing leaves your machine.

It is built like an app your team already knows: an iOS style workbench with a sidebar of tables and drills, a segmented control for switching tools, and rounded cards throughout.

## Why it exists

Accountants spend a huge amount of time fixing the same handful of data problems: vendor names with stray spaces, the same supplier spelled three different ways, amounts stored as text like `$1,234.50` or `(450.00)`, budgets shaped with one column per month, and exports where the repeated labels were left blank. Ledger Lab turns those exact problems into short, friendly drills, and gives you a real sandbox to practice in. Every lesson shows the Excel move you already know, then the modern way to do it once and never by hand again.

## Features

- **Live SQL.** A real SQLite database runs in your browser (via sql.js compiled to WebAssembly). You write queries and get answers back instantly, with results you can sort and export.
- **Simulated Power Query.** Power Query's engine (the M language) only runs inside Excel and Power BI, so it cannot run on the web. Ledger Lab reproduces the part that matters: you stack "Applied Steps" by tapping transforms, watch the data change, and see the M code those clicks would generate.
- **Three modes** in one workbench, switched with a segmented control:
  - **SQL** for typing queries against the practice tables.
  - **Power Query** for cleaning by clicking, the no code way.
  - **Inspect** for profiling a table and auditing it for problems.
- **Drills.** 13 SQL drills and 9 Power Query drills, each one idea wrapped in a real accounting moment. Drills are optional and load into the same sandbox. They are graded live against a reference answer, so the checker is always correct. Nothing is timed and hints are always one tap away.
- **Inspect and audit.** Pick any table and Ledger Lab profiles every column (type, blanks, distinct values, how much looks numeric, range and total, sample values) and flags the classic messes: stray spaces, inconsistent spelling, numbers stored as text, mixed date formats, blank cells, and duplicate rows. Each fixable issue has a one tap "Fix in Power Query" that loads the suggested steps for you.
- **Bring your own data.** Import a CSV (choose a file or paste it). It becomes a real table usable by both SQL and Power Query, and it persists across reloads. Columns full of dollar signs, commas, or parentheses are kept as text on purpose, so you can practice cleaning them.
- **Export and chaining.** Any result has Export CSV and Copy. In Power Query you can "Load result to table" to turn a cleaning pipeline's output into a new table you can then query with SQL.
- **Works offline.** The SQLite engine is vendored locally, so the app itself needs no internet. Only the web fonts load from a CDN, and the app falls back to system fonts if they are not available.
- **Private by design.** Everything happens in the browser. No data is uploaded anywhere.

## The practice data

Six built in tables tell a small, realistic story:

| Table | What it is |
| --- | --- |
| `vendors_raw` | A messy vendor export with duplicates, stray spaces, and inconsistent case. |
| `vendors` | The clean vendor master used as a lookup table. |
| `gl_entries` | General ledger journal lines, including a couple that reference a missing vendor. |
| `ap_invoices` | Accounts payable, with amounts stored as text and a free text status column. |
| `budget_wide` | A budget with one column per month, ready to be unpivoted. |
| `dept_export` | An export with blanked out repeat labels, ready for Fill Down. |

## What the drills cover

**SQL:** SELECT, choosing columns, TRIM, UPPER and LOWER, WHERE filters, GROUP BY with COUNT and HAVING, cleaning money with REPLACE and CAST, GROUP BY with SUM and ORDER BY (a pivot in one line), CASE for standardizing text, JOIN (a VLOOKUP that never breaks), LEFT JOIN for finding what does not reconcile, aging buckets with date math, and a CTE that cleans then totals in one query.

**Power Query:** Trim and Capitalize, Fill Down, Remove Duplicates, Split Column, Group By, Unpivot, Merge Queries, Change Type for amounts, and Filter Rows.

## Running it locally

The app is plain HTML, CSS, and JavaScript. There is nothing to build.

The simplest reliable way is to serve the folder with any static server and open it in a browser. Some browsers restrict local file access, which the in browser database needs, so a tiny server is recommended over opening the file directly.

Using Python:

```
python -m http.server 8000
```

Using Node:

```
npx serve
```

Then open the address it prints (for example `http://localhost:8000`).

You can also try opening `index.html` directly. It works in many browsers, but if the database fails to start, use a local server as shown above.

## Project structure

```
LedgerLab/
  index.html            the single page
  css/
    styles.css          the full iOS style design system
  js/
    data.js             the sample messy datasets
    db.js               sql.js wrapper, builds the database, runs queries
    csv.js              CSV parser, type inference, import
    grader.js           compares a query result to the reference answer
    pq.js               Power Query step engine and M code generator
    profile.js          column profiler and data health audit
    export.js           CSV export and clipboard copy
    lessons-sql.js      the SQL drills
    lessons-pq.js       the Power Query drills
    app.js              UI shell, state, routing
  lib/
    sql-wasm.js         SQLite compiled to WebAssembly (vendored)
    sql-wasm.wasm
  LICENSE
  README.md
```

## How it works under the hood

- **SQL** runs on [sql.js](https://github.com/sql-js/sql.js), which is SQLite compiled to WebAssembly. The practice database is built in memory from the datasets in `data.js` every time the page loads.
- **Grading** runs your query and the reference query against the same database, then compares the result sets. The comparison is deliberately forgiving: column order and naming do not matter, only that the right data came back. Row order matters only for the ordering drills.
- **Power Query** is a small pure JavaScript engine. Each transform is a function over an array of row objects, and each one also knows how to emit a line of M code, so the generated query reads like the real thing.
- **The audit** is a set of heuristics over a table's values. It is intentionally conservative. For example, it will not suggest converting an identifier or code column to a number, because codes should stay as text.

## Tech and credits

- [sql.js](https://github.com/sql-js/sql.js) for SQLite in the browser, MIT licensed.
- [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) for the type, with SF Pro used on Apple devices via the system font stack.

## License

MIT. See [LICENSE](LICENSE).
