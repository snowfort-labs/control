declare module 'better-sqlite3' {
  interface Statement<T = any[]> {
    all(...params: any[]): T;
    get(...params: any[]): T | undefined;
    run(...params: any[]): any;
  }

  interface Database {
    exec(source: string): this;
    prepare(source: string): Statement;
    pragma(source: string, options?: any): any;
    close(): this;
  }

  namespace Database {
    interface Database {
      exec(source: string): this;
      prepare(source: string): Statement;
      pragma(source: string, options?: any): any;
      close(): this;
    }
  }

  function Database(filename: string, options?: any): Database.Database;

  export = Database;
}