import { toRupees } from "@/lib/constants";
import { env } from "@/lib/env";

/**
 * Public store configuration.
 *
 * These values are safe to send to the browser and exist so customer-facing
 * copy (the free-delivery banner, the footer, the cart) can never drift away
 * from what checkout actually charges. `calculateTotals` reads the same
 * `env` values, so the promise on the banner and the amount on the order always
 * come from one source.
 */

export const freeDeliveryThresholdRupees = toRupees(env.FREE_DELIVERY_THRESHOLD_PAISA);

/** Same threshold in paisa, for arithmetic against a paisa subtotal. */
export const freeDeliveryThresholdPaisa = env.FREE_DELIVERY_THRESHOLD_PAISA;

export const deliveryChargeInsideValleyRupees = env.DELIVERY_CHARGE_INSIDE_VALLEY_RUPEES;
export const deliveryChargeOutsideValleyRupees = env.DELIVERY_CHARGE_OUTSIDE_VALLEY_RUPEES;

/** e.g. "Rs. 5,000". Used in the announcement bar and the cart summary. */
export const freeDeliveryThresholdLabel = `Rs. ${freeDeliveryThresholdRupees.toLocaleString("en-IN")}`;

export const isFreeDeliveryEnabled = freeDeliveryThresholdRupees > 0;

export const paymentMethods = ["eSewa", "Cash on delivery"] as const;
