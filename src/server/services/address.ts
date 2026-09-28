import "server-only";

import { prisma } from "@/lib/db";
import { addressSchema, type AddressInput } from "@/lib/schemas";
import { getCurrentUser } from "@/server/guards";

/**
 * Saved delivery addresses.
 *
 * Every read and write is scoped by `userId` from the server-side session, never
 * from the submitted form, so one customer can never read or edit another's
 * address book.
 */

export interface AddressRecord {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  email: string | null;
  province: string;
  district: string;
  municipality: string;
  wardNumber: string | null;
  tole: string | null;
  addressLine: string;
  postalCode: string | null;
  deliveryNotes: string | null;
  isDefault: boolean;
  createdAt: Date;
}

export class AddressError extends Error {}

export async function listAddresses(userId: string): Promise<AddressRecord[]> {
  const rows = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows;
}

/**
 * Saves a validated address, optionally replacing the default.
 *
 * The account keeps exactly one default so checkout can pre-fill without asking
 * which one to use, hence the clear-then-set rather than a compound update (the
 * MongoDB connector has no transaction support here).
 */
export async function saveAddress(
  userId: string,
  input: AddressInput,
  options: { id?: string } = {}
): Promise<AddressRecord> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    throw new AddressError("Please correct the highlighted fields.");
  }
  const data = parsed.data;

  if (options.id) {
    // Owner-scoped: an id belonging to someone else simply matches nothing.
    const existing = await prisma.address.findFirst({
      where: { id: options.id, userId },
      select: { id: true },
    });
    if (!existing) throw new AddressError("That address could not be found.");

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return prisma.address.update({ where: { id: existing.id }, data });
  }

  const count = await prisma.address.count({ where: { userId } });
  // The first address a customer saves is their default without being asked.
  const isDefault = data.isDefault || count === 0;

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }
  return prisma.address.create({ data: { ...data, isDefault, userId } });
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  const removed = await prisma.address.deleteMany({ where: { id, userId } });
  if (removed.count === 0) {
    throw new AddressError("That address could not be found.");
  }
}

/** Resolves the caller's default address for checkout pre-fill. */
export async function getDefaultAddress(userId: string): Promise<AddressRecord | null> {
  return prisma.address.findFirst({
    where: { userId, isDefault: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Owner-scoped convenience used by the account pages. */
export async function listMyAddresses(): Promise<AddressRecord[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return listAddresses(user.id);
}
