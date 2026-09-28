"use client";

import { useEffect, useRef } from "react";

/**
 * Submits the signed eSewa form as soon as it mounts.
 *
 * eSewa's endpoint only accepts a POST carrying the signed fields in the body,
 * so the request has to leave from the browser. This is a no-op until React has
 * attached the form, which avoids the classic race where an inline script runs
 * before the inputs exist.
 */
export function EsewaAutoSubmit({ formName }: { formName: string }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const form = document.forms.namedItem(formName);
    // `HTMLFormElement` also matches `RadioNodeList`, hence the instanceof check.
    if (!(form instanceof HTMLFormElement)) return;

    done.current = true;
    form.submit();
  }, [formName]);

  return null;
}
