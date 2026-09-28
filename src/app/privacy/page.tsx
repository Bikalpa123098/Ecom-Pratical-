import { PolicyHeading, PolicyList, PolicyPage, policyMetadata } from "@/components/layout/policy-page";
import { env } from "@/lib/env";

export const metadata = policyMetadata(
  "Privacy policy",
  "How Bikalpa Shoes collects, uses and protects your personal information in Nepal."
);

const UPDATED = "2026-09-27";

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      intro="What we collect, why we collect it, and the control you have over it."
      updated={UPDATED}
    >
      <section>
        <PolicyHeading>What we collect</PolicyHeading>
        <PolicyList
          items={[
            "Account details: your name, email address and, if you give it, your phone number.",
            "Order details: delivery address, ward, municipality and any delivery note you add.",
            "Payment status and eSewa transaction references. We never see or store your eSewa PIN, OTP or MPIN.",
            "Technical data: the pages you visit and the browser you use, in aggregate.",
          ]}
        />
      </section>

      <section>
        <PolicyHeading>Why we collect it</PolicyHeading>
        <p>
          To take payment, deliver your order, provide support, and meet our
          record-keeping obligations under Nepali law. We do not sell your
          information, and we do not run third-party advertising trackers.
        </p>
      </section>

      <section>
        <PolicyHeading>Payment data</PolicyHeading>
        <p>
          Payment is taken on eSewa&apos;s own checkout pages. Your card or wallet
          credentials go directly to eSewa and never reach our servers. We store
          only the transaction reference and status, which is what we need to
          confirm your order was paid.
        </p>
      </section>

      <section>
        <PolicyHeading>Cookies</PolicyHeading>
        <PolicyList
          items={[
            "A session cookie, to keep you signed in.",
            "A cart cookie, so your bag survives a page reload. For guests it holds a random token, not your details.",
            "An order cookie, so a guest can see the order they just placed.",
            "A notice cookie, so we only show the cookie explanation once.",
          ]}
        />
        <p>
          All of these are strictly necessary for the shop to work. There are no
          advertising or cross-site tracking cookies.
        </p>
      </section>

      <section>
        <PolicyHeading>Your rights</PolicyHeading>
        <p>
          You can ask for a copy of the data we hold about you, ask us to correct
          it, or ask us to delete your account. Write to{" "}
          <a href={`mailto:${env.STORE_EMAIL}`} className="text-brand-600 hover:underline">
            {env.STORE_EMAIL}
          </a>
          . We keep order records for as long as Nepali tax law requires, so
          those cannot be deleted on request, but we will tell you exactly what
          we still hold and why.
        </p>
      </section>

      <section>
        <PolicyHeading>Security</PolicyHeading>
        <p>
          Passwords are hashed, session cookies are httpOnly, and every payment
          callback is verified against eSewa&apos;s signature before an order changes.
        </p>
      </section>
    </PolicyPage>
  );
}
