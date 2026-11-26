"use client";

import { useEffect } from "react";

/**
 * When the URL has #something, scroll to the element with that id and flash a ring on it.
 * Lists load after the page (fetch), so it retries for a few seconds until the element exists.
 * Also reacts to in-page anchor clicks (hashchange).
 */
export function HashHighlight() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let clear: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (timer) clearInterval(timer);
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      let tries = 0;
      timer = setInterval(() => {
        const el = document.getElementById(id);
        if (el) {
          if (timer) clearInterval(timer);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2", "transition-shadow");
          if (clear) clearTimeout(clear);
          clear = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2500);
        } else if (++tries > 25) {
          if (timer) clearInterval(timer);
        }
      }, 200);
    };

    run();
    window.addEventListener("hashchange", run);
    return () => {
      window.removeEventListener("hashchange", run);
      if (timer) clearInterval(timer);
      if (clear) clearTimeout(clear);
    };
  }, []);

  return null;
}
