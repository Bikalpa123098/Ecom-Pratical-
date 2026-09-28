"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toast host.
 *
 * Styled to match the storefront palette and safe to render in a server layout
 * because it is a thin client wrapper around Sonner.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors={false}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-line bg-surface text-ink shadow-lift text-sm",
          title: "font-medium",
          description: "text-ink-soft",
          actionButton:
            "rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800",
          cancelButton: "rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft",
          error: "border-danger-500/30 bg-danger-50 text-danger-700",
          success: "border-success-500/30 bg-success-50 text-success-700",
          warning: "border-warning-500/30 bg-warning-50 text-warning-700",
        },
      }}
    />
  );
}
