declare module 'better-sqlite3' {
  interface Statement<T = Record<string, unknown>[]> {
    all(...params: unknown[]): T;
    get(...params: unknown[]): T | undefined;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }

  interface Database {
    exec(source: string): this;
    prepare(source: string): Statement;
    pragma(source: string, options?: Record<string, unknown>): unknown;
    close(): this;
  }

  namespace Database {
    interface Database {
      exec(source: string): this;
      prepare(source: string): Statement;
      pragma(source: string, options?: Record<string, unknown>): unknown;
      close(): this;
    }
  }

  function Database(filename: string, options?: Record<string, unknown>): Database.Database;

  export = Database;
}