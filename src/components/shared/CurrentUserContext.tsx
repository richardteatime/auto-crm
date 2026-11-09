"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@/lib/roles";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Name of this CRM instance shown next to the logo (separate instances only) */
  crm?: string;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  /** Resolved on the server so the menu is right from the first paint */
  initialUser?: CurrentUser | null;
}) {
  const [user, setUser] = useState<CurrentUser | null>(initialUser);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.id) setUser({ id: data.id, name: data.name, email: data.email, role: data.role ?? "admin", crm: data.crm || undefined });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

export function useRole(): Role | null {
  return useContext(CurrentUserContext)?.role ?? null;
}
