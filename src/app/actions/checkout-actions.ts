"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/server/guards";
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas";
import { getCartView, clearCart } from "@/server/services/cart";
import { createPendingOrder, OrderError } from "@/server/services/order";
import { PaymentError, prepareEsewaPayment } from "@/server/services/payment";
import { fieldErrorsFrom } from "@/server/validation";
import { addressSchema, type AddressInput } from "@/lib/schemas";
import { GUEST_ORDER_COOKIE } from "@/lib/constants";

/**
 * Checkout.
 *
 * Flow:
 *   1. Validate the submitted details.
 *   2. Re-read the cart and recompute every amount from the database.
 *   3. Create (or reuse) a PENDING_PAYMENT order, reserving stock.
 *   4. Build the signed eSewa form.
 *   5. Redirect to the confirmation page, which renders the auto-submitting
 *      signed form that posts to eSewa.
 *
 * No price, total or product identifier is accepted from the browser: the
 * client's only influence on money is which products and sizes it asked for.
 */

export interface CheckoutState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export async function submitCheckout(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = checkoutSchema.safeParse({
    ...raw,
    saveAddress: raw.saveAddress === "on" || raw.saveAddress === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors: fieldErrorsFrom(parsed.error),
    };
  }

  const input: CheckoutInput = parsed.data;
  const user = await getCurrentUser();

  const view = await getCartView(user?.id ?? null);
  if (view.lines.length === 0) {
    return { ok: false, message: "Your bag is empty." };
  }
  if (view.hasUnavailable) {
    return {
      ok: false,
      message: "Some items in your bag are no longer available. Please review your bag.",
    };
  }

  try {
    const { orderId, guestAccessToken } = await createPendingOrder({
      userId: user?.id ?? null,
      lines: view.lines,
      details: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        province: input.province,
        district: input.district,
        municipality: input.municipality,
        wardNumber: input.wardNumber ?? "",
        tole: input.tole ?? "",
        addressLine: input.addressLine,
        postalCode: input.postalCode ?? "",
        deliveryNotes: input.deliveryNotes ?? "",
      },
      idempotencyKey: input.idempotencyKey,
    });

    // Guests are only authorised to view this order with this secret, so it is
    // kept in an httpOnly cookie that the confirmation page reads back.
    if (guestAccessToken) {
      const jar = await cookies();
      jar.set(GUEST_ORDER_COOKIE, guestAccessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    if (user && input.saveAddress) {
      await saveAddressForUser(user.id, input);
    }

    // The order's stock is now reserved; the bag has served its purpose.
    await clearCart(user?.id ?? null);

    // Build the signed request. If eSewa is unconfigured the order stays
    // PENDING_PAYMENT and the confirmation page explains the problem instead
    // of silently pretending the payment started.
    await prepareEsewaPayment(orderId);

    revalidatePath("/account/orders");
    redirect(`/checkout/${orderId}`);
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, message: err.message };
    if (err instanceof PaymentError) {
      return {
        ok: false,
        message: `${err.message} Your order is saved — please try paying again shortly.`,
      };
    }
    // next/navigation redirect throws a control-flow error; rethrow it.
    if (isRedirectError(err)) throw err;
    console.error("[checkout] submit failed", err);
    return {
      ok: false,
      message: "We could not start your payment. Please try again.",
    };
  }
}

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function saveAddressForUser(userId: string, input: CheckoutInput) {
  const candidate: AddressInput = {
    label: "Home",
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    province: input.province,
    district: input.district,
    municipality: input.municipality,
    wardNumber: input.wardNumber ?? "",
    tole: input.tole ?? "",
    addressLine: input.addressLine,
    postalCode: input.postalCode ?? "",
    deliveryNotes: input.deliveryNotes ?? "",
    isDefault: true,
  };

  const parsed = addressSchema.safeParse(candidate);
  if (!parsed.success) return;

  // Replace any existing default so the account has exactly one.
  await prisma.address.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });
  await prisma.address.create({ data: { ...parsed.data, userId } });
}

/** Reads the guest order capability cookie for the confirmation/result pages. */
export async function readGuestOrderToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GUEST_ORDER_COOKIE)?.value ?? null;
}
