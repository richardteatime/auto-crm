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
  /** Vendiora (sub-CRM) is on in this CRM and open to this user */
  vendiora?: boolean;
  /** Brand the leads are contacted with (VendiOra where Vendiora is on) */
  leadBrand?: string;
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
        if (!cancelled && data?.id) setUser({ id: data.id, name: data.name, email: data.email, role: data.role ?? "admin", crm: data.crm || undefined, vendiora: data.vendiora === true, leadBrand: data.leadBrand || undefined });
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

/** True when this user may open Vendiora (founders, in the SarconX CRM) */
export function useVendiora(): boolean {
  const u = useContext(CurrentUserContext);
  return !!u && u.role === "admin" && u.vendiora === true;
}

/** Brand used in messages to leads: "VendiOra" in the SarconX CRM, else this CRM's own */
export function useLeadBrand(): string {
  return useContext(CurrentUserContext)?.leadBrand || "SarconX";
}

export function useRole(): Role | null {
  return useContext(CurrentUserContext)?.role ?? null;
}
