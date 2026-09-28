import "server-only";

import type { Metadata } from "next";
import { AddressBook } from "@/components/account/address-book";
import { requireUser } from "@/server/guards";
import { listAddresses } from "@/server/services/address";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delivery addresses",
  robots: { index: false, follow: false },
};

export default async function AccountAddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await listAddresses(user.id);

  return <AddressBook addresses={addresses} />;
}
