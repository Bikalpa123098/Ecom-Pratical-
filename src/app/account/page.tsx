import { redirect } from "next/navigation";

/** `/account` has no content of its own; send visitors somewhere useful. */
export default function AccountIndexPage() {
  redirect("/account/orders");
}
