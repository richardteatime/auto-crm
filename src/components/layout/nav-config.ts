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
  PhoneCall,
  Rocket,
  LayoutDashboard,
  MessageCircle,
  UserRoundCheck,
  Video,
  Package,
  Bot,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

export type NavBadge = "activities" | "timeline" | "calendar" | "chat" | "total" | "leads";
import type { Role } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** Extra words the command palette matches on */
  keywords?: string;
  /** Active only on this exact path (not on sub-pages) */
  exact?: boolean;
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

export const LEADS_ITEM: NavItem = {
  href: "/leads",
  label: "Lead",
  icon: PhoneCall,
  badge: "leads",
  keywords: "campagne meta chiamate commerciale richiami",
};

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
  {
    label: "Vendiora",
    items: [
      {
        href: "/vendiora",
        label: "Vendiora",
        icon: Rocket,
        badge: "leads",
        keywords: "lead infobusiness pacchetti whatsapp bot contratti coaching",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Vendiora: opening it swaps the sidebar for its own menu, like a CRM inside the CRM
// ---------------------------------------------------------------------------

export const VENDIORA_PATHS = ["/vendiora", "/leads"];

export function isVendioraPath(pathname: string): boolean {
  return VENDIORA_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const VD_HOME: NavItem = { href: "/vendiora", label: "Panoramica", icon: LayoutDashboard, exact: true, keywords: "vendiora dashboard" };
const VD_WHATSAPP: NavItem = { href: "/vendiora/whatsapp", label: "WhatsApp", icon: MessageCircle, keywords: "chat bot messaggi vendiora" };
const VD_LEADS: NavItem = { ...LEADS_ITEM, keywords: `${LEADS_ITEM.keywords} vendiora` };

export const VENDIORA_SECTIONS: NavSection[] = [
  { label: null, items: [{ href: "/", label: "Torna al CRM", icon: ArrowLeft, exact: true, keywords: "sarconx" }] },
  { label: "Vendiora", items: [VD_HOME, VD_LEADS, VD_WHATSAPP] },
  {
    label: "Clienti",
    items: [
      { href: "/vendiora/clienti", label: "Clienti", icon: UserRoundCheck, keywords: "contratti venduti onboarding store" },
      { href: "/vendiora/call", label: "Call", icon: Video, keywords: "coaching affiancamento appuntamenti" },
    ],
  },
  {
    label: "Configura",
    items: [
      { href: "/vendiora/pacchetti", label: "Pacchetti", icon: Package, keywords: "prezzi offerta listino" },
      { href: "/vendiora/impostazioni", label: "Bot e azienda", icon: Bot, keywords: "whatsapp qr domande dati contratto" },
    ],
  },
];

/** A salesperson only sees the Lead section (Vendiora is founders-only) */
const SALES_SECTIONS: NavSection[] = [{ label: null, items: [LEADS_ITEM] }];

/** Where Vendiora is off (separate CRM instances) the menu keeps the plain Lead section */
const NAV_SECTIONS_NO_VENDIORA: NavSection[] = NAV_SECTIONS.map((s) =>
  s.label === "Vendiora" ? { label: "Lead", items: [LEADS_ITEM] } : s,
);

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Impostazioni",
  icon: Settings,
  keywords: "pipeline fasi configurazione",
};

const VENDIORA_ITEMS = VENDIORA_SECTIONS.slice(1).flatMap((s) => s.items);

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((s) => s.items),
  ...VENDIORA_ITEMS.filter((i) => i.href !== "/vendiora").map((i) => ({ ...i, label: `Vendiora · ${i.label}` })),
  SETTINGS_ITEM,
];

const ALL_NAV_ITEMS_NO_VENDIORA: NavItem[] = [...NAV_SECTIONS_NO_VENDIORA.flatMap((s) => s.items), SETTINGS_ITEM];

/** `vendiora` = this user may open Vendiora (founders in the SarconX CRM) */
export function navSectionsFor(role: Role | null | undefined, pathname = "", vendiora = false): NavSection[] {
  if (role === "commerciale") return SALES_SECTIONS;
  if (!vendiora) return NAV_SECTIONS_NO_VENDIORA;
  return isVendioraPath(pathname) ? VENDIORA_SECTIONS : NAV_SECTIONS;
}

export function allNavItemsFor(role: Role | null | undefined, vendiora = false): NavItem[] {
  if (role === "commerciale") return [LEADS_ITEM, SETTINGS_ITEM];
  return vendiora ? ALL_NAV_ITEMS : ALL_NAV_ITEMS_NO_VENDIORA;
}

export function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (href === "/" || exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Section and item for the current route, used by the breadcrumb */
export function findNav(pathname: string): { section: string | null; item: NavItem } | null {
  if (isVendioraPath(pathname)) {
    const items = VENDIORA_ITEMS.filter((i) => isActivePath(pathname, i.href, i.exact));
    const item = items.sort((a, b) => b.href.length - a.href.length)[0];
    if (item) return { section: "Vendiora", item };
  }
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => isActivePath(pathname, i.href, i.exact));
    if (item) return { section: section.label, item };
  }
  if (isActivePath(pathname, SETTINGS_ITEM.href)) return { section: null, item: SETTINGS_ITEM };
  return null;
}
