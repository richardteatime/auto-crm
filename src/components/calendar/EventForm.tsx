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
import { cn, localDateStrToUtcIso } from "@/lib/utils";
import { Trash2, Clock, MapPin, Users, FileText, Tag, Eye, Palette } from "lucide-react";

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
      startAt: allDay ? localDateStrToUtcIso(`${startAt}T00:00:00`) : localDateStrToUtcIso(startAt),
      endAt: allDay ? localDateStrToUtcIso(`${endAt}T23:59:59`) : localDateStrToUtcIso(endAt),
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
      <DialogContent className="w-[900px] max-w-[95vw] h-auto max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-2">
          <DialogTitle className="text-xl">
            {event ? "Modifica evento" : "Nuovo evento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {/* Titolo */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="evt-title" className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Titolo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="evt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inserisci il titolo dell'evento"
                className="h-11"
                required
              />
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Tipo evento
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as CalendarEventType)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: EVENT_TYPE_COLORS[key as CalendarEventType] }}
                        />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Colore */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Colore
              </Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 cursor-pointer transition-all",
                      selectedColor === c.value
                        ? "border-black scale-110 shadow-sm"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Data/Ora box */}
            <div className="col-span-2 bg-muted/40 rounded-lg p-4 grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="col-span-2 flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Data e ora
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allDay"
                    checked={allDay}
                    onCheckedChange={(v) => setAllDay(!!v)}
                  />
                  <Label htmlFor="allDay" className="cursor-pointer text-sm">
                    Tutto il giorno
                  </Label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Inizio *</Label>
                <Input
                  type={allDay ? "date" : "datetime-local"}
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fine *</Label>
                <Input
                  type={allDay ? "date" : "datetime-local"}
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
            </div>

            {/* Assegnazione */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                Assegnato a
              </Label>
              <UserMultiSelect value={assignedTo} onChange={setAssignedTo} />
            </div>

            {/* Contatto */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Contatto collegato</Label>
              <Select
                value={contactId || "none"}
                onValueChange={(v) => setContactId(v === "none" || v === null ? "" : v)}
              >
                <SelectTrigger className="h-11">
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

            {/* Luogo */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Luogo
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Indirizzo o luogo"
                className="h-11"
              />
            </div>

            {/* Note */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-semibold">Note / Descrizione</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dettagli aggiuntivi sull'evento..."
                className="resize-none"
              />
            </div>

            {/* Privacy */}
            <div className="col-span-2 flex items-center gap-3 bg-muted/30 rounded-lg p-3">
              <Checkbox
                id="isPrivate"
                checked={isPrivate}
                onCheckedChange={(v) => setIsPrivate(!!v)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="isPrivate" className="cursor-pointer text-sm font-semibold flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Evento privato
                </Label>
                <p className="text-xs text-muted-foreground">
                  Visibile solo al creatore e agli utenti assegnati
                </p>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="px-6 py-4 border-t gap-2">
          {event && onDelete && (
            <Button type="button" variant="destructive" onClick={onDelete} className="cursor-pointer">
              <Trash2 className="h-4 w-4 mr-1.5" />
              Elimina
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
            Annulla
          </Button>
          <Button type="submit" onClick={handleSubmit} className="cursor-pointer">
            {event ? "Salva modifiche" : "Crea evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
