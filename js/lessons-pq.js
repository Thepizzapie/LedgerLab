/* =============================================================================
   Ledger Lab — Power Query lessons
   -----------------------------------------------------------------------------
   Each lesson is a small puzzle: a messy source table, a clear goal, and a
   palette of ribbon-style buttons. The learner clicks buttons to build an
   "Applied Steps" list (exactly like the real Power Query editor); the data and
   the generated M code update live. Some palette buttons are deliberate
   wrong-turns, so choosing the right step — and the right ORDER — is the lesson.

   The reference `solution` pipeline is run live to compute the expected result.
   ============================================================================= */
(function (LL) {
  "use strict";

  LL.PQ_LESSONS = [
    {
      id: "pq-01-trim-proper",
      title: "Clean the vendor names",
      tag: "Trim · Capitalize",
      source: "vendors_raw",
      scenario:
        "Same vendor list, the Power Query way. Instead of writing code, you'll click transformations and watch them stack up as “Applied Steps” on the right. First job: the vendor names are full of stray spaces and random capitals.",
      teaches:
        "Each button adds one step. Steps run top to bottom, and you can delete any one without redoing the rest — that's Power Query's superpower over manual edits.",
      goal: "Make <strong>vendor_name</strong> tidy: no leading/trailing spaces, and Proper Case (“Acme Corp”). Leave the other columns as they are.",
      excel: { from: "<code>=PROPER(TRIM(A2))</code>, then paste-special as values.", to: "Two clicks — Trim, then Capitalize Each Word — recorded so next month is one refresh." },
      palette: [
        { label: "Trim spaces · vendor_name", step: { op: "trim", columns: ["vendor_name"] } },
        { label: "Capitalize Each Word · vendor_name", step: { op: "case", columns: ["vendor_name"], mode: "proper" } },
        { label: "UPPERCASE · vendor_name", step: { op: "case", columns: ["vendor_name"], mode: "upper" } },
        { label: "Trim spaces · category", step: { op: "trim", columns: ["category"] } },
      ],
      solution: [
        { op: "trim", columns: ["vendor_name"] },
        { op: "case", columns: ["vendor_name"], mode: "proper" },
      ],
      mode: "rows",
      hints: [
        "You need two steps on vendor_name: remove the spaces, then fix the case.",
        "“Capitalize Each Word” gives Proper Case. UPPERCASE would make “ACME CORP”, which isn't the goal.",
        "Add “Trim spaces · vendor_name”, then “Capitalize Each Word · vendor_name”.",
      ],
      pro: "Notice the two “Acme Corp” rows are now spelled identically. Standardizing text is what makes the next step — removing duplicates — even possible.",
    },

    {
      id: "pq-02-fill-down",
      title: "Repair the merged cells",
      tag: "Fill Down",
      source: "dept_export",
      scenario:
        "A department report exported from Excel, where the “merge & center” labels left every repeat cell blank. You can't filter or pivot on a column full of holes. Power Query fixes this in one famous click: Fill Down.",
      teaches:
        "<strong>Fill Down</strong> copies the value above into each blank cell beneath it — turning a human-readable-but-broken layout into a real, analyzable table.",
      goal: "Fill the blank <strong>department</strong> cells with the value above them, so every row knows its department.",
      excel: { from: "Select blanks → type <code>=</code> cell-above → Ctrl+Enter (and pray you selected right).", to: "Right-click the column → Fill → Down. Done, and repeatable." },
      palette: [
        { label: "Fill Down · department", step: { op: "fillDown", columns: ["department"] } },
        { label: "Fill Down · line_item", step: { op: "fillDown", columns: ["line_item"] } },
        { label: "Trim spaces · department", step: { op: "trim", columns: ["department"] } },
      ],
      solution: [{ op: "fillDown", columns: ["department"] }],
      mode: "rows",
      hints: [
        "Only the department column has the blank-cell problem.",
        "Add “Fill Down · department” — a single step does it.",
      ],
      pro: "Fill Down is the antidote to every “merge & center” spreadsheet you'll ever inherit. One step turns a layout into data.",
    },

    {
      id: "pq-03-dedupe",
      title: "Remove the duplicate vendors",
      tag: "Remove Duplicates",
      source: "vendors_raw",
      scenario:
        "Back to the vendor list. It has the same vendor entered several times with different spacing and capitals. You want one clean row per real vendor — but Power Query can only see duplicates if the text matches exactly first.",
      teaches:
        "<strong>Order matters.</strong> Standardize the text, <em>then</em> Remove Duplicates. Dedupe first and Power Query sees twelve unique strings and removes nothing.",
      goal: "End with one row per vendor — clean, Proper-Case <strong>vendor_name</strong>, no duplicates.",
      excel: { from: "Data → Remove Duplicates (after manually fixing spelling so it works).", to: "Trim → Capitalize → Remove Duplicates, in that order, recorded forever." },
      palette: [
        { label: "Trim spaces · vendor_name", step: { op: "trim", columns: ["vendor_name"] } },
        { label: "Capitalize Each Word · vendor_name", step: { op: "case", columns: ["vendor_name"], mode: "proper" } },
        { label: "Remove Duplicates · by vendor_name", step: { op: "removeDuplicates", columns: ["vendor_name"] } },
        { label: "Remove Duplicates · entire row", step: { op: "removeDuplicates" } },
      ],
      solution: [
        { op: "trim", columns: ["vendor_name"] },
        { op: "case", columns: ["vendor_name"], mode: "proper" },
        { op: "removeDuplicates", columns: ["vendor_name"] },
      ],
      mode: "rows",
      hints: [
        "Clean the names first (Trim, then Capitalize Each Word) — otherwise the duplicates don't look identical.",
        "Then “Remove Duplicates · by vendor_name”. (Removing duplicate <em>entire rows</em> won't help — the other columns still differ.)",
        "Order: Trim → Capitalize Each Word → Remove Duplicates · by vendor_name.",
      ],
      pro: "From 12 messy rows to 8 clean vendors. The lesson pros internalize: clean before you dedupe, always.",
    },

    {
      id: "pq-04-split",
      title: "Split the account code from its name",
      tag: "Split Column",
      source: {
        columns: [
          { name: "account", type: "text" },
          { name: "balance", type: "number" },
        ],
        rows: [
          { account: "6000 - Office Supplies", balance: 352.85 },
          { account: "6100 - Travel", balance: 1540 },
          { account: "6200 - Software", balance: 1087.99 },
          { account: "6300 - Utilities", balance: 916.84 },
          { account: "6400 - Consulting", balance: 5150 },
          { account: "7000 - Equipment", balance: 4049 },
        ],
      },
      scenario:
        "Your chart of accounts crams the code and the name into one column: “6000 - Office Supplies”. To group by code or join to another system, you need them in separate columns.",
      teaches:
        "<strong>Split Column by Delimiter</strong> cuts one column into several at a chosen separator. Pick the delimiter carefully — “ - ” (with spaces) gives clean halves.",
      goal: "Split <strong>account</strong> into <strong>account_code</strong> and <strong>account_name</strong> at the “ - ”.",
      excel: { from: "Text to Columns wizard (one-time, destroys the original).", to: "Split Column by Delimiter — non-destructive and repeatable." },
      palette: [
        { label: 'Split account by " - "  →  code / name', step: { op: "split", column: "account", delimiter: " - ", into: ["account_code", "account_name"] } },
        { label: 'Split account by " " (space)', step: { op: "split", column: "account", delimiter: " ", into: ["account_code", "account_name"] } },
        { label: "Trim spaces · account", step: { op: "trim", columns: ["account"] } },
      ],
      solution: [{ op: "split", column: "account", delimiter: " - ", into: ["account_code", "account_name"] }],
      mode: "rows",
      hints: [
        "Use the delimiter that sits between the code and the name: “ - ” (space-dash-space).",
        "Splitting on a plain space would break “Office Supplies” into pieces — not what you want.",
      ],
      pro: "Choosing the right delimiter is the whole game. “ - ” keeps multi-word names intact.",
    },

    {
      id: "pq-05-group",
      title: "Summarize spend by account",
      tag: "Group By",
      source: "gl_entries",
      scenario:
        "The GL has every individual line. The controller wants the total per account. In Power Query that's “Group By” — the same idea as a PivotTable, but it lives in your refreshable query.",
      teaches:
        "<strong>Group By</strong> collapses rows that share a value and lets you aggregate the rest. Choose what to group on (account_name) and what to do with the numbers (Sum of amount).",
      goal: "One row per <strong>account_name</strong> with a <strong>total</strong> that sums the amounts.",
      excel: { from: "PivotTable: account to Rows, amount to Values (Sum).", to: "Group By account_name, Sum of amount → a table you can build on." },
      palette: [
        { label: "Group by account_name · Sum of amount → total", step: { op: "group", by: ["account_name"], aggregations: [{ column: "amount", fn: "sum", as: "total" }] } },
        { label: "Group by account_name · Count rows", step: { op: "group", by: ["account_name"], aggregations: [{ column: "amount", fn: "count", as: "row_count" }] } },
        { label: "Group by vendor_id · Sum of amount → total", step: { op: "group", by: ["vendor_id"], aggregations: [{ column: "amount", fn: "sum", as: "total" }] } },
      ],
      solution: [{ op: "group", by: ["account_name"], aggregations: [{ column: "amount", fn: "sum", as: "total" }] }],
      mode: "rows",
      hints: [
        "Group on the thing you want one row of: account_name.",
        "Aggregate with Sum of amount (counting rows answers a different question).",
      ],
      pro: "Group By is a PivotTable that refreshes itself. Six accounts, six totals, zero manual dragging.",
    },

    {
      id: "pq-06-unpivot",
      title: "Turn months-as-columns into rows",
      tag: "Unpivot",
      source: "budget_wide",
      scenario:
        "The budget arrived in the shape finance always sends: one column per month. It looks fine to read, but you can't filter, group, or chart it cleanly. Unpivot is Power Query's most loved trick — it makes wide data tall.",
      teaches:
        "<strong>Unpivot</strong> turns selected columns into two: one holding the old column name (the month), one holding its value (the amount). “Tall” data is what every chart and pivot actually wants.",
      goal: "Reshape to three columns: <strong>account</strong>, <strong>Month</strong>, and <strong>Amount</strong> — one row per account-and-month.",
      excel: { from: "There isn't a clean Excel way — people copy-paste-transpose by hand and make mistakes.", to: "Select the value columns → Unpivot. One step, no errors." },
      palette: [
        { label: "Unpivot month columns  (keep account → Month / Amount)", step: { op: "unpivot", keep: ["account"], attributeName: "Month", valueName: "Amount" } },
        { label: "Group by account · Sum of Jan", step: { op: "group", by: ["account"], aggregations: [{ column: "Jan", fn: "sum", as: "total" }] } },
        { label: "Remove column · Jan", step: { op: "removeColumns", columns: ["Jan"] } },
      ],
      solution: [{ op: "unpivot", keep: ["account"], attributeName: "Month", valueName: "Amount" }],
      mode: "rows",
      hints: [
        "You want to keep <code>account</code> and melt the four month columns down into two.",
        "“Unpivot month columns” names the new columns Month and Amount — exactly the goal.",
      ],
      pro: "16 tidy rows from 4 wide ones. Once data is tall, every PivotTable and chart just works. This is the step that earns Power Query its reputation.",
    },

    {
      id: "pq-07-merge",
      title: "Look up the vendor details",
      tag: "Merge Queries",
      source: "gl_entries",
      scenario:
        "The capstone. Your GL lines carry only a vendor_id. The names and categories live in a separate vendor master. “Merge Queries” joins them — Power Query's answer to VLOOKUP, except it brings as many columns as you want and never returns #N/A from a re-sorted table.",
      teaches:
        "<strong>Merge Queries</strong> matches each row to another table on a key (vendor_id), then lets you pull in columns from the match. Unmatched rows survive with blanks — so you can spot them.",
      goal: "Add <strong>vendor_name</strong> and <strong>category</strong> to every GL line by merging with the vendor master on <code>vendor_id</code>.",
      excel: { from: "<code>=VLOOKUP(vendor_id, master, col, FALSE)</code> repeated per column.", to: "Merge once on vendor_id, tick the columns to bring across." },
      palette: [
        { label: "Merge with vendors on vendor_id  →  bring vendor_name, category", step: { op: "merge", rightTable: "vendors", leftKey: "vendor_id", rightKey: "vendor_id", bring: ["vendor_name", "category"] } },
        { label: "Merge with vendors on vendor_id  →  bring vendor_name only", step: { op: "merge", rightTable: "vendors", leftKey: "vendor_id", rightKey: "vendor_id", bring: ["vendor_name"] } },
        { label: "Remove column · vendor_id", step: { op: "removeColumns", columns: ["vendor_id"] } },
      ],
      solution: [{ op: "merge", rightTable: "vendors", leftKey: "vendor_id", rightKey: "vendor_id", bring: ["vendor_name", "category"] }],
      mode: "rows",
      hints: [
        "Merge on the shared key, vendor_id.",
        "The goal needs <em>both</em> vendor_name and category — bring across both.",
        "Notice two rows come back with blank vendor details: those GL lines reference a vendor that isn't in the master (the reconciliation problem from the SQL track).",
      ],
      pro: "Merge Queries is VLOOKUP that never breaks and pulls whole tables of detail at once. You've now cleaned, reshaped, and joined data in both Power Query and SQL — that's the real-world toolkit.",
    },
    {
      id: "pq-08-changetype",
      title: "Fix amounts stored as text",
      tag: "Change Type",
      source: "ap_invoices",
      scenario:
        "The same money-as-text mess, the Power Query way. The <code>amount_text</code> column is full of “$1,234.50”, “(450.00)”, and a stray “N/A”. One step — Change Type to Number — parses all of it.",
      teaches:
        "<strong>Change Type → Number</strong> reads the dollar signs, commas, and accountant's parentheses and turns them into real numbers. Values it can't read (like “N/A”) become blank.",
      goal: "Turn <strong>amount_text</strong> into real numbers: “(450.00)” becomes negative, “N/A” becomes blank.",
      excel: { from: "Reformatting the cells does nothing — they're text. You'd rebuild the column with VALUE().", to: "Change Type → Number. One click, whole column." },
      palette: [
        { label: "Change Type · amount_text → Number", step: { op: "changeType", column: "amount_text", type: "number" } },
        { label: "Trim · amount_text", step: { op: "trim", columns: ["amount_text"] } },
        { label: "Replace 'N/A' → blank · amount_text", step: { op: "replace", column: "amount_text", find: "N/A", replace: null, whole: true } },
      ],
      solution: [{ op: "changeType", column: "amount_text", type: "number" }],
      mode: "rows",
      hints: [
        "It's a single step: Change Type on amount_text to Number.",
        "Power Query is smart enough to strip the $ and commas and read (…) as negative — you don't need to clean it by hand first.",
      ],
      pro: "Change Type is the Power Query rescue for numbers trapped as text — the visual twin of SQL's REPLACE + CAST.",
    },

    {
      id: "pq-09-filter",
      title: "Drop the placeholder row",
      tag: "Filter Rows",
      source: "ap_invoices",
      scenario:
        "One invoice has “N/A” where the amount should be — a placeholder that will poison any total. Before summing anything, filter it out. In Power Query you uncheck it once and the step is recorded forever.",
      teaches:
        "<strong>Filter Rows</strong> keeps only the rows that pass a test. Here: keep every row whose <code>amount_text</code> is not “N/A”.",
      goal: "Remove the one row where <strong>amount_text</strong> is “N/A”, leaving 9 rows.",
      excel: { from: "Filter dropdown → untick “N/A” (and hope no one clears the filter).", to: "Filter Rows ≠ N/A — written into the query, never forgotten." },
      palette: [
        { label: "Keep rows where amount_text ≠ 'N/A'", step: { op: "filter", column: "amount_text", test: "notEquals", value: "N/A" } },
        { label: "Keep rows where status = 'Open'", step: { op: "filter", column: "status", test: "equals", value: "Open" } },
        { label: "Remove duplicates · vendor", step: { op: "removeDuplicates", columns: ["vendor"] } },
      ],
      solution: [{ op: "filter", column: "amount_text", test: "notEquals", value: "N/A" }],
      mode: "rows",
      hints: [
        "You want to keep rows where amount_text is not “N/A”.",
        "Filtering on status would drop real invoices — that's not the goal here.",
      ],
      pro: "Filtering out placeholders (N/A, TBD, blanks) before you total is step one of trustworthy numbers — and as a recorded step, it never silently turns itself off.",
    },
  ];
})(window.LL = window.LL || {});
