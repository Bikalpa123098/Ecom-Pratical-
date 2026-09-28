import type { Metadata } from "next";
import Link from "next/link";

/**
 * Shared chrome for the policy pages.
 *
 * The content itself is deliberately plain prose in `content.tsx` files rather
 * than MDX: there is no user-authored content pipeline to secure, and the text
 * ships in the JS bundle with no extra runtime.
 */
export function PolicyPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-ink">{title}</span>
      </nav>

      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        {intro} · Last updated {updated}
      </p>

      <div className="prose-bikalpa mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </main>
  );
}

export function PolicyHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg font-semibold text-ink">{children}</h2>
  );
}

export function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export const policyMetadata = (title: string, description: string): Metadata => ({
  title,
  description,
});
