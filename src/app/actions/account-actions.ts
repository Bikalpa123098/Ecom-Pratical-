"use server";

/**
 * Account mutations.
 *
 * Each action re-reads the session server-side and scopes its work to that
 * user id. The submitted form may change a field value, never an owner.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addressSchema, cuidSchema } from "@/lib/schemas";
import { assertUser } from "@/server/guards";
import { AddressError, deleteAddress, saveAddress } from "@/server/services/address";
import { fieldErrorsFrom } from "@/server/validation";
import {
  changePasswordAction,
  updateProfileAction,
  type AuthState,
} from "./auth-actions";

export { changePasswordAction, updateProfileAction };
export type { AuthState };

export interface AddressState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Lets the form reopen the editor for the row that failed. */
  editingId?: string;
}

export async function saveAddressAction(
  _prev: AddressState,
  formData: FormData
): Promise<AddressState> {
  const user = await assertUser();

  const id = formData.get("id")?.toString() ?? "";
  const parsedId = id ? cuidSchema.safeParse(id) : null;
  if (parsedId && !parsedId.success) {
    return { ok: false, message: "That address could not be found." };
  }

  try {
    // Parsed here as well as inside the service so the customer gets
    // per-field messages rather than a generic failure.
    const parsed = addressSchema.safeParse({
      label: formData.get("label") ?? "Home",
      fullName: formData.get("fullName") ?? "",
      phone: formData.get("phone") ?? "",
      email: formData.get("email") ?? "",
      province: formData.get("province") ?? "",
      district: formData.get("district") ?? "",
      municipality: formData.get("municipality") ?? "",
      wardNumber: formData.get("wardNumber") ?? "",
      tole: formData.get("tole") ?? "",
      addressLine: formData.get("addressLine") ?? "",
      postalCode: formData.get("postalCode") ?? "",
      deliveryNotes: formData.get("deliveryNotes") ?? "",
      isDefault: formData.get("isDefault") === "on" || formData.get("isDefault") === "true",
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: "Please correct the highlighted fields.",
        errors: fieldErrorsFrom(parsed.error),
        editingId: id || undefined,
      };
    }

    await saveAddress(user.id, parsed.data, parsedId ? { id: parsedId.data } : {});
  } catch (err) {
    if (err instanceof AddressError) {
      return { ok: false, message: err.message, editingId: id || undefined };
    }
    console.error("[account] save address failed", err);
    return { ok: false, message: "We could not save that address.", editingId: id || undefined };
  }

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await assertUser();
  const id = cuidSchema.safeParse(formData.get("id")?.toString() ?? "");
  if (!id.success) redirect("/account/addresses");

  try {
    await deleteAddress(user.id, id.data);
  } catch (err) {
    if (!(err instanceof AddressError)) {
      console.error("[account] delete address failed", err);
    }
  }

  revalidatePath("/account/addresses");
  redirect("/account/addresses");
}
