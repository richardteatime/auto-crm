import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  delay = 0,
  bodyClassName,
}: {
  title: string;
  icon?: LucideIcon;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
  delay?: number;
  bodyClassName?: string;
}) {
  return (
    <section
      style={{ animationDelay: `${delay}ms` }}
      className={cn("flex animate-fade-up flex-col rounded-xl border bg-card shadow-card", className)}
    >
      <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h2 className="text-sm font-semibold">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="group ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {action.label}
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>
      <div className={cn("flex-1 px-4 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function CardEmpty({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-1.5 py-6 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-[240px] text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
