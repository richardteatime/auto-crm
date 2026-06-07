"use client";

import { useEffect } from "react";

export function FormEmbedResizer({ formId }: { formId: string }) {
  useEffect(() => {
    function post() {
      try {
        parent.postMessage(
          {
            type: "sarconx-form-height",
            id: formId,
            height: document.documentElement.scrollHeight,
          },
          "*",
        );
      } catch {
        // ignore
      }
    }
    window.addEventListener("load", post);
    window.addEventListener("resize", post);
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(post);
      ro.observe(document.documentElement);
    } catch {
      // ResizeObserver not supported
    }
    post();
    return () => {
      window.removeEventListener("load", post);
      window.removeEventListener("resize", post);
      if (ro) ro.disconnect();
    };
  }, [formId]);

  return null;
}
