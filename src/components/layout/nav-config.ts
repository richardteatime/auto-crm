import {
  Sun,
  Bell,
  MessageSquare,
  SquareKanban,
  Handshake,
  Target,
  FileText,
  Users,
  ListChecks,
  CalendarDays,
  FolderKanban,
  TrendingUp,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavBadge = "activities" | "timeline" | "calendar" | "chat" | "total";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** Extra words the command palette matches on */
  keywords?: string;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Oggi", icon: Sun, keywords: "dashboard home riepilogo" },
      { href: "/notifications", label: "Notifiche", icon: Bell, badge: "total" },
      { href: "/messages", label: "Chat team", icon: MessageSquare, badge: "chat", keywords: "messaggi" },
    ],
  },
  {
    label: "Vendite",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: SquareKanban, keywords: "kanban fasi" },
      { href: "/deals", label: "Trattative", icon: Handshake, keywords: "deal vendite" },
      { href: "/opportunita", label: "Opportunità", icon: Target, keywords: "idee proposte" },
      { href: "/preventivi", label: "Preventivi", icon: FileText, keywords: "offerte pdf quote" },
      { href: "/contacts", label: "Contatti", icon: Users, keywords: "clienti lead aziende" },
    ],
  },
  {
    label: "Operativo",
    items: [
      { href: "/activities", label: "Attività", icon: ListChecks, badge: "activities", keywords: "follow-up chiamate task" },
      { href: "/calendar", label: "Calendario", icon: CalendarDays, badge: "calendar", keywords: "eventi appuntamenti agenda" },
      { href: "/timeline", label: "Progetti", icon: FolderKanban, badge: "timeline", keywords: "timeline consegne lavori" },
    ],
  },
  {
    label: "Business",
    items: [{ href: "/finance", label: "Finance", icon: TrendingUp, keywords: "fatturato spese mrr incassi" }],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Impostazioni",
  icon: Settings,
  keywords: "pipeline fasi configurazione",
};

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_ITEM];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Section and item for the current route, used by the breadcrumb */
export function findNav(pathname: string): { section: string | null; item: NavItem } | null {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => isActivePath(pathname, i.href));
    if (item) return { section: section.label, item };
  }
  if (isActivePath(pathname, SETTINGS_ITEM.href)) return { section: null, item: SETTINGS_ITEM };
  return null;
}
