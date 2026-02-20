/**
 * Dynamic import wrapper for the ESM-only `nanoid` package.
 *
 * NestJS projects compile to CommonJS, which cannot statically import
 * ESM-only packages. Using `await import()` (a dynamic import) works in
 * both CJS and ESM contexts, allowing us to keep the project as CJS while
 * still consuming nanoid v5+.
 *
 * The import is cached after the first call so subsequent uses are
 * synchronous-equivalent in terms of overhead.
 */
let _nanoid: ((size?: number) => string) | null = null;

/**
 * Returns the `nanoid` function, lazily loaded from the ESM-only package.
 *
 * @example
 * const nanoid = await getNanoid();
 * const id = nanoid(8).toUpperCase();
 */
export async function getNanoid(): Promise<(size?: number) => string> {
  if (!_nanoid) {
    const { nanoid } = await import('nanoid');
    _nanoid = nanoid;
  }
  return _nanoid;
}
