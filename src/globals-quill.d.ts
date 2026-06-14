/**
 * Ambient declaration for the `Quill` rich-text editor, loaded from a CDN at
 * runtime (see `SimpleHtmlField`) rather than bundled. This is a minimal shape
 * covering only the constructor options and instance methods that
 * `SimpleHtmlField` actually uses; it is not the full Quill API.
 */

declare global {
  /** A text selection range returned by `getSelection`. */
  interface QuillRange {
    index: number
    length: number
  }

  /** Options passed to the `Quill` constructor by `SimpleHtmlField`. */
  interface QuillOptions {
    theme?: string
    placeholder?: string
    modules?: {
      toolbar?: {
        container?: HTMLElement | string
      }
    }
  }

  /** A live Quill editor instance. */
  interface QuillInstance {
    /** The editor's root contenteditable element; `.innerHTML` is read and written. */
    root: HTMLElement
    on(event: 'text-change', handler: () => void): void
    off(event: 'text-change'): void
    enable(enabled?: boolean): void
    focus(): void
    getSelection(): QuillRange | null
    getLength(): number
    getText(index: number, length: number): string
    insertText(index: number, text: string): void
    deleteText(index: number, length: number): void
    setSelection(index: number): void
  }

  /** The `Quill` constructor as exposed on `window`. */
  interface QuillConstructor {
    new (container: HTMLElement, options?: QuillOptions): QuillInstance
  }

  interface Window {
    Quill?: QuillConstructor
  }
}

export {}
