/* =============================================================================
   Ledger Lab — SQL lessons
   -----------------------------------------------------------------------------
   Each lesson is one idea, wrapped in a real accounting moment. The reference
   `solution` is executed live to produce the expected answer, so the grader is
   always in sync with the data. Keep scenarios short — the whole point is to
   not overwhelm anyone.

   mode: "run"     → passes when the query runs and returns at least one row
         "rows"    → row order doesn't matter
         "ordered" → row order matters (ORDER BY lessons)
   ============================================================================= */
(function (LL) {
  "use strict";

  LL.SQL_LESSONS = [
    {
      id: "sql-01-select",
      title: "Look before you touch",
      tag: "SELECT",
      tables: ["vendors_raw"],
      scenario:
        "Someone just handed you a vendor list exported from the old system and asked you to “tidy it up.” Rule one of cleaning data like a pro: <em>look at it first</em>. Never clean what you haven't seen.",
      teaches:
        "<code>SELECT</code> asks for columns; <code>FROM</code> says which table. <code>SELECT *</code> means “every column.” Press <strong>Run</strong> and read what you got.",
      goal: "Show the whole <code>vendors_raw</code> table.",
      excel: { from: "Open the sheet and scroll.", to: "<code>SELECT * FROM vendors_raw;</code> — same look, but repeatable." },
      starter: "SELECT *\nFROM vendors_raw;",
      solution: "SELECT * FROM vendors_raw;",
      mode: "run",
      hints: [
        "Nothing to fix yet — just press Run.",
        "Notice the vendor names: leading spaces, stray capitals, and some look like duplicates. That's your to-do list.",
      ],
      pro: "Pros always preview the raw data before changing a single value. You just spotted the spacing and duplicate problems by eye.",
    },

    {
      id: "sql-02-columns",
      title: "Take only what you need",
      tag: "SELECT columns",
      tables: ["vendors_raw"],
      scenario:
        "Twelve columns of export, but you only care about <em>who</em> the vendor is and <em>what</em> they supply. Grabbing fewer columns keeps your workpaper clean and your reviewer happy.",
      teaches:
        "Instead of <code>*</code>, list the exact columns you want, separated by commas.",
      goal: "Return just <code>vendor_name</code> and <code>category</code>.",
      starter: "SELECT *\nFROM vendors_raw;",
      solution: "SELECT vendor_name, category FROM vendors_raw;",
      mode: "rows",
      hints: [
        "Replace the <code>*</code> with the two column names.",
        "<code>SELECT vendor_name, category FROM vendors_raw;</code>",
      ],
      pro: "Selecting specific columns is the SQL version of hiding the columns you don't need — except no one can accidentally unhide them later.",
    },

    {
      id: "sql-03-trim",
      title: "The invisible problem: spaces",
      tag: "TRIM",
      tables: ["vendors_raw"],
      scenario:
        "“ Acme Corp” and “Acme Corp” look identical on screen, but that leading space means your VLOOKUP returns #N/A and your totals split in two. Trailing and leading spaces are the #1 silent killer of accounting data.",
      teaches:
        "<code>TRIM(column)</code> removes spaces from both ends of a value. You wrap the function around the column you want to fix.",
      goal: "Return every vendor name with the surrounding spaces removed (one column).",
      excel: { from: "<code>=TRIM(A2)</code> dragged down the column.", to: "<code>TRIM(vendor_name)</code> — applied to all rows at once." },
      starter: "SELECT vendor_name\nFROM vendors_raw;",
      solution: "SELECT TRIM(vendor_name) AS clean_name FROM vendors_raw;",
      mode: "rows",
      hints: [
        "Wrap <code>vendor_name</code> in the <code>TRIM( )</code> function.",
        "You can rename the result with <code>AS</code>, e.g. <code>AS clean_name</code> — the name doesn't affect grading.",
        "<code>SELECT TRIM(vendor_name) AS clean_name FROM vendors_raw;</code>",
      ],
      pro: "Whenever a lookup “mysteriously” fails, suspect spaces first. TRIM is the first reflex of anyone who cleans data for a living.",
    },

    {
      id: "sql-04-upper",
      title: "Make it match",
      tag: "UPPER · TRIM",
      tables: ["vendors_raw"],
      scenario:
        "“ACME CORP”, “Acme Corp”, “acme corp ” — to a human, one vendor. To a computer, three. To total spend by vendor correctly, every name has to be written the <em>same</em> way.",
      teaches:
        "Stack functions to fix two things at once: <code>UPPER( TRIM(column) )</code> trims the spaces, then forces a single consistent case. Functions run inside-out.",
      goal: "Return each vendor name trimmed <em>and</em> in capitals, so duplicates line up.",
      excel: { from: "<code>=UPPER(TRIM(A2))</code>", to: "<code>UPPER(TRIM(vendor_name))</code> — the exact same idea." },
      starter: "SELECT TRIM(vendor_name) AS clean_name\nFROM vendors_raw;",
      solution: "SELECT UPPER(TRIM(vendor_name)) AS clean_name FROM vendors_raw;",
      mode: "rows",
      hints: [
        "Wrap your existing <code>TRIM(vendor_name)</code> inside <code>UPPER( )</code>.",
        "Read it inside-out: TRIM first, then UPPER.",
        "<code>SELECT UPPER(TRIM(vendor_name)) AS clean_name FROM vendors_raw;</code>",
      ],
      pro: "Standardizing case + trimming is how you turn “three vendors” back into one. Notice “ACME CORP” now appears twice, identically — that's the duplicate revealing itself.",
    },

    {
      id: "sql-05-where",
      title: "Throw out the junk rows",
      tag: "WHERE",
      tables: ["ap_invoices"],
      scenario:
        "This AP export has a row where the amount is literally the text “N/A” — a placeholder someone typed instead of a number. Junk rows like this wreck totals. Pros filter them out before doing anything else.",
      teaches:
        "<code>WHERE</code> keeps only the rows that pass a test. <code>&lt;&gt;</code> means “not equal to.”",
      goal: "List <code>inv_id</code>, <code>vendor</code>, and <code>amount_text</code> for every invoice <em>except</em> the “N/A” one.",
      excel: { from: "Filter dropdown → untick “N/A”.", to: "<code>WHERE amount_text &lt;&gt; 'N/A'</code> — a filter that's written down and repeatable." },
      starter: "SELECT inv_id, vendor, amount_text\nFROM ap_invoices;",
      solution: "SELECT inv_id, vendor, amount_text FROM ap_invoices WHERE amount_text <> 'N/A';",
      mode: "rows",
      hints: [
        "Add a <code>WHERE</code> line at the end.",
        "Text values go in single quotes: <code>'N/A'</code>.",
        "<code>... FROM ap_invoices WHERE amount_text &lt;&gt; 'N/A';</code>",
      ],
      pro: "Filtering out placeholders (N/A, TBD, blanks) before you total is the difference between a report you trust and one you don't.",
    },

    {
      id: "sql-06-groupby-count",
      title: "Catch the duplicates",
      tag: "GROUP BY · COUNT · HAVING",
      tables: ["vendors_raw"],
      scenario:
        "You suspect the vendor list has duplicates, but eyeballing 12 rows doesn't scale to 12,000. Let the database count for you: group the cleaned names together and flag any that appear more than once.",
      teaches:
        "<code>GROUP BY</code> collapses identical values into one row; <code>COUNT(*)</code> counts how many fell into each group; <code>HAVING</code> filters those groups.",
      goal: "Show each cleaned vendor name (trimmed + capitals) that appears more than once, with its count.",
      starter:
        "SELECT UPPER(TRIM(vendor_name)) AS clean_name, COUNT(*) AS n\nFROM vendors_raw\nGROUP BY UPPER(TRIM(vendor_name));",
      solution:
        "SELECT UPPER(TRIM(vendor_name)) AS clean_name, COUNT(*) AS n FROM vendors_raw GROUP BY UPPER(TRIM(vendor_name)) HAVING COUNT(*) > 1;",
      mode: "rows",
      hints: [
        "The starter already groups and counts — you just need to keep only the groups with more than one.",
        "Use <code>HAVING COUNT(*) &gt; 1</code> (HAVING filters groups; WHERE filters rows).",
        "<code>... GROUP BY UPPER(TRIM(vendor_name)) HAVING COUNT(*) &gt; 1;</code>",
      ],
      pro: "<code>GROUP BY ... HAVING COUNT(*) &gt; 1</code> is the universal “find me the duplicates” recipe. You'll reuse it forever.",
    },

    {
      id: "sql-07-clean-amounts",
      title: "When money is stored as text",
      tag: "REPLACE · CAST",
      tables: ["ap_invoices"],
      scenario:
        "The amounts came in as text: “$1,234.50”, “(450.00)”, “ 89.99 ”. You can't SUM text. First strip the dollar signs and commas, turn the accountant's parentheses into a real negative, then convert to a number.",
      teaches:
        "<code>REPLACE(text, find, '')</code> deletes characters. <code>CAST(text AS REAL)</code> turns clean text into a number. A <code>CASE</code> handles the “(…)” = negative convention.",
      goal: "Return <code>inv_id</code> and a numeric <code>amount</code> for every invoice except the “N/A” one. Parentheses should become negatives.",
      excel: { from: "<code>=VALUE(SUBSTITUTE(SUBSTITUTE(A2,\"$\",\"\"),\",\",\"\"))</code> and a manual fix for the (parentheses).", to: "One query that does all of it, every time." },
      starter:
        "SELECT inv_id, amount_text\nFROM ap_invoices\nWHERE amount_text <> 'N/A';",
      solution:
        "SELECT inv_id,\n  CASE WHEN TRIM(amount_text) LIKE '(%)'\n       THEN -CAST(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(amount_text),'(',''),')',''),'$',''),',','') AS REAL)\n       ELSE CAST(REPLACE(REPLACE(REPLACE(TRIM(amount_text),'$',''),',',''),' ','') AS REAL)\n  END AS amount\nFROM ap_invoices\nWHERE amount_text <> 'N/A';",
      mode: "rows",
      hints: [
        "Build it up in layers. First strip the symbols: <code>REPLACE(REPLACE(amount_text,'$',''),',','')</code>.",
        "Then convert to a number by wrapping it in <code>CAST( ... AS REAL)</code>.",
        "Negatives are written “(450.00)”. Detect them with <code>WHERE TRIM(amount_text) LIKE '(%)'</code> and a <code>CASE</code>, removing the brackets and putting a minus sign in front.",
        "The full pattern is in “Show solution” if you want to study it — this is the hardest cleanup in the track.",
      ],
      pro: "Numbers trapped as text is one of the most common real-world messes. The REPLACE-then-CAST sandwich is your go-to rescue.",
    },

    {
      id: "sql-08-sum",
      title: "A pivot table in one line",
      tag: "GROUP BY · SUM · ORDER BY",
      tables: ["gl_entries"],
      scenario:
        "The controller wants spend by account, biggest first, for the close meeting in ten minutes. In Excel that's a PivotTable. In SQL it's one line — and it refreshes itself next month.",
      teaches:
        "<code>GROUP BY</code> sets the rows of your pivot; <code>SUM()</code> is the value; <code>ORDER BY ... DESC</code> sorts biggest to smallest.",
      goal: "Total <code>amount</code> per <code>account_name</code>, sorted from highest total to lowest.",
      excel: { from: "Insert → PivotTable, drag account to Rows, amount to Values, sort.", to: "<code>SELECT account_name, SUM(amount) ... GROUP BY account_name ORDER BY ... DESC</code>" },
      starter:
        "SELECT account_name, SUM(amount) AS total\nFROM gl_entries\nGROUP BY account_name;",
      solution:
        "SELECT account_name, SUM(amount) AS total FROM gl_entries GROUP BY account_name ORDER BY total DESC;",
      mode: "ordered",
      hints: [
        "The starter already builds the pivot — it just isn't sorted.",
        "Add <code>ORDER BY total DESC</code> at the end (<code>DESC</code> = largest first).",
        "<code>... GROUP BY account_name ORDER BY total DESC;</code>",
      ],
      pro: "<code>GROUP BY</code> + <code>SUM</code> is a PivotTable that never breaks when someone inserts a row. This is the single most useful pattern in analytical SQL.",
    },

    {
      id: "sql-09-case",
      title: "Standardize the status column",
      tag: "CASE",
      tables: ["ap_invoices"],
      scenario:
        "The status field is a free-text free-for-all: “paid ”, “PAID”, “Open ”, “overdue”. Before you can report “% paid,” every value has to map to one clean label.",
      teaches:
        "<code>CASE WHEN … THEN … ELSE … END</code> is SQL's IF/ELSE. Combined with <code>LOWER(TRIM())</code>, it folds every messy spelling into one tidy bucket.",
      goal: "Return <code>inv_id</code> and a <code>status_clean</code> that is exactly “Paid”, “Open”, or “Overdue”.",
      excel: { from: "Nested <code>IF</code>s, or find-and-replace done five times by hand.", to: "One <code>CASE</code> that documents every rule in one place." },
      starter:
        "SELECT inv_id, status\nFROM ap_invoices;",
      solution:
        "SELECT inv_id,\n  CASE LOWER(TRIM(status))\n    WHEN 'paid' THEN 'Paid'\n    WHEN 'open' THEN 'Open'\n    WHEN 'overdue' THEN 'Overdue'\n    ELSE 'Unknown'\n  END AS status_clean\nFROM ap_invoices;",
      mode: "rows",
      hints: [
        "First neutralize the spaces and case with <code>LOWER(TRIM(status))</code>.",
        "Then map each clean value: <code>CASE LOWER(TRIM(status)) WHEN 'paid' THEN 'Paid' ... END</code>.",
        "Cover 'paid', 'open', and 'overdue', with an <code>ELSE 'Unknown'</code> safety net.",
      ],
      pro: "CASE is how you turn human-typed chaos into a clean dimension you can group and report on. Always include an ELSE to catch the unexpected.",
    },

    {
      id: "sql-10-join",
      title: "VLOOKUP that never breaks",
      tag: "JOIN",
      tables: ["gl_entries", "vendors"],
      scenario:
        "Your GL lines only carry a <code>vendor_id</code>. The names and categories live in the vendor master. You need them side by side — the exact job VLOOKUP does in Excel, except a JOIN won't shift when columns move.",
      teaches:
        "<code>JOIN</code> stitches two tables together where a key matches. <code>ON g.vendor_id = v.vendor_id</code> is the match rule. Prefix columns with the table letter to be clear.",
      goal: "For each GL line show <code>txn_id</code>, <code>amount</code>, the vendor's <code>vendor_name</code> and <code>category</code>.",
      excel: { from: "<code>=VLOOKUP(vendor_id, master, 2, FALSE)</code> per column you want.", to: "<code>JOIN vendors v ON g.vendor_id = v.vendor_id</code> — pull as many columns as you like." },
      starter:
        "SELECT g.txn_id, g.amount\nFROM gl_entries g\nJOIN vendors v ON g.vendor_id = v.vendor_id;",
      solution:
        "SELECT g.txn_id, g.amount, v.vendor_name, v.category FROM gl_entries g JOIN vendors v ON g.vendor_id = v.vendor_id;",
      mode: "rows",
      hints: [
        "The JOIN is already wired up — you just need to also select the vendor columns.",
        "Add <code>v.vendor_name</code> and <code>v.category</code> to the SELECT list.",
        "<code>SELECT g.txn_id, g.amount, v.vendor_name, v.category FROM ...</code>",
      ],
      pro: "A JOIN is VLOOKUP that pulls any number of columns and never returns #N/A because someone re-sorted the lookup table. Notice you got 14 rows, not 16 — two GL lines have no matching vendor. That's the next lesson.",
    },

    {
      id: "sql-11-leftjoin",
      title: "Find what doesn't reconcile",
      tag: "LEFT JOIN · IS NULL",
      tables: ["gl_entries", "vendors"],
      scenario:
        "Two GL lines reference a vendor that isn't in the master (one has a bad id, one has none at all). These are exactly the items that fall through the cracks at reconciliation. Let's surface them on purpose.",
      teaches:
        "A <code>LEFT JOIN</code> keeps <em>every</em> left-table row even when there's no match — the missing side comes back empty. Filtering <code>WHERE v.vendor_id IS NULL</code> isolates the unmatched ones.",
      goal: "List <code>txn_id</code>, <code>amount</code>, <code>memo</code>, and <code>vendor_id</code> for GL lines with <em>no</em> matching vendor.",
      excel: { from: "VLOOKUP, then manually hunt for every #N/A.", to: "<code>LEFT JOIN … WHERE v.vendor_id IS NULL</code> — the misfits, automatically." },
      starter:
        "SELECT g.txn_id, g.amount, g.memo, g.vendor_id\nFROM gl_entries g\nLEFT JOIN vendors v ON g.vendor_id = v.vendor_id;",
      solution:
        "SELECT g.txn_id, g.amount, g.memo, g.vendor_id FROM gl_entries g LEFT JOIN vendors v ON g.vendor_id = v.vendor_id WHERE v.vendor_id IS NULL;",
      mode: "rows",
      hints: [
        "Start from the LEFT JOIN in the starter — it keeps all GL lines, matched or not.",
        "The unmatched rows are the ones where the vendor side came back empty: <code>WHERE v.vendor_id IS NULL</code>.",
        "<code>... LEFT JOIN vendors v ON g.vendor_id = v.vendor_id WHERE v.vendor_id IS NULL;</code>",
      ],
      pro: "“LEFT JOIN … WHERE other_side IS NULL” is the reconciliation pattern: show me everything on this side that has no partner on that side. Bank vs. book, GL vs. sub-ledger — same move every time.",
    },
    {
      id: "sql-12-aging",
      title: "Build an AR aging report",
      tag: "CASE · dates",
      tables: ["ap_invoices"],
      scenario:
        "Month-end, and someone wants the aging: how overdue is every open invoice, bucketed 0–30, 31–60, 61–90, 90+? The due dates are clean ISO dates, so you can do real date math against today (2026-06-07).",
      teaches:
        "<code>julianday(date)</code> turns a date into a number of days, so subtracting two of them gives the gap. Wrap the gap in a <code>CASE</code> to label each bucket.",
      goal: "Show <code>inv_id</code>, <code>due_date</code>, a <code>days_past_due</code>, and an <code>aging_bucket</code> of “0-30”, “31-60”, “61-90”, or “90+”, measured against 2026-06-07.",
      excel: { from: "<code>=TODAY()-D2</code>, then nested <code>IF</code>s for the buckets.", to: "<code>julianday()</code> for the gap, one <code>CASE</code> for the buckets." },
      starter: "SELECT inv_id, due_date\nFROM ap_invoices;",
      solution:
        "SELECT inv_id, due_date,\n  CAST(julianday('2026-06-07') - julianday(due_date) AS INTEGER) AS days_past_due,\n  CASE\n    WHEN julianday('2026-06-07') - julianday(due_date) <= 30 THEN '0-30'\n    WHEN julianday('2026-06-07') - julianday(due_date) <= 60 THEN '31-60'\n    WHEN julianday('2026-06-07') - julianday(due_date) <= 90 THEN '61-90'\n    ELSE '90+'\n  END AS aging_bucket\nFROM ap_invoices;",
      mode: "rows",
      hints: [
        "Days overdue = <code>julianday('2026-06-07') - julianday(due_date)</code>. Wrap it in <code>CAST(... AS INTEGER)</code> for a whole number.",
        "Then a <code>CASE</code> with <code>WHEN ... &lt;= 30 THEN '0-30'</code>, <code>&lt;= 60 THEN '31-60'</code>, and so on, with <code>ELSE '90+'</code>.",
        "Use the “Show solution” button to study the full pattern if the date math is new — it's worth keeping as a template.",
      ],
      pro: "Aging buckets with julianday + CASE is a report you'll rebuild constantly (AR, AP, inventory). Save this pattern.",
    },

    {
      id: "sql-13-cte",
      title: "Clean, then total — in one query",
      tag: "WITH (CTE)",
      tables: ["ap_invoices"],
      scenario:
        "The real job is rarely one step. You need spend per vendor — but the amounts are still text. A <em>CTE</em> lets you clean first in a named block, then total the clean result, all in a single, readable query.",
      teaches:
        "<code>WITH name AS ( … )</code> defines a temporary, named result you can then <code>SELECT</code> from as if it were a table. Clean inside it; aggregate outside it.",
      goal: "Total the cleaned amount per <code>vendor</code> (skip the “N/A” invoice), highest total first.",
      excel: { from: "A helper sheet to clean, then a PivotTable on top of it.", to: "One query: a <code>WITH</code> block to clean, a <code>GROUP BY</code> to total." },
      starter:
        "WITH cleaned AS (\n  SELECT vendor, amount_text\n  FROM ap_invoices\n  WHERE amount_text <> 'N/A'\n)\nSELECT vendor, COUNT(*) AS n\nFROM cleaned\nGROUP BY vendor;",
      solution:
        "WITH cleaned AS (\n  SELECT vendor,\n    CASE WHEN TRIM(amount_text) LIKE '(%)'\n         THEN -CAST(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(amount_text),'(',''),')',''),'$',''),',','') AS REAL)\n         ELSE CAST(REPLACE(REPLACE(REPLACE(TRIM(amount_text),'$',''),',',''),' ','') AS REAL)\n    END AS amount\n  FROM ap_invoices\n  WHERE amount_text <> 'N/A'\n)\nSELECT vendor, SUM(amount) AS total\nFROM cleaned\nGROUP BY vendor\nORDER BY total DESC;",
      mode: "ordered",
      hints: [
        "Reuse your amount-cleaning <code>CASE</code> from the “money as text” drill — but put it inside the <code>WITH cleaned AS ( … )</code> block.",
        "Outside the block, <code>SELECT vendor, SUM(amount) AS total FROM cleaned GROUP BY vendor</code>.",
        "Finish with <code>ORDER BY total DESC</code> for the report order.",
      ],
      pro: "Clean in a CTE, aggregate on top — this “stage then summarize” shape is how real analyses stay readable. You just did the whole job in one query.",
    },
  ];
})(window.LL = window.LL || {});
