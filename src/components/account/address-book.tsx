"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DISTRICT_SUGGESTIONS, MUNICIPALITY_SUGGESTIONS, NEPAL_PROVINCES } from "@/lib/geo";
import {
  deleteAddressAction,
  saveAddressAction,
  type AddressState,
} from "@/app/actions/account-actions";
import { Checkbox, Field, FormError, Select, TextArea, TextInput } from "@/components/ui/form";
import type { AddressRecord } from "@/server/services/address";

const NEW_ADDRESS = "new";

/**
 * Saved address book.
 *
 * The form posts to a server action that re-reads the session, so the list here
 * is only ever a mirror of what the database holds. The delete button is a plain
 * form submit (server action + redirect) rather than fetch, so a failed or
 * double-submitted delete cannot leave the UI claiming a deletion that never
 * happened.
 */
/**
 * A stable identity, hoisted out of the component.
 *
 * `useActionState` hands this object back on every render until an action runs.
 * An inline `{ ok: false }` would be a *new* object each render, so the
 * render-phase `state !== lastState` check below could never settle and React
 * would abort with "Too many re-renders".
 */
const INITIAL_STATE: AddressState = { ok: false };

export function AddressBook({ addresses }: { addresses: AddressRecord[] }) {
  const [state, action, pending] = useActionState<AddressState, FormData>(
    saveAddressAction,
    INITIAL_STATE
  );

  // `null` means the editor is closed. `formKey` changes only when the customer
  // switches address, which is what remounts the uncontrolled inputs; it is
  // deliberately not tied to the action state, so a rejected save keeps
  // everything the customer typed.
  const [editing, setEditing] = useState<AddressRecord | null>(null);
  const [formKey, setFormKey] = useState(NEW_ADDRESS);
  const [lastState, setLastState] = useState<AddressState | null>(INITIAL_STATE);

  const openEditor = (address: AddressRecord | null) => {
    setEditing(address ?? ({} as AddressRecord));
    setFormKey(address?.id ?? NEW_ADDRESS);
  };
  const closeEditor = () => setEditing(null);

  // Adjust during render rather than in an effect: a successful save (or a
  // cancel) closes the editor without a second render pass, and the freshly
  // revalidated list is already in `addresses` by then.
  if (state !== lastState) {
    setLastState(state);
    if (state.ok) setEditing(null);
  }

  // A toast is a side effect on an external system, which is what an effect is
  // for.
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Delivery addresses</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => openEditor(null)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden />
            Add address
          </button>
        ) : null}
      </div>

      {editing ? (
        <form
          action={action}
          key={formKey}
          className="mt-4 grid gap-4 rounded-2xl border border-line bg-surface p-5"
        >
          <h3 className="text-sm font-semibold text-ink">
            {editing.id ? "Edit address" : "New address"}
          </h3>
          {editing.id ? <input type="hidden" name="id" value={editing.id} /> : null}
          <FormError message={state.ok ? undefined : state.message} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" htmlFor="label" error={state.errors?.label}>
              <TextInput
                name="label"
                defaultValue={editing.label ?? "Home"}
                maxLength={40}
                required
              />
            </Field>
            <Field label="Full name" htmlFor="fullName" error={state.errors?.fullName} required>
              <TextInput name="fullName" defaultValue={editing.fullName ?? ""} required />
            </Field>
            <Field label="Phone" htmlFor="phone" error={state.errors?.phone} required>
              <TextInput name="phone" inputMode="tel" defaultValue={editing.phone ?? ""} required />
            </Field>
            <Field label="Email" htmlFor="email" error={state.errors?.email}>
              <TextInput name="email" type="email" defaultValue={editing.email ?? ""} />
            </Field>
            <Field label="Province" htmlFor="province" error={state.errors?.province} required>
              <Select name="province" defaultValue={editing.province ?? ""} required>
                <option value="" disabled>
                  Choose a province
                </option>
                {NEPAL_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="District" htmlFor="district" error={state.errors?.district} required>
              <TextInput
                name="district"
                list="account-districts"
                defaultValue={editing.district ?? ""}
                required
              />
            </Field>
            <Field
              label="Municipality / rural municipality"
              htmlFor="municipality"
              error={state.errors?.municipality}
              required
            >
              <TextInput
                name="municipality"
                list="account-municipalities"
                defaultValue={editing.municipality ?? ""}
                required
              />
            </Field>
            <Field label="Ward number" htmlFor="wardNumber" error={state.errors?.wardNumber}>
              <TextInput name="wardNumber" inputMode="numeric" defaultValue={editing.wardNumber ?? ""} />
            </Field>
            <Field label="Tole / tole name" htmlFor="tole" error={state.errors?.tole}>
              <TextInput name="tole" defaultValue={editing.tole ?? ""} />
            </Field>
            <Field label="Postal code" htmlFor="postalCode" error={state.errors?.postalCode}>
              <TextInput name="postalCode" inputMode="numeric" defaultValue={editing.postalCode ?? ""} />
            </Field>
          </div>

          <Field label="Address line" htmlFor="addressLine" error={state.errors?.addressLine} required>
            <TextArea name="addressLine" rows={2} defaultValue={editing.addressLine ?? ""} required />
          </Field>
          <Field label="Delivery notes" htmlFor="deliveryNotes" error={state.errors?.deliveryNotes}>
            <TextArea name="deliveryNotes" rows={2} defaultValue={editing.deliveryNotes ?? ""} />
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <Checkbox
              id="isDefault"
              name="isDefault"
              label="Use as my default delivery address"
              defaultChecked={editing.isDefault ?? false}
            />
          </div>

          <div className="flex gap-3">
            <SaveButton disabled={pending} editing={Boolean(editing.id)} />
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface-alt"
            >
              Cancel
            </button>
          </div>

          <datalist id="account-districts">
            {DISTRICT_SUGGESTIONS.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
          <datalist id="account-municipalities">
            {MUNICIPALITY_SUGGESTIONS.map((municipality) => (
              <option key={municipality} value={municipality} />
            ))}
          </datalist>
        </form>
      ) : null}

      {addresses.length === 0 && !editing ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          No saved addresses yet. Add one to check out faster next time.
        </div>
      ) : null}

      {addresses.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <MapPin className="size-4 text-brand-600" aria-hidden />
                  {address.label}
                </p>
                {address.isDefault ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    Default
                  </span>
                ) : null}
              </div>

              <address className="mt-2 flex-1 text-sm not-italic text-muted">
                {address.fullName}
                <br />
                {address.addressLine}
                <br />
                {address.municipality}
                {address.wardNumber ? `, Ward ${address.wardNumber}` : ""}
                {address.tole ? `, ${address.tole}` : ""}
                <br />
                {address.district}, {address.province}
                {address.postalCode ? ` ${address.postalCode}` : ""}
                <br />
                {address.phone}
              </address>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditor(address)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-surface-alt"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </button>
                <form action={deleteAddressAction} className="inline">
                  <input type="hidden" name="id" value={address.id} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SaveButton({ disabled, editing }: { disabled: boolean; editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : editing ? "Save changes" : "Save address"}
    </button>
  );
}
