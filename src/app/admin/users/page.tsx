import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/guards";
import { listAdminUsers } from "@/server/services/admin";
import { setUserActiveAction, setUserRoleAction } from "@/app/actions/admin-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Customers",
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; error?: string }>;
}) {
  const admin = await requireAdmin("/admin/users");
  const params = await searchParams;

  const requested = Number.parseInt(params.page ?? "1", 10);
  const result = await listAdminUsers({
    page: Number.isFinite(requested) ? requested : 1,
    q: params.q?.trim() || undefined,
    perPage: PER_PAGE,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Customers</h1>

      {params.error === "self-demote" ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          You cannot remove your own administrator role. Ask another admin to do it.
        </p>
      ) : null}
      {params.error === "self-deactivate" ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          You cannot deactivate your own account.
        </p>
      ) : null}

      <form action="/admin/users" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="block text-xs text-muted">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Name or email"
            className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Search
        </button>
      </form>

      {result.users.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          No customers match.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-surface-alt text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Orders</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.users.map((user) => {
                const isSelf = user.id === admin.id;
                return (
                  <tr key={user.id} className="bg-surface">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">
                        {user.name}
                        {isSelf ? (
                          <span className="ml-1.5 text-xs text-muted">(you)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">{user.email}</p>
                      {user.phone ? (
                        <p className="text-xs text-muted">{user.phone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Intl.DateTimeFormat("en-NP", { dateStyle: "medium" }).format(
                        user.createdAt
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.orderCount > 0 ? (
                        <Link
                          href={`/admin/orders?q=${encodeURIComponent(user.email)}`}
                          className="text-brand-600 hover:underline"
                        >
                          {user.orderCount}
                        </Link>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={setUserRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="sr-only" htmlFor={`role-${user.id}`}>
                          Role for {user.email}
                        </label>
                        <select
                          id={`role-${user.id}`}
                          name="role"
                          defaultValue={user.role}
                          disabled={isSelf}
                          className="h-8 rounded-lg border border-line bg-surface px-2 text-xs disabled:opacity-50"
                        >
                          <option value="CUSTOMER">Customer</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          type="submit"
                          disabled={isSelf}
                          className="h-8 rounded-lg border border-line px-2 text-xs font-medium text-ink hover:bg-surface-alt disabled:opacity-40"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <form action={setUserActiveAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={user.isActive ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          disabled={isSelf}
                          className={`h-8 rounded-full px-3 text-xs font-medium disabled:opacity-40 ${
                            user.isActive
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-surface-alt text-muted hover:bg-line"
                          }`}
                        >
                          {user.isActive ? "Active" : "Deactivated"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Customer pages" className="flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link
              href={`/admin/users?page=${result.page - 1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
              className="text-brand-600 hover:underline"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} of {result.totalPages} · {result.total} customers
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={`/admin/users?page=${result.page + 1}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
              className="text-brand-600 hover:underline"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
