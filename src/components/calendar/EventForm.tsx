"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserMultiSelect } from "@/components/timeline/UserMultiSelect";
import { CalendarEventType, type CalendarEvent, type Contact } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  activity: "Attività",
  meeting: "Meeting",
  call: "Chiamata",
  travel: "Viaggio",
  out_of_office: "Fuori sede",
  personal: "Personale",
  other: "Altro",
};

const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  activity: "#3b82f6",
  meeting: "#8b5cf6",
  call: "#10b981",
  travel: "#f59e0b",
  out_of_office: "#ef4444",
  personal: "#ec4899",
  other: "#6b7280",
};

const COLOR_OPTIONS = [
  { label: "Blu", value: "#3b82f6" },
  { label: "Viola", value: "#8b5cf6" },
  { label: "Verde", value: "#10b981" },
  { label: "Ambra", value: "#f59e0b" },
  { label: "Rosso", value: "#ef4444" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Grigio", value: "#6b7280" },
  { label: "Ciano", value: "#06b6d4" },
  { label: "Arancione", value: "#f97316" },
];

function formatDatetimeLocal(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateLocal(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface EventFormProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  initialStart?: Date | null;
  initialEnd?: Date | null;
  initialAllDay?: boolean;
  contacts: Contact[];
  currentUserId: string;
  onSubmit: (data: {
    title: string;
    description: string | null;
    startAt: string;
    endAt: string;
    allDay: boolean;
    type: CalendarEventType;
    assignedTo: string[];
    contactId: string | null;
    dealId: string | null;
    projectId: string | null;
    location: string | null;
    color: string | null;
    isPrivate: boolean;
  }) => void;
  onDelete?: () => void;
}

export function EventForm({
  open,
  onClose,
  event,
  initialStart,
  initialEnd,
  initialAllDay,
  contacts,
  currentUserId,
  onSubmit,
  onDelete,
}: EventFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [type, setType] = useState<CalendarEventType>("activity");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setStartAt(allDay ? formatDateLocal(event.startAt) : formatDatetimeLocal(event.startAt));
      setEndAt(allDay ? formatDateLocal(event.endAt) : formatDatetimeLocal(event.endAt));
      setAllDay(event.allDay);
      setType(event.type);
      setAssignedTo(event.assignedTo);
      setContactId(event.contactId ?? "");
      setLocation(event.location ?? "");
      setColor(event.color ?? "");
      setIsPrivate(event.isPrivate);
    } else if (initialStart) {
      const isAllDay = initialAllDay ?? false;
      setTitle("");
      setDescription("");
      setStartAt(isAllDay ? formatDateLocal(initialStart) : formatDatetimeLocal(initialStart));
      setEndAt(initialEnd ? (isAllDay ? formatDateLocal(initialEnd) : formatDatetimeLocal(initialEnd)) : startAt);
      setAllDay(isAllDay);
      setType("activity");
      setAssignedTo([currentUserId]);
      setContactId("");
      setLocation("");
      setColor("");
      setIsPrivate(false);
    }
  }, [event, initialStart, initialEnd, initialAllDay, currentUserId]);

  // When allDay changes, reformat existing values
  useEffect(() => {
    if (!startAt || !endAt) return;
    if (allDay) {
      setStartAt((s) => s.slice(0, 10));
      setEndAt((s) => s.slice(0, 10));
    } else {
      if (startAt.length === 10) setStartAt((s) => `${s}T09:00`);
      if (endAt.length === 10) setEndAt((s) => `${s}T10:00`);
    }
  }, [allDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!startAt || !endAt) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      startAt: allDay ? `${startAt}T00:00:00` : startAt,
      endAt: allDay ? `${endAt}T23:59:59` : endAt,
      allDay,
      type,
      assignedTo,
      contactId: contactId || null,
      dealId: null,
      projectId: null,
      location: location.trim() || null,
      color: color || null,
      isPrivate,
    });
  };

  const selectedColor = color || EVENT_TYPE_COLORS[type];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Modifica evento" : "Nuovo evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Titolo *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo evento" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as CalendarEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: EVENT_TYPE_COLORS[key as CalendarEventType] }}
                        />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Colore</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 cursor-pointer transition-all",
                      selectedColor === c.value ? "border-black scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="allDay"
              checked={allDay}
              onCheckedChange={(v) => setAllDay(!!v)}
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              Tutto il giorno
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inizio *</Label>
              <Input
                type={allDay ? "date" : "datetime-local"}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Fine *</Label>
              <Input
                type={allDay ? "date" : "datetime-local"}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label>Assegnato a</Label>
            <UserMultiSelect value={assignedTo} onChange={setAssignedTo} />
          </div>

          <div>
            <Label>Contatto collegato</Label>
            <Select value={contactId} onValueChange={(v) => setContactId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Nessun contatto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun contatto</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Luogo</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Indirizzo o luogo" />
          </div>

          <div>
            <Label>Note</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dettagli aggiuntivi..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isPrivate"
              checked={isPrivate}
              onCheckedChange={(v) => setIsPrivate(!!v)}
            />
            <Label htmlFor="isPrivate" className="cursor-pointer">
              Evento privato (solo io e gli assegnati)
            </Label>
          </div>

          <DialogFooter className="gap-2">
            {event && onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete} className="cursor-pointer">
                <Trash2 className="h-4 w-4 mr-1" />
                Elimina
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Annulla
            </Button>
            <Button type="submit" className="cursor-pointer">
              {event ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
