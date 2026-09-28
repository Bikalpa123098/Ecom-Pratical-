import type { Metadata } from "next";
import Link from "next/link";
import { PolicyHeading, PolicyList } from "@/components/layout/policy-page";
import {
  deliveryChargeInsideValleyRupees,
  deliveryChargeOutsideValleyRupees,
  freeDeliveryThresholdLabel,
  isFreeDeliveryEnabled,
} from "@/lib/store-config";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Answers about sizing, delivery charges, eSewa payment, cash on delivery, returns and stock at Bikalpa Shoes.",
};

/**
 * Answers to the questions the shop is actually asked, rendered from the same
 * configuration checkout charges against so a quoted rate can never disagree
 * with the amount on the order.
 */
const FAQS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "How do I choose the right size?",
    answer: (
      <p>
        Our sizes follow the European (EU) scale and are listed on every product
        page. Measure your foot from heel to longest toe in centimetres and match
        it to the size chart on the product page. If you are between two sizes,
        take the larger one. Still unsure? Message us on WhatsApp with your
        measurement and we will advise.
      </p>
    ),
  },
  {
    question: "What does delivery cost?",
    answer: (
      <>
        <p>
          Delivery inside Kathmandu Valley (Kathmandu, Lalitpur, Bhaktapur) is
          Rs. {deliveryChargeInsideValleyRupees}.
          {isFreeDeliveryEnabled
            ? ` It is free on orders over ${freeDeliveryThresholdLabel}.`
            : null}{" "}
          Outside the Valley it is Rs. {deliveryChargeOutsideValleyRupees}, and
          free delivery does not apply.
        </p>
        <p>
          The exact charge for your district is shown in the order summary
          before you pay, so there is nothing to work out yourself.
        </p>
      </>
    ),
  },
  {
    question: "How long does delivery take?",
    answer: (
      <p>
        Inside the Valley we dispatch within 1 working day and delivery usually
        lands the next day. Outside the Valley we dispatch within 2 working days
        and delivery takes 2 to 5 days depending on the district. See{" "}
        <Link href="/shipping" className="text-brand-600 hover:underline">
          shipping &amp; delivery
        </Link>{" "}
        for detail.
      </p>
    ),
  },
  {
    question: "Can I pay with eSewa?",
    answer: (
      <p>
        Yes. At the final step you are taken to eSewa&apos;s own secure checkout to
        pay, then returned to us. Your order is only marked as paid once
        eSewa&apos;s confirmation has been verified, so a dropped connection never
        leaves you unsure whether you were charged.
      </p>
    ),
  },
  {
    question: "Can I pay cash on delivery?",
    answer: (
      <p>
        Yes, anywhere in Nepal. Please keep the exact amount ready if you can.
        Cash on delivery orders still reserve their stock when you place them.
      </p>
    ),
  },
  {
    question: "I paid but my order still says awaiting payment. What now?",
    answer: (
      <p>
        We confirm every payment against eSewa&apos;s status API, so a slow response
        is not an error. Wait a few minutes and refresh the order page. If it
        still has not updated, message us with your order number and the amount
        you paid, and we will chase it. If we cannot confirm the payment we
        refund it automatically, so you are never charged for an order we
        cancelled.
      </p>
    ),
  },
  {
    question: "What is your returns policy?",
    answer: (
      <p>
        Unworn shoes in their original packaging can be returned within 7 days
        of delivery, and faulty pairs are always covered. See{" "}
        <Link href="/returns" className="text-brand-600 hover:underline">
          returns &amp; exchanges
        </Link>
        .
      </p>
    ),
  },
  {
    question: "Do you sell authentic branded shoes?",
    answer: (
      <p>
        Every product page lists the brand and the SKU we use internally. If
        anything arrives that is not what you ordered, we cover the return
        shipping and replace it.
      </p>
    ),
  },
  {
    question: "A product says out of stock. When is it back?",
    answer: (
      <p>
        Stock shown on a product page is live. Use the wishlist (heart) to save
        it, and we will keep it in your account so you can check quickly when it
        returns.
      </p>
    ),
  },
  {
    question: "Can I change or cancel my order?",
    answer: (
      <p>
        Yes, as long as it has not shipped. Message us with your order number
        as early as possible. Once an order is with the courier we can only help
        through the return process.
      </p>
    ),
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-ink">
        Frequently asked questions
      </h1>
      <p className="mt-2 text-sm text-muted">
        Everything customers ask us most. Still stuck?{" "}
        <Link href="/contact" className="text-brand-600 hover:underline">
          Contact us
        </Link>
        .
      </p>

      <div className="mt-8 divide-y divide-line border-y border-line">
        {FAQS.map((faq) => (
          <details key={faq.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
              {faq.question}
              <span
                aria-hidden
                className="text-xl leading-none text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      <section className="mt-10">
        <PolicyHeading>Delivery at a glance</PolicyHeading>
        <PolicyList
          items={[
            `Kathmandu, Lalitpur, Bhaktapur: Rs. ${deliveryChargeInsideValleyRupees}${
              isFreeDeliveryEnabled ? `, free over ${freeDeliveryThresholdLabel}` : ""
            }.`,
            `Every other district: Rs. ${deliveryChargeOutsideValleyRupees}.`,
            "Cash on delivery available nationwide.",
            "eSewa payment available for every order.",
          ]}
        />
      </section>
    </main>
  );
}
