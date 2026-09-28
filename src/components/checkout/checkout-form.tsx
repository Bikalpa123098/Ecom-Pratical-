"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Select, TextArea, TextInput } from "@/components/ui/form";
import { submitCheckout, type CheckoutState } from "@/app/actions/checkout-actions";
import { NEPAL_PROVINCES, DISTRICT_SUGGESTIONS } from "@/lib/geo";
import { formatNPR } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { CartView } from "@/server/services/cart";

/**
 * Checkout form.
 *
 * The only thing generated in the browser is the idempotency key: if the customer
 * double-clicks "Pay with eSewa", both submissions carry the same key and the
 * server returns the same order instead of reserving stock twice. It is minted
 * once per mount and survives every re-render, including failed attempts.
 *
 * Delivery charges shown here are a preview. The order is created from a fresh
 * `calculateTotals` run against live prices and the submitted district, and the
 * signed eSewa form is built from those server numbers — never from this form.
 */

const initial: CheckoutState = { ok: false };

export function CheckoutForm({
  view,
  defaults,
  signedIn,
}: {
  view: CartView;
  defaults: { fullName: string; email: string; phone: string };
  signedIn: boolean;
}) {
  const [state, action, pending] = useActionState(submitCheckout, initial);
  const router = useRouter();
  const [district, setDistrict] = useState("");

  // Stable for the lifetime of this form; see the note above.
  const idempotencyKey = useMemo(
    () => `ck_${crypto.randomUUID().replace(/-/g, "")}`,
    []
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const lines = view.lines.filter((l) => !l.removed);

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="paymentMethod" value="ESEWA" />

      <div className="space-y-6">
        <FormError message={state.message} />

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Delivery details</h2>
          <p className="mt-1 text-sm text-ink-soft">
            We use this only to deliver your order and send delivery updates.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" error={state.errors?.fullName} required>
              <TextInput
                id="fullName"
                name="fullName"
                autoComplete="name"
                defaultValue={defaults.fullName}
                placeholder="Asha Gurung"
                required
                invalid={Boolean(state.errors?.fullName)}
              />
            </Field>

            <Field label="Mobile number" htmlFor="phone" error={state.errors?.phone} required>
              <TextInput
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                defaultValue={defaults.phone}
                placeholder="98XXXXXXXX"
                required
                invalid={Boolean(state.errors?.phone)}
              />
            </Field>

            <Field
              label="Email address"
              htmlFor="email"
              error={state.errors?.email}
              hint="Your receipt is sent here."
              required
              className="sm:col-span-2"
            >
              <TextInput
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={defaults.email}
                placeholder="you@example.com"
                required
                invalid={Boolean(state.errors?.email)}
              />
            </Field>

            <Field label="Province" htmlFor="province" error={state.errors?.province} required>
              <Select
                id="province"
                name="province"
                defaultValue=""
                required
                invalid={Boolean(state.errors?.province)}
              >
                <option value="">Select a province</option>
                {NEPAL_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="District"
              htmlFor="district"
              error={state.errors?.district}
              hint="Delivery charge depends on this."
              required
            >
              <input
                id="district"
                name="district"
                list="district-options"
                defaultValue={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Kathmandu"
                required
                aria-invalid={Boolean(state.errors?.district) || undefined}
                className={cn(
                  "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink",
                  "placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25",
                  state.errors?.district && "border-danger-500"
                )}
              />
              <datalist id="district-options">
                {DISTRICT_SUGGESTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>

            <Field
              label="Municipality / city"
              htmlFor="municipality"
              error={state.errors?.municipality}
              required
            >
              <TextInput
                id="municipality"
                name="municipality"
                autoComplete="address-level2"
                placeholder="Kathmandu Metropolitan City"
                required
                invalid={Boolean(state.errors?.municipality)}
              />
            </Field>

            <Field label="Ward number" htmlFor="wardNumber" error={state.errors?.wardNumber}>
              <TextInput
                id="wardNumber"
                name="wardNumber"
                inputMode="numeric"
                placeholder="16"
              />
            </Field>

            <Field
              label="Address line"
              htmlFor="addressLine"
              error={state.errors?.addressLine}
              required
              className="sm:col-span-2"
            >
              <TextInput
                id="addressLine"
                name="addressLine"
                autoComplete="street-address"
                placeholder="House 24, New Road, near the post office"
                required
                invalid={Boolean(state.errors?.addressLine)}
              />
            </Field>

            <Field label="Tole / locality" htmlFor="tole" error={state.errors?.tole}>
              <TextInput id="tole" name="tole" placeholder="Ramshah Path" />
            </Field>

            <Field label="Postal code" htmlFor="postalCode" error={state.errors?.postalCode}>
              <TextInput id="postalCode" name="postalCode" inputMode="numeric" placeholder="44600" />
            </Field>

            <Field
              label="Delivery notes"
              htmlFor="deliveryNotes"
              error={state.errors?.deliveryNotes}
              hint="Optional — e.g. landmark, best time to call."
              className="sm:col-span-2"
            >
              <TextArea
                id="deliveryNotes"
                name="deliveryNotes"
                placeholder="Please call before arriving; I usually leave after 4pm."
              />
            </Field>
          </div>

          {signedIn ? (
            <Checkbox
              id="saveAddress"
              name="saveAddress"
              className="mt-4"
              label="Save this address for next time"
            />
          ) : null}
        </section>

        <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Payment</h2>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-surface p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#60c241] text-white">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">eSewa</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                You will be taken to eSewa to approve the payment, then returned here
                automatically. We only confirm your order after eSewa confirms the payment.
              </p>
            </div>
            <span
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-brand-700 bg-brand-700 text-center text-[10px] leading-3 text-white"
            >
              ✓
            </span>
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            <span>
              Do not enter your eSewa PIN, MPIN or password on this site. Only eSewa&apos;s own
              page asks for those, and we never see them.
            </span>
          </p>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold text-ink">Review your order</h2>

          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lines.map((line) => (
              <li key={line.itemId} className="flex justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 text-ink-soft">
                  <span className="text-ink">{line.name}</span>
                  <span className="block text-xs text-muted">
                    Size {line.size} · Qty {line.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-ink">
                  {formatNPR(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="font-medium text-ink">{formatNPR(view.subtotal)}</dd>
            </div>
            {view.savings > 0 ? (
              <div className="flex items-center justify-between text-success-700">
                <dt>Discount</dt>
                <dd className="font-medium">−{formatNPR(view.savings)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className="text-ink-faint">
                {district ? "Calculated from your district" : "Enter your district"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm font-medium text-ink">Total</span>
            <span className="font-display text-xl font-semibold text-ink">
              {formatNPR(view.subtotal)}
            </span>
          </div>
          <p className="mt-1 text-right text-xs text-ink-faint">
            delivery and any tax added once your order is created
          </p>

          <Button
            type="submit"
            size="lg"
            full
            className="mt-5"
            disabled={pending || view.hasUnavailable || lines.length === 0}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="h-4 w-4" aria-hidden />
            )}
            {pending ? "Creating your order…" : "Pay with eSewa"}
          </Button>

          {view.hasUnavailable ? (
            <p className="mt-2 text-xs text-danger-600">
              Please resolve the unavailable items in your bag first.
            </p>
          ) : null}

          <p className="mt-3 text-center text-xs text-ink-faint">
            By placing this order you agree to our{" "}
            <a href="/terms" className="underline underline-offset-2">
              terms
            </a>{" "}
            and{" "}
            <a href="/returns" className="underline underline-offset-2">
              returns policy
            </a>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}
