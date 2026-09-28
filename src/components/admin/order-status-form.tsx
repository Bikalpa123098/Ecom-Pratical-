"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";
import { updateOrderStatusAction, type AdminState } from "@/app/actions/admin-actions";
import { Field, FormError, Select, TextArea } from "@/components/ui/form";

/**
 * Admin order status control.
 *
 * Cancelling is gated on the payment state both here (so the option is not
 * offered) and again in the action, because the client check is only a
 * convenience and cannot be trusted.
 */
export function OrderStatusForm({
  orderId,
  currentStatus,
  currentPaymentStatus,
  canCancel,
}: {
  orderId: string;
  currentStatus: string;
  currentPaymentStatus: string;
  canCancel: boolean;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    updateOrderStatusAction,
    { ok: false }
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Update status</h2>
      <p className="mt-1 text-xs text-muted">
        Currently {ORDER_STATUS_LABELS[currentStatus as never] ?? currentStatus} ·{" "}
        {currentPaymentStatus.replace(/_/g, " ").toLowerCase()}
      </p>

      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="orderId" value={orderId} />
        <FormError message={state.ok ? undefined : state.message} />

        <Field label="New status" htmlFor="status" error={state.errors?.status} required>
          <Select id="status" name="status" defaultValue={currentStatus} required>
            {ORDER_STATUSES.filter((status) => canCancel || status !== "CANCELED").map(
              (status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </option>
              )
            )}
          </Select>
        </Field>

        <Field
          label="Internal note"
          htmlFor="internalNote"
          error={state.errors?.internalNote}
          hint="Only admins see this."
        >
          <TextArea id="internalNote" name="internalNote" rows={3} maxLength={500} />
        </Field>

        <SubmitButton pending={pending} />
      </form>
    </section>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  const { pending: submitting } = useFormStatus();
  const busy = pending || submitting;

  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-10 w-fit items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {busy ? "Saving…" : "Save status"}
    </button>
  );
}
