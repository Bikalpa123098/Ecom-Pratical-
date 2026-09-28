import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Next.js builds one server-action module per `"use server"` file, and every
 * top-level export has to be an async function. A single non-function export —
 * a plain object, a Zod schema, a constant — fails the *whole* module when it
 * is first imported, which takes down every action in that file at once:
 *
 *   A "use server" file can only export async functions, found object.
 *
 * That is a runtime module-evaluation failure, so neither `tsc` nor ESLint
 * catches it; the build is clean and the page 500s only when it is visited.
 * This walks the tree so the mistake is caught here instead.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const offenders: { file: string; line: number; text: string }[] = [];

for (const file of sourceFiles(SRC)) {
  const source = readFileSync(file, "utf8");
  if (!/^\s*["']use server["'];?/m.test(source.split("\n").slice(0, 3).join("\n"))) continue;

  source.split("\n").forEach((text, index) => {
    if (!index) return; // the directive itself
    // `export const x = ...` / `let` / `var` that is not an async function.
    // Type-only exports are erased by TypeScript and are always fine.
    if (/^export\s+(const|let|var)\s+[A-Za-z_$]/.test(text) && !/\basync\b/.test(text)) {
      offenders.push({ file: file.slice(SRC.length + 1), line: index + 1, text: text.trim() });
    }
  });
}

describe("use server module contract", () => {
  it("exports only async functions from every \"use server\" file", () => {
    expect(
      offenders.map((o) => `${o.file}:${o.line}  ${o.text}`).join("\n")
    ).toBe("");
  });

  it("finds at least one \"use server\" file, so the check cannot pass vacuously", () => {
    const count = sourceFiles(SRC).filter((file) => {
      const head = readFileSync(file, "utf8").split("\n").slice(0, 3).join("\n");
      return /^\s*["']use server["'];?/m.test(head);
    }).length;
    expect(count).toBeGreaterThan(0);
  });
});
