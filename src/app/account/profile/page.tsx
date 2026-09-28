import "server-only";

import type { Metadata } from "next";
import { ProfileForms } from "@/components/account/profile-forms";
import { requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function AccountProfilePage() {
  const user = await requireUser("/account/profile");

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">Profile</h2>
      <div className="mt-4">
        <ProfileForms name={user.name} phone={user.phone ?? null} />
      </div>
    </section>
  );
}
