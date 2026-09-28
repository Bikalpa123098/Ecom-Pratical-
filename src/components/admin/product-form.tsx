"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { GENDERS, GENDER_LABELS, PRODUCT_STATUSES, toRupees } from "@/lib/constants";
import { saveProductAction, type AdminState } from "@/app/actions/admin-actions";
import { Checkbox, Field, FormError, Select, TextArea, TextInput } from "@/components/ui/form";
import type { AdminProductForm } from "@/server/services/admin-products";

/**
 * Product create/edit form.
 *
 * Prices are typed in rupees and converted on the server, because "5200" means
 * Rs. 5,200 to whoever is doing the data entry; the database and every money
 * calculation downstream are in paisa.
 */
export function ProductForm({
  product,
  categories,
  brands,
}: {
  product: AdminProductForm | null;
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    saveProductAction,
    { ok: false }
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="space-y-6">
        <FormError message={state.ok ? undefined : state.message} />

        <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={state.errors?.name} required className="sm:col-span-2">
            <TextInput id="name" name="name" defaultValue={product?.name ?? ""} required maxLength={120} />
          </Field>

          <Field
            label="URL slug"
            htmlFor="slug"
            error={state.errors?.slug}
            hint="Left blank, it is generated from the name."
          >
            <TextInput id="slug" name="slug" defaultValue={product?.slug ?? ""} placeholder="auto" />
          </Field>

          <Field label="SKU" htmlFor="sku" error={state.errors?.sku} hint="Left blank, it is generated.">
            <TextInput id="sku" name="sku" defaultValue={product?.sku ?? ""} placeholder="auto" />
          </Field>

          <Field label="Short description" htmlFor="shortDescription" error={state.errors?.shortDescription} className="sm:col-span-2">
            <TextInput
              id="shortDescription"
              name="shortDescription"
              defaultValue={product?.shortDescription ?? ""}
              maxLength={240}
            />
          </Field>

          <Field label="Description" htmlFor="description" error={state.errors?.description} required className="sm:col-span-2">
            <TextArea id="description" name="description" rows={6} defaultValue={product?.description ?? ""} required />
          </Field>
        </section>

        <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
          <Field
            label="Price (Rs.)"
            htmlFor="price"
            error={state.errors?.price}
            required
          >
            <TextInput
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={product ? toRupees(product.price) : ""}
              required
            />
          </Field>

          <Field
            label="Discount price (Rs.)"
            htmlFor="discountPrice"
            error={state.errors?.discountPrice}
            hint="Must be lower than the price. Blank for no discount."
          >
            <TextInput
              id="discountPrice"
              name="discountPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={product?.discountPrice ? toRupees(product.discountPrice) : ""}
            />
          </Field>

          <Field label="Category" htmlFor="categoryId" error={state.errors?.categoryId} required>
            <Select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""} required>
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Brand" htmlFor="brandId" error={state.errors?.brandId} required>
            <Select id="brandId" name="brandId" defaultValue={product?.brandId ?? ""} required>
              <option value="" disabled>
                Choose a brand
              </option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Gender" htmlFor="gender" error={state.errors?.gender} required>
            <Select id="gender" name="gender" defaultValue={product?.gender ?? "UNISEX"} required>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_LABELS[gender]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Colour name" htmlFor="colorName" error={state.errors?.colorName}>
            <TextInput id="colorName" name="colorName" defaultValue={product?.colorName ?? ""} maxLength={40} />
          </Field>

          <Field label="Colour hex" htmlFor="colorHex" error={state.errors?.colorHex} hint="For example #1f2937">
            <TextInput id="colorHex" name="colorHex" defaultValue={product?.colorHex ?? ""} placeholder="#000000" />
          </Field>

          <Field label="Material" htmlFor="material" error={state.errors?.material}>
            <TextInput id="material" name="material" defaultValue={product?.material ?? ""} maxLength={60} />
          </Field>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <Field
            label="Images"
            htmlFor="images"
            error={state.errors?.imagesText}
            hint="One path or URL per line, for example /images/products/trail-runner-1.svg"
            required
          >
            <TextArea id="images" name="images" rows={4} defaultValue={product?.images.join("\n") ?? ""} required />
          </Field>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Sizes &amp; stock</h2>
          <p className="mt-1 text-xs text-muted">
            One <code>size:stock</code> pair per row. EU sizes, stock 0 means sold out.
            Saving replaces the whole size list.
          </p>
          <div className="mt-3 space-y-2">
            {(product?.sizes ?? []).map((size, index) => (
              <SizeRow key={`${size.size}-${index}`} size={size.size} stock={size.stock} />
            ))}
            {/* Enough blank rows for a typical new product. */}
            {Array.from({ length: Math.max(0, 6 - (product?.sizes.length ?? 0)) }).map(
              (_, index) => <SizeRow key={`blank-${index}`} size="" stock={0} />
            )}
          </div>
          {state.errors?.sizes ? (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {state.errors.sizes}
            </p>
          ) : null}
        </section>
      </div>

      <div className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5">
          <Field label="Status" htmlFor="status" error={state.errors?.status}>
            <Select id="status" name="status" defaultValue={product?.status ?? "DRAFT"}>
              {PRODUCT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>

          <Checkbox
            id="featured"
            name="featured"
            label="Feature on the homepage"
            defaultChecked={product?.featured ?? false}
          />

          <Field label="Tags" htmlFor="tags" error={state.errors?.tagsText} hint="Comma separated.">
            <TextInput id="tags" name="tags" defaultValue={product?.tags.join(", ") ?? ""} />
          </Field>

          <SubmitButton pending={pending} isNew={!product} />
        </section>
      </div>
    </form>
  );
}

function SizeRow({ size, stock }: { size: string; stock: number }) {
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`size-${size || "blank"}`}>
        Size
      </label>
      <input
        name="sizes"
        placeholder="40"
        defaultValue={size}
        className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand-500"
      />
      <span aria-hidden className="text-muted">
        :
      </span>
      <label className="sr-only" htmlFor={`stock-${size || "blank"}`}>
        Stock for size {size}
      </label>
      <input
        name="stock"
        type="number"
        min={0}
        placeholder="0"
        defaultValue={stock}
        className="h-9 w-24 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand-500"
      />
      <span aria-hidden className="text-xs text-muted">
        Size:Stock
      </span>
    </div>
  );
}

function SubmitButton({ pending, isNew }: { pending: boolean; isNew: boolean }) {
  const { pending: submitting } = useFormStatus();
  const busy = pending || submitting;

  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {busy ? "Saving…" : isNew ? "Create product" : "Save changes"}
    </button>
  );
}
