import { PolicyHeading, PolicyList, PolicyPage, policyMetadata } from "@/components/layout/policy-page";
import { env } from "@/lib/env";

export const metadata = policyMetadata(
  "Returns & exchanges",
  "Bikalpa Shoes return and exchange policy: 7-day returns on unworn shoes, and how refunds are paid."
);

const UPDATED = "2026-09-27";

export default function ReturnsPage() {
  return (
    <PolicyPage
      title="Returns & exchanges"
      intro="We accept returns on unworn shoes within 7 days of delivery."
      updated={UPDATED}
    >
      <section>
        <PolicyHeading>What we accept</PolicyHeading>
        <PolicyList
          items={[
            "Shoes tried on indoors, with the original box and both laces, in a saleable condition.",
            "Size exchange for the same model, subject to stock in your size.",
            "A faulty pair reported within 7 days of delivery, used or not.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>What we cannot accept</PolicyHeading>
        <PolicyList
          items={[
            "Shoes worn outdoors, on carpet, or showing sole wear.",
            "Shoes returned without their original packaging.",
            "Sale items marked as final clearance on the product page.",
            "Products damaged by water, mud, or misuse.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>How to start a return</PolicyHeading>
        <p>
          Email{" "}
          <a href={`mailto:${env.STORE_EMAIL}`} className="text-brand-600 hover:underline">
            {env.STORE_EMAIL}
          </a>{" "}
          with your order number and the reason. We will confirm whether the
          return is accepted and arrange collection from your address inside
          Kathmandu Valley, or ask you to send it to {env.STORE_ADDRESS}.
        </p>
      </section>

      <section>
        <PolicyHeading>Refunds</PolicyHeading>
        <PolicyList
          items={[
            "Approved refunds are sent the way you paid, within 5 working days of the return arriving.",
            "eSewa payments are refunded to your eSewa wallet. Cash on delivery orders are refunded by bank transfer to your account.",
            "Delivery charges are only refunded when the return is our error, such as a faulty or incorrect item.",
            "A size exchange is treated as a return plus a new order, so nothing is charged again until the replacement ships.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>Wrong or damaged item</PolicyHeading>
        <p>
          If we sent you the wrong size, colour or a damaged pair, we cover the
          return shipping and any replacement. Send a photo to{" "}
          <a href={`mailto:${env.STORE_EMAIL}`} className="text-brand-600 hover:underline">
            {env.STORE_EMAIL}
          </a>{" "}
          and we will sort it quickly.
        </p>
      </section>
    </PolicyPage>
  );
}
