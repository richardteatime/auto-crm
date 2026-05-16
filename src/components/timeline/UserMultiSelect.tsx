"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Users } from "lucide-react";

interface UserMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function UserMultiSelect({
  value,
  onChange,
  placeholder = "Seleziona membri del team",
}: UserMultiSelectProps) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string; email: string }>) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {});
  }, []);

  const toggleUser = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  const removeUser = (userId: string) => {
    onChange(value.filter((id) => id !== userId));
  };

  const selectedUsers = users.filter((u) => value.includes(u.id));

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full">
          <Button
            variant="outline"
            className="w-full justify-between cursor-pointer font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              {selectedUsers.length > 0
                ? `${selectedUsers.length} selezionato${selectedUsers.length > 1 ? "i" : ""}`
                : placeholder}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
          {users.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nessun utente trovato
            </div>
          )}
          {users.map((u) => (
            <DropdownMenuCheckboxItem
              key={u.id}
              checked={value.includes(u.id)}
              onCheckedChange={() => toggleUser(u.id)}
            >
              {u.name || u.email}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <Badge
              key={u.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {u.name || u.email}
              <button
                type="button"
                onClick={() => removeUser(u.id)}
                className="cursor-pointer rounded-sm hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
