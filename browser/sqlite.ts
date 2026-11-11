import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let SQL: SqlJsStatic;
let initial: Uint8Array;
export async function initializeSqlite(data: Uint8Array) {
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl });
  initial = data;
}

// A small compatibility layer lets both builds share the same tested Store.
export class DatabaseSync {
  private database: Database;
  isTransaction = false;
  constructor() { this.database = new SQL.Database(initial); }
  exec(sql: string) {
    this.database.exec(sql);
    if (/^BEGIN/i.test(sql)) this.isTransaction = true;
    if (/^(COMMIT|ROLLBACK)/i.test(sql)) this.isTransaction = false;
  }
  prepare(sql: string) {
    const rows = (...params: SqlValue[]) => {
      const statement = this.database.prepare(sql);
      try {
        statement.bind(params);
        const values: Record<string, SqlValue>[] = [];
        while (statement.step()) values.push(statement.getAsObject());
        return values;
      } finally { statement.free(); }
    };
    return {
      all: rows,
      get: (...params: SqlValue[]) => rows(...params)[0],
      run: (...params: SqlValue[]) => {
        this.database.run(sql, params);
        return { changes: this.database.getRowsModified(), lastInsertRowid: this.database.exec('SELECT last_insert_rowid()')[0].values[0][0] as number };
      },
    };
  }
  export() { return this.database.export(); }
  close() { this.database.close(); }
}
