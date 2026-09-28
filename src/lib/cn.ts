/**
 * Conditional className joiner.
 *
 * Kept dependency-free (no `clsx`/`tailwind-merge`) so it can be imported from
 * both server and client components without pulling anything extra into the
 * bundle. Falsy values are dropped; nested arrays are flattened.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(" ");
}
