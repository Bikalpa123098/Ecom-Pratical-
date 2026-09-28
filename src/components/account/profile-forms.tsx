"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  changePasswordAction,
  updateProfileAction,
  type AuthState,
} from "@/app/actions/auth-actions";
import { Field, FormError, TextInput } from "@/components/ui/form";

/**
 * Profile and password.
 *
 * `name` and `phone` are the only customer-writable fields. Role and account
 * status are `input: false` on the auth user schema, so they cannot be changed
 * by posting extra form fields.
 */
export function ProfileForms({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  return (
    <div className="grid gap-8">
      <ProfileForm name={name} phone={phone ?? ""} />
      <PasswordForm />
    </div>
  );
}

function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updateProfileAction,
    { ok: false }
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Your details</h2>
      <p className="mt-1 text-xs text-muted">
        Your email is the sign-in identity and cannot be changed here.
      </p>

      <form action={action} className="mt-4 grid gap-4 sm:max-w-md">
        <FormError message={state.ok ? undefined : state.message} />
        <Field label="Full name" htmlFor="name" error={state.errors?.name} required>
          <TextInput name="name" defaultValue={name} required maxLength={80} />
        </Field>
        <Field
          label="Phone"
          htmlFor="phone"
          error={state.errors?.phone}
          hint="Used by the courier for delivery only."
        >
          <TextInput name="phone" inputMode="tel" defaultValue={phone} />
        </Field>
        <SubmitButton pending={pending} label="Save details" />
      </form>
    </section>
  );
}

function PasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    changePasswordAction,
    { ok: false }
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Change password</h2>
      <p className="mt-1 text-xs text-muted">
        You will stay signed in on this device.
      </p>

      <form action={action} className="mt-4 grid gap-4 sm:max-w-md">
        <FormError message={state.ok ? undefined : state.message} />
        <Field
          label="Current password"
          htmlFor="currentPassword"
          error={state.errors?.currentPassword}
          required
        >
          <TextInput
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          error={state.errors?.newPassword}
          required
        >
          <TextInput
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={state.errors?.confirmPassword}
          required
        >
          <TextInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <SubmitButton pending={pending} label="Update password" />
      </form>
    </section>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  const { pending: submitting } = useFormStatus();
  const busy = pending || submitting;

  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-11 w-fit items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {busy ? "Saving…" : label}
    </button>
  );
}
