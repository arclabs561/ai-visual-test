/** Transitional contracts for legacy subpath APIs pending the staged TypeScript migration. */
export type OpaqueFunction = (...args: unknown[]) => unknown;

export declare class OpaqueClass {
  constructor(...args: unknown[]);
  [key: string]: unknown;
}
