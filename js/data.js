/* =============================================================================
   Ledger Lab — datasets
   -----------------------------------------------------------------------------
   One source of truth for both the live SQL engine (loaded into SQLite/WASM)
   and the Power Query simulator (operates on the same row objects).

   The data is deliberately messy in the ways accountants actually meet:
   trailing spaces, inconsistent case, duplicate vendors, amounts stored as
   text with $ signs and parentheses, placeholder junk like "N/A", and a
   wide "months-as-columns" budget that begs to be unpivoted.
   ============================================================================= */
(function (LL) {
  "use strict";

  // --- Vendor list, straight out of an old system. A mess. --------------------
  // Note the trailing spaces, mixed case, and near-duplicate rows.
  const vendors_raw = {
    columns: [
      { name: "row_id", type: "INTEGER" },
      { name: "vendor_name", type: "TEXT" },
      { name: "category", type: "TEXT" },
      { name: "terms", type: "TEXT" },
      { name: "status", type: "TEXT" },
    ],
    rows: [
      { row_id: 1,  vendor_name: " Acme Corp",          category: "Office Supplies", terms: "Net 30", status: "Active" },
      { row_id: 2,  vendor_name: "ACME CORP ",          category: "office supplies", terms: "Net 30", status: "active" },
      { row_id: 3,  vendor_name: "Globex LLC",          category: "Travel",          terms: "Net 15", status: "Active" },
      { row_id: 4,  vendor_name: "globex llc",          category: "travel ",         terms: "Net 15", status: "Active" },
      { row_id: 5,  vendor_name: "Initech",             category: "Software",        terms: "Net 45", status: "Active" },
      { row_id: 6,  vendor_name: "Initech ",            category: "software",        terms: "Net 45", status: "ACTIVE" },
      { row_id: 7,  vendor_name: "Umbrella Inc",        category: "Utilities",       terms: "Net 30", status: "Inactive" },
      { row_id: 8,  vendor_name: "Wayne Enterprises",   category: "Consulting",      terms: "Net 60", status: "Active" },
      { row_id: 9,  vendor_name: "wayne enterprises ",  category: "Consulting",      terms: "Net 60", status: "active" },
      { row_id: 10, vendor_name: "Stark Industries",    category: "Equipment",       terms: "Net 30", status: "Active" },
      { row_id: 11, vendor_name: "Hooli",               category: "Software",        terms: "Net 45", status: "Active" },
      { row_id: 12, vendor_name: "Soylent Corp",        category: "Food Service",    terms: "Net 30", status: "Inactive" },
    ],
  };

  // --- Clean vendor master. The "right answer" the raw list should become. ----
  const vendors = {
    columns: [
      { name: "vendor_id", type: "INTEGER" },
      { name: "vendor_name", type: "TEXT" },
      { name: "category", type: "TEXT" },
      { name: "terms", type: "TEXT" },
    ],
    rows: [
      { vendor_id: 1, vendor_name: "Acme Corp",        category: "Office Supplies", terms: "Net 30" },
      { vendor_id: 2, vendor_name: "Globex LLC",       category: "Travel",          terms: "Net 15" },
      { vendor_id: 3, vendor_name: "Initech",          category: "Software",        terms: "Net 45" },
      { vendor_id: 4, vendor_name: "Umbrella Inc",     category: "Utilities",       terms: "Net 30" },
      { vendor_id: 5, vendor_name: "Wayne Enterprises", category: "Consulting",     terms: "Net 60" },
      { vendor_id: 6, vendor_name: "Stark Industries", category: "Equipment",       terms: "Net 30" },
      { vendor_id: 7, vendor_name: "Hooli",            category: "Software",        terms: "Net 45" },
      { vendor_id: 8, vendor_name: "Soylent Corp",     category: "Food Service",    terms: "Net 30" },
    ],
  };

  // --- General ledger lines. Amounts are clean numbers here (expenses +, ------
  // refunds/credits -). One line points at a vendor that isn't in the master
  // (vendor_id 99) — a classic orphaned record for the reconciliation lesson.
  const gl_entries = {
    columns: [
      { name: "txn_id", type: "INTEGER" },
      { name: "entry_date", type: "TEXT" },
      { name: "account_code", type: "TEXT" },
      { name: "account_name", type: "TEXT" },
      { name: "vendor_id", type: "INTEGER" },
      { name: "amount", type: "REAL" },
      { name: "memo", type: "TEXT" },
    ],
    rows: [
      { txn_id: 101, entry_date: "2026-01-05", account_code: "6000", account_name: "Office Supplies", vendor_id: 1,    amount: 234.50,  memo: "Printer paper & toner" },
      { txn_id: 102, entry_date: "2026-01-09", account_code: "6100", account_name: "Travel",          vendor_id: 2,    amount: 1180.00, memo: "Flights — audit visit" },
      { txn_id: 103, entry_date: "2026-01-14", account_code: "6200", account_name: "Software",        vendor_id: 3,    amount: 499.00,  memo: "Annual license" },
      { txn_id: 104, entry_date: "2026-01-22", account_code: "6300", account_name: "Utilities",       vendor_id: 4,    amount: 312.78,  memo: "Electricity — Jan" },
      { txn_id: 105, entry_date: "2026-01-28", account_code: "6100", account_name: "Travel",          vendor_id: 2,    amount: -180.00, memo: "Refund — cancelled hotel" },
      { txn_id: 106, entry_date: "2026-02-03", account_code: "6400", account_name: "Consulting",      vendor_id: 5,    amount: 4200.00, memo: "Q1 advisory retainer" },
      { txn_id: 107, entry_date: "2026-02-08", account_code: "7000", account_name: "Equipment",       vendor_id: 6,    amount: 2750.00, memo: "Standing desks (x5)" },
      { txn_id: 108, entry_date: "2026-02-12", account_code: "6200", account_name: "Software",        vendor_id: 7,    amount: 89.99,   memo: "Cloud storage" },
      { txn_id: 109, entry_date: "2026-02-15", account_code: "6000", account_name: "Office Supplies", vendor_id: 1,    amount: 76.25,   memo: "Pens, folders" },
      { txn_id: 110, entry_date: "2026-02-19", account_code: "6300", account_name: "Utilities",       vendor_id: 4,    amount: 298.40,  memo: "Electricity — Feb" },
      { txn_id: 111, entry_date: "2026-02-24", account_code: "6400", account_name: "Consulting",      vendor_id: 99,   amount: 950.00,  memo: "One-off legal review" },
      { txn_id: 112, entry_date: "2026-03-02", account_code: "6100", account_name: "Travel",          vendor_id: 2,    amount: 540.00,  memo: "Rail + lodging" },
      { txn_id: 113, entry_date: "2026-03-06", account_code: "6200", account_name: "Software",        vendor_id: 3,    amount: 499.00,  memo: "Annual license — dept 2" },
      { txn_id: 114, entry_date: "2026-03-11", account_code: "7000", account_name: "Equipment",       vendor_id: 6,    amount: 1299.00, memo: "Conference room display" },
      { txn_id: 115, entry_date: "2026-03-18", account_code: "6000", account_name: "Office Supplies", vendor_id: null, amount: 42.10,   memo: "Petty cash — coffee" },
      { txn_id: 116, entry_date: "2026-03-25", account_code: "6300", account_name: "Utilities",       vendor_id: 4,    amount: 305.66,  memo: "Electricity — Mar" },
    ],
  };

  // --- Accounts payable, fresh from a CSV export. Amounts are TEXT with -------
  // dollar signs, commas, stray spaces, and parentheses for negatives.
  // Status is a free-text disaster. due_date is clean ISO so we can age it.
  const ap_invoices = {
    columns: [
      { name: "inv_id", type: "INTEGER" },
      { name: "vendor", type: "TEXT" },
      { name: "invoice_date", type: "TEXT" },
      { name: "due_date", type: "TEXT" },
      { name: "amount_text", type: "TEXT" },
      { name: "status", type: "TEXT" },
    ],
    rows: [
      { inv_id: 5001, vendor: "Acme Corp",         invoice_date: "2026-03-01", due_date: "2026-03-31", amount_text: "$1,234.50", status: "Open" },
      { inv_id: 5002, vendor: "Globex LLC",        invoice_date: "2026-03-04", due_date: "2026-03-19", amount_text: "  89.99 ", status: "paid " },
      { inv_id: 5003, vendor: "Initech",           invoice_date: "2026-02-10", due_date: "2026-03-27", amount_text: "1200",      status: "PAID" },
      { inv_id: 5004, vendor: "Wayne Enterprises", invoice_date: "2026-02-15", due_date: "2026-04-15", amount_text: "$2,000",    status: "Open" },
      { inv_id: 5005, vendor: "Umbrella Inc",      invoice_date: "2026-01-30", due_date: "2026-03-01", amount_text: "(450.00)",  status: "overdue" },
      { inv_id: 5006, vendor: "Stark Industries",  invoice_date: "2026-04-02", due_date: "2026-05-02", amount_text: "$ 540.00",  status: "Open " },
      { inv_id: 5007, vendor: "Hooli",             invoice_date: "2026-03-12", due_date: "2026-04-11", amount_text: "75.25",     status: "open" },
      { inv_id: 5008, vendor: "Soylent Corp",      invoice_date: "2026-03-20", due_date: "2026-04-19", amount_text: "N/A",       status: "Open" },
      { inv_id: 5009, vendor: "Acme Corp",         invoice_date: "2026-02-22", due_date: "2026-03-08", amount_text: "(125.00)",  status: "Overdue" },
      { inv_id: 5010, vendor: "Globex LLC",        invoice_date: "2026-04-05", due_date: "2026-05-05", amount_text: "$330.10",   status: "open " },
    ],
  };

  // --- A budget in the shape accountants always receive it: one column -------
  // per month. Tidy analysis needs it tall, not wide → the Unpivot lesson.
  const budget_wide = {
    columns: [
      { name: "account", type: "TEXT" },
      { name: "Jan", type: "REAL" },
      { name: "Feb", type: "REAL" },
      { name: "Mar", type: "REAL" },
      { name: "Apr", type: "REAL" },
    ],
    rows: [
      { account: "Office Supplies", Jan: 300, Feb: 280, Mar: 310, Apr: 295 },
      { account: "Travel",          Jan: 1200, Feb: 0,  Mar: 1500, Apr: 900 },
      { account: "Software",        Jan: 500, Feb: 90,  Mar: 500, Apr: 90 },
      { account: "Utilities",       Jan: 320, Feb: 300, Mar: 305, Apr: 310 },
    ],
  };

  // --- A monthly export with the repeated label cells blanked out (Excel ------
  // "merge & center" residue). Perfect for Fill Down.
  const dept_export = {
    columns: [
      { name: "department", type: "TEXT" },
      { name: "line_item", type: "TEXT" },
      { name: "amount", type: "REAL" },
    ],
    rows: [
      { department: "Finance",    line_item: "Subscriptions", amount: 120 },
      { department: "",           line_item: "Training",      amount: 450 },
      { department: "",           line_item: "Travel",        amount: 780 },
      { department: "Operations", line_item: "Supplies",      amount: 210 },
      { department: "",           line_item: "Maintenance",   amount: 640 },
      { department: "Sales",      line_item: "Travel",        amount: 1300 },
      { department: "",           line_item: "Client meals",  amount: 320 },
    ],
  };

  LL.DATASETS = {
    vendors_raw,
    vendors,
    gl_entries,
    ap_invoices,
    budget_wide,
    dept_export,
  };

  // Which tables go into the SQL engine (the wide/blanked ones live only in
  // the Power Query simulator, where their shape is the whole point).
  LL.SQL_TABLES = ["vendors_raw", "vendors", "gl_entries", "ap_invoices"];

  // A fixed "today" so date math (aging) is reproducible regardless of clock.
  LL.TODAY = "2026-06-07";

  // Plain-English notes shown in the schema sidebar.
  LL.TABLE_NOTES = {
    vendors_raw: "Raw vendor export — messy, has duplicates.",
    vendors: "Clean vendor master (the lookup table).",
    gl_entries: "General ledger journal lines.",
    ap_invoices: "Accounts payable — amounts stored as text.",
    budget_wide: "Budget with one column per month (Power Query only).",
    dept_export: "Export with blanked repeat cells (Power Query only).",
  };
})(window.LL = window.LL || {});
