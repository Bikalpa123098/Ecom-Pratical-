import { cn } from "@/lib/cn";

/**
 * Form primitives.
 *
 * Inputs are uncontrolled and uncontrolled-on-purpose: the pages that use them
 * submit through `useActionState`, so the browser is never trusted with a value
 * the server then re-reads. `Field` renders the label, the control and the
 * server-returned error together so a failed submit keeps the user's input in
 * place (never cleared on error).
 */

const controlBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-ink-faint transition-colors focus:border-brand-500 focus:outline-none " +
  "focus:ring-2 focus:ring-brand-500/25 disabled:bg-paper disabled:text-ink-faint " +
  "aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-500/20";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  describedBy?: string;
}

export function TextInput({ invalid, describedBy, className, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(controlBase, className)}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-20 resize-y", className)}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  describedBy?: string;
}

export function Select({ invalid, describedBy, className, children, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(controlBase, "appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23715f5a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  id,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong text-brand-700 accent-brand-700 focus:ring-2 focus:ring-brand-500/25"
        {...rest}
      />
      <span className="text-ink-soft">{label}</span>
    </label>
  );
}

/** Non-field-specific form error, e.g. "email already registered". */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-3 text-sm text-danger-800"
    >
      {message}
    </div>
  );
}
