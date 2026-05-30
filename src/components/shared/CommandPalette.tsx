"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Activity,
  Settings,
  Briefcase,
  MessageSquare,
  FileText,
  TrendingUp,
  Target,
  GitBranch,
  CalendarDays,
  Bell,
  CheckSquare,
  Plus,
} from "lucide-react";

const navCommands = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Contatti", href: "/contacts", icon: Users },
  { label: "Trattative", href: "/deals", icon: Briefcase },
  { label: "Opportunità", href: "/opportunita", icon: Target },
  { label: "Attività", href: "/activities", icon: Activity },
  { label: "Task", href: "/tasks", icon: CheckSquare },
  { label: "Calendario", href: "/calendar", icon: CalendarDays },
  { label: "Timeline", href: "/timeline", icon: GitBranch },
  { label: "Preventivi", href: "/preventivi", icon: FileText },
  { label: "Finance", href: "/finance", icon: TrendingUp },
  { label: "Notifiche", href: "/notifications", icon: Bell },
  { label: "Chat Team", href: "/messages", icon: MessageSquare },
  { label: "Impostazioni", href: "/settings", icon: Settings },
];

const actionCommands = [
  { label: "Nuovo contatto", href: "/contacts", icon: Plus },
  { label: "Nuova trattativa", href: "/deals", icon: Plus },
  { label: "Nuovo task", href: "/tasks", icon: Plus },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  function handleSelect(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-lg">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          <Command.Input
            placeholder="Cerca pagina o azione..."
            className="flex h-12 w-full rounded-md bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-b"
          />
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2">
            <Command.Empty className="py-3 text-center text-sm text-muted-foreground">
              Nessun risultato
            </Command.Empty>
            <Command.Group heading="Navigazione">
              {navCommands.map((cmd) => (
                <Command.Item
                  key={cmd.href}
                  onSelect={() => handleSelect(cmd.href)}
                  className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <cmd.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{cmd.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Azioni">
              {actionCommands.map((cmd) => (
                <Command.Item
                  key={cmd.label}
                  onSelect={() => handleSelect(cmd.href)}
                  className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <cmd.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{cmd.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
