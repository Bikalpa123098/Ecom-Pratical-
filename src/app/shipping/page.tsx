import { PolicyHeading, PolicyList, PolicyPage, policyMetadata } from "@/components/layout/policy-page";
import { env } from "@/lib/env";

export const metadata = policyMetadata(
  "Shipping & delivery",
  "How Bikalpa Shoes delivers across Nepal, what delivery costs, and how long dispatch takes."
);

const UPDATED = "2026-09-27";

export default function ShippingPage() {
  return (
    <PolicyPage
      title="Shipping & delivery"
      intro="We deliver across all seven provinces of Nepal."
      updated={UPDATED}
    >
      <section>
        <PolicyHeading>Delivery inside Kathmandu Valley</PolicyHeading>
        <p>
          Orders to Kathmandu, Lalitpur and Bhaktapur are charged a flat delivery
          fee, and delivery is free on orders above the threshold shown in the
          site header. The threshold is read from the same configuration checkout
          charges against, so the figure you see quoted is the figure you pay.
        </p>
      </section>

      <section>
        <PolicyHeading>Delivery outside the Valley</PolicyHeading>
        <p>
          All other districts carry a higher flat rate, and free delivery does
          not apply. The exact charge is calculated from your district at
          checkout and shown in the order summary before you pay.
        </p>
      </section>

      <section>
        <PolicyHeading>How long it takes</PolicyHeading>
        <PolicyList
          items={[
            "Kathmandu Valley: dispatched within 1 working day, typically delivered the next day.",
            "Outside the Valley: dispatched within 2 working days.",
            "Remote hill districts may take 3 to 5 working days in transit.",
            "You receive the courier's contact details with your dispatch notification.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>Tracking</PolicyHeading>
        <p>
          Once your order leaves us, the courier contacts you by phone. We email
          the tracking detail to the address on the order as well.
        </p>
      </section>

      <section>
        <PolicyHeading>Failed deliveries</PolicyHeading>
        <p>
          If the courier cannot reach you, the parcel returns to us and the
          reserved stock is released. Contact us on{" "}
          <a href={`mailto:${env.STORE_EMAIL}`} className="text-brand-600 hover:underline">
            {env.STORE_EMAIL}
          </a>{" "}
          and we will resend it.
        </p>
      </section>
    </PolicyPage>
  );
}
