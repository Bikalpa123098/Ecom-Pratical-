import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach Bikalpa Shoes by phone, WhatsApp or email, or visit our shop in Kathmandu.",
};

const whatsappNumber = env.STORE_WHATSAPP.replace(/[^\d]/g, "");

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink">Contact us</h1>
      <p className="mt-2 text-sm text-muted">
        We reply to every message within one working day.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        <li className="rounded-2xl border border-line bg-surface p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Phone className="size-4 text-brand-600" aria-hidden />
            Phone
          </p>
          <a
            href={`tel:${env.STORE_PHONE.replace(/\s/g, "")}`}
            className="mt-2 block text-sm text-ink-soft hover:underline"
          >
            {env.STORE_PHONE}
          </a>
          <p className="mt-1 text-xs text-muted">{env.STORE_HOURS}</p>
        </li>

        <li className="rounded-2xl border border-line bg-surface p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <MessageCircle className="size-4 text-brand-600" aria-hidden />
            WhatsApp
          </p>
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 block text-sm text-ink-soft hover:underline"
          >
            Message us on WhatsApp
          </a>
          <p className="mt-1 text-xs text-muted">
            Fastest for order updates and size advice.
          </p>
        </li>

        <li className="rounded-2xl border border-line bg-surface p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Mail className="size-4 text-brand-600" aria-hidden />
            Email
          </p>
          <a
            href={`mailto:${env.STORE_EMAIL}`}
            className="mt-2 block text-sm text-ink-soft hover:underline"
          >
            {env.STORE_EMAIL}
          </a>
          <p className="mt-1 text-xs text-muted">
            Include your order number for returns.
          </p>
        </li>

        <li className="rounded-2xl border border-line bg-surface p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="size-4 text-brand-600" aria-hidden />
            Shop
          </p>
          <p className="mt-2 text-sm text-ink-soft">{env.STORE_ADDRESS}</p>
          <p className="mt-1 text-xs text-muted">{env.STORE_HOURS}</p>
        </li>
      </ul>
    </main>
  );
}
