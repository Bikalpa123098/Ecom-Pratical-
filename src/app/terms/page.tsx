import { PolicyHeading, PolicyList, PolicyPage, policyMetadata } from "@/components/layout/policy-page";
import { env } from "@/lib/env";
import { freeDeliveryThresholdLabel, isFreeDeliveryEnabled } from "@/lib/store-config";

export const metadata = policyMetadata(
  "Terms & conditions",
  "The terms that apply when you shop at Bikalpa Shoes, including pricing, orders, and your use of the site."
);

const UPDATED = "2026-09-27";

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms & conditions"
      intro="The agreement between you and Bikalpa Shoes when you place an order."
      updated={UPDATED}
    >
      <section>
        <PolicyHeading>About these terms</PolicyHeading>
        <p>
          By shopping on this site you agree to these terms. We may update them;
          the version that applies is the one published here when you order.
        </p>
      </section>

      <section>
        <PolicyHeading>Products and pricing</PolicyHeading>
        <PolicyList
          items={[
            "Prices are in Nepali rupees and include any applicable taxes.",
            "We try hard to keep stock levels accurate, but a product can sell out between your order and our confirmation.",
            "Product photos show the real item. Minor differences in colour between screen and real life are not grounds for a return.",
            "Shoe sizes follow the European (EU) scale. If you are between sizes, we generally recommend taking the larger size.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>Orders</PolicyHeading>
        <p>
          An order becomes binding when we send you a dispatch confirmation. We
          may decline an order where an item is out of stock, a price is listed
          in error, or we cannot deliver to the address given. If we decline, any
          amount already taken is refunded in full.
        </p>
      </section>

      <section>
        <PolicyHeading>Payment</PolicyHeading>
        <PolicyList
          items={[
            "eSewa payment. Your order is only marked paid once eSewa's response has been cryptographically verified.",
            "Cash on delivery, available nationwide. Please keep the exact amount ready where possible.",
            isFreeDeliveryEnabled
              ? `Free delivery inside Kathmandu Valley on orders over ${freeDeliveryThresholdLabel}.`
              : "Delivery is charged at the rate shown at checkout.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>Your account</PolicyHeading>
        <p>
          You are responsible for keeping your password to yourself and for
          activity under your account. Tell us straight away at{" "}
          <a href={`mailto:${env.STORE_EMAIL}`} className="text-brand-600 hover:underline">
            {env.STORE_EMAIL}
          </a>{" "}
          if you think someone else has access.
        </p>
      </section>

      <section>
        <PolicyHeading>Liability</PolicyHeading>
        <p>
          Nothing in these terms limits your rights under Nepali consumer
          protection law. Otherwise our liability for any order is limited to
          the amount you paid for it.
        </p>
      </section>

      <section>
        <PolicyHeading>Governing law</PolicyHeading>
        <p>
          These terms are governed by the laws of Nepal, and the courts of
          Kathmandu have jurisdiction.
        </p>
      </section>
    </PolicyPage>
  );
}
