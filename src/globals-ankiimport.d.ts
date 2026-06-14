/**
 * Ambient declarations for the CDN globals the .apkg importer relies on.
 *
 * `ankiImporter.ts` loads three libraries from CDN <script> tags at runtime
 * (JSZip for the zip container, sql.js for the embedded SQLite collection, and
 * an optional anki-reader fallback) rather than via npm imports. Each library
 * attaches a global onto `window`; these declarations describe the minimal
 * surface the importer actually touches. Anything not used here is left as
 * `unknown` / `any` deliberately so we don't over-specify third-party shapes.
 */

declare global {
  // --- JSZip --------------------------------------------------------------

  /** A single entry inside a loaded zip archive (only the methods we call). */
  interface JSZipFile {
    async(type: 'string'): Promise<string>
    async(type: 'arraybuffer'): Promise<ArrayBuffer>
    async(type: 'uint8array'): Promise<Uint8Array>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async(type: string): Promise<any>
  }

  /** A loaded zip archive. */
  interface JSZipArchive {
    file(name: string): JSZipFile | null
  }

  /** The JSZip global constructor surface used by the importer. */
  interface JSZipStatic {
    loadAsync(data: Blob | ArrayBuffer | Uint8Array): Promise<JSZipArchive>
  }

  // --- sql.js -------------------------------------------------------------

  /** A prepared statement handle returned by `db.prepare`. */
  interface SqlJsStatement {
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): void
  }

  /** An open sql.js database. */
  interface SqlJsDatabase {
    prepare(sql: string): SqlJsStatement
  }

  /** The sql.js module returned by `initSqlJs(...)`. */
  interface SqlJsStatic {
    Database: new (data: Uint8Array) => SqlJsDatabase
  }

  /** Options accepted by `initSqlJs`. */
  interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  interface Window {
    JSZip?: JSZipStatic
    initSqlJs?: (config?: InitSqlJsConfig) => Promise<SqlJsStatic>
    // anki-reader is an optional fallback with an unspecified surface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AnkiReader?: any
  }
}

export {}
