import Link from "next/link";
import { Briefcase, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type RelatedKind = "trattativa" | "opportunita" | "preventivo";

const KIND = {
  trattativa: { Icon: Briefcase, label: "Trattativa", className: "border-blue-500/25 bg-blue-500/[0.07] text-blue-700 hover:bg-blue-500/15 dark:text-blue-300" },
  opportunita: { Icon: Target, label: "Opportunità", className: "border-amber-500/30 bg-amber-500/[0.08] text-amber-700 hover:bg-amber-500/15 dark:text-amber-300" },
  preventivo: { Icon: FileText, label: "Preventivo", className: "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300" },
} as const;

/**
 * Small clickable pill that jumps to a related deal / opportunity / quote.
 * `href` starting with "#" stays on the same page (plain anchor, see HashHighlight).
 */
export function RelatedChip({
  kind,
  href,
  label,
  className,
}: {
  kind: RelatedKind;
  href: string;
  /** Text after the icon (defaults to the kind name) */
  label?: string;
  className?: string;
}) {
  const { Icon, label: kindLabel, className: tone } = KIND[kind];
  const cls = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 transition-colors",
    tone,
    className
  );
  const content = (
    <>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label ?? kindLabel}</span>
    </>
  );
  const title = `Vai a: ${KIND[kind].label.toLowerCase()}${label ? ` · ${label}` : ""}`;
  return href.startsWith("#") ? (
    <a href={href} className={cls} title={title}>
      {content}
    </a>
  ) : (
    <Link href={href} className={cls} title={title}>
      {content}
    </Link>
  );
}
