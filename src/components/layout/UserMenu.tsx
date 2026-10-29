"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings, Keyboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContactAvatar } from "@/components/shared/ContactAvatar";
import { useCurrentUser } from "@/components/shared/CurrentUserContext";
import { ThemeSwitch } from "@/components/shared/ThemeProvider";
import { useCommandPalette } from "@/components/shared/CommandPalette";
import { cn } from "@/lib/utils";

export async function logout(router: ReturnType<typeof useRouter>) {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  router.push("/login");
  router.refresh();
}

export function UserMenu({ className }: { className?: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const openPalette = useCommandPalette();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-sidebar-accent sidebar-collapsed:justify-center",
              className
            )}
            aria-label="Menu utente"
          />
        }
      >
        <ContactAvatar name={user?.name ?? "?"} size="sm" />
        <span className="min-w-0 flex-1 sidebar-collapsed:hidden">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {user?.name ?? "Il tuo account"}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{user?.email ?? "…"}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground sidebar-collapsed:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <ContactAvatar name={user?.name ?? "?"} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name ?? "Il tuo account"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-sm">Tema</span>
          <ThemeSwitch />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings />
          Impostazioni
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openPalette}>
          <Keyboard />
          Cerca e scorciatoie
          <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logout(router)}>
          <LogOut />
          Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
