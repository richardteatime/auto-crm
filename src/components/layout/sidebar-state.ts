// Plain module (no "use client"): the root layout reads the boot script on the server.

const STORAGE_KEY = "crm-sidebar";

/** Inline script for <head>: applies the saved sidebar state before first paint */
export const SIDEBAR_BOOT_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

export function toggleSidebar() {
  const root = document.documentElement;
  const next = root.dataset.sidebar === "collapsed" ? "expanded" : "collapsed";
  root.dataset.sidebar = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode: the choice just won't persist
  }
}
