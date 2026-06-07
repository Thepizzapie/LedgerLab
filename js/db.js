/* =============================================================================
   Ledger Lab — SQL engine
   -----------------------------------------------------------------------------
   Thin wrapper around sql.js (SQLite compiled to WebAssembly). Builds the
   practice database in memory from LL.DATASETS, runs queries, reflects the
   schema for the sidebar, and accepts imported tables. The engine is vendored
   under lib/, so everything runs fully offline.
   ============================================================================= */
(function (LL) {
  "use strict";

  // Where the WASM binary lives (vendored locally for offline use).
  const ENGINE_DIR = "lib/";

  let SQL = null; // the sql.js module
  let db = null;  // the live database

  function quoteIdent(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
  }

  // Build CREATE TABLE + INSERT statements straight from a dataset definition.
  function loadTable(database, tableName, def) {
    const cols = def.columns
      .map((c) => `${quoteIdent(c.name)} ${c.type}`)
      .join(", ");
    database.run(`DROP TABLE IF EXISTS ${quoteIdent(tableName)};`);
    database.run(`CREATE TABLE ${quoteIdent(tableName)} (${cols});`);

    const colNames = def.columns.map((c) => c.name);
    const placeholders = colNames.map(() => "?").join(", ");
    const insert = `INSERT INTO ${quoteIdent(tableName)} (${colNames
      .map(quoteIdent)
      .join(", ")}) VALUES (${placeholders});`;

    const stmt = database.prepare(insert);
    try {
      def.rows.forEach((row) => {
        const values = colNames.map((c) => (row[c] === undefined ? null : row[c]));
        stmt.run(values);
      });
    } finally {
      stmt.free();
    }
  }

  // (Re)build the whole practice database from scratch.
  function buildDatabase() {
    if (db) db.close();
    db = new SQL.Database();
    LL.SQL_TABLES.forEach((name) => loadTable(db, name, LL.DATASETS[name]));
    return db;
  }

  // Load the WASM engine once, then build the database.
  async function init() {
    if (db) return db;
    if (typeof initSqlJs !== "function") {
      throw new Error(
        "The SQL engine script (lib/sql-wasm.js) didn't load. Make sure the " +
          "lib/ folder sits next to index.html."
      );
    }
    SQL = await initSqlJs({ locateFile: (file) => ENGINE_DIR + file });
    return buildDatabase();
  }

  // Add (or replace) a table at runtime — used by CSV import. Registers it so
  // both the SQL engine and the rest of the app (schema panel, Power Query) see
  // it. `def` is { columns:[{name,type}], rows:[{col:val}] }.
  function addTable(name, def, note) {
    if (!db) throw new Error("Database not ready.");
    loadTable(db, name, def);
    LL.DATASETS[name] = def;
    if (LL.SQL_TABLES.indexOf(name) < 0) LL.SQL_TABLES.push(name);
    LL.TABLE_NOTES[name] = note || `imported · ${def.rows.length} rows`;
    LL.IMPORTED = LL.IMPORTED || {};
    LL.IMPORTED[name] = true;
  }

  // Remove an imported table.
  function dropTable(name) {
    if (db) db.run(`DROP TABLE IF EXISTS ${quoteIdent(name)};`);
    delete LL.DATASETS[name];
    delete LL.TABLE_NOTES[name];
    if (LL.IMPORTED) delete LL.IMPORTED[name];
    const i = LL.SQL_TABLES.indexOf(name);
    if (i >= 0) LL.SQL_TABLES.splice(i, 1);
  }

  /* Run a query. Returns:
       { ok: true, columns: [...], values: [[...], ...], rowCount, elapsedMs }
     or
       { ok: false, error: "message" }
     Only the FIRST result set is returned (these lessons are single SELECTs). */
  function run(sql) {
    if (!db) return { ok: false, error: "The database isn't ready yet." };
    const started = performance.now();
    try {
      const res = db.exec(sql); // array of {columns, values}
      const elapsedMs = performance.now() - started;
      if (!res.length) {
        return { ok: true, columns: [], values: [], rowCount: 0, elapsedMs };
      }
      const first = res[0];
      return {
        ok: true,
        columns: first.columns,
        values: first.values,
        rowCount: first.values.length,
        elapsedMs,
      };
    } catch (err) {
      return { ok: false, error: friendlyError(err) };
    }
  }

  // SQLite errors are terse; nudge the most common ones toward plain English.
  function friendlyError(err) {
    let msg = (err && err.message) || String(err);
    msg = msg.replace(/^Error:\s*/i, "");
    if (/no such table/i.test(msg)) {
      msg +=
        " — check the table name against the schema on the left (names are case-insensitive but spelling matters).";
    } else if (/no such column/i.test(msg)) {
      msg += " — that column isn't in this table. Peek at the schema on the left.";
    } else if (/syntax error/i.test(msg)) {
      msg +=
        " — usually a missing comma, an unmatched quote, or a keyword typo.";
    }
    return msg;
  }

  // Reflect the live schema (used by the sidebar). Reads sqlite_master so it
  // always matches what's actually loaded.
  function schema() {
    const out = [];
    LL.SQL_TABLES.forEach((name) => {
      const info = run(`PRAGMA table_info(${quoteIdent(name)});`);
      const columns = info.ok
        ? info.values.map((r) => ({ name: r[1], type: r[2] }))
        : [];
      out.push({ name, note: LL.TABLE_NOTES[name] || "", columns });
    });
    return out;
  }

  LL.DB = { init, run, schema, rebuild: buildDatabase, addTable, dropTable };
})(window.LL = window.LL || {});
