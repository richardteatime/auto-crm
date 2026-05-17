"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import itLocale from "@fullcalendar/core/locales/it";
import type { EventInput, EventDropArg, EventClickArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventForm } from "@/components/calendar/EventForm";
import type { CalendarEvent, CalendarEventType, Contact } from "@/types";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";

const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  activity: "#3b82f6",
  meeting: "#8b5cf6",
  call: "#10b981",
  travel: "#f59e0b",
  out_of_office: "#ef4444",
  personal: "#ec4899",
  other: "#6b7280",
};

function toFcEvent(event: CalendarEvent): EventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.startAt.toISOString(),
    end: event.endAt.toISOString(),
    allDay: event.allDay,
    backgroundColor: event.color || EVENT_TYPE_COLORS[event.type],
    borderColor: event.color || EVENT_TYPE_COLORS[event.type],
    textColor: "#fff",
    extendedProps: {
      ...event,
    },
  };
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [initialStart, setInitialStart] = useState<Date | null>(null);
  const [initialEnd, setInitialEnd] = useState<Date | null>(null);
  const [initialAllDay, setInitialAllDay] = useState(false);

  // Load current user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) setCurrentUserId(data.id);
      })
      .catch(() => {});
  }, []);

  // Load contacts
  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setContacts(data);
      })
      .catch(() => {});
  }, []);

  const fetchEvents = useCallback(async (startStr: string, endStr: string) => {
    try {
      const res = await fetch(`/api/calendar/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`);
      if (!res.ok) throw new Error("Errore caricamento eventi");
      const data: CalendarEvent[] = await res.json();
      setEvents(
        data.map((e) => ({
          ...e,
          startAt: new Date(e.startAt),
          endAt: new Date(e.endAt),
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        }))
      );
    } catch (e) {
      toast.error("Errore nel caricamento degli eventi");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDatesSet = useCallback(
    (arg: { start: Date; end: Date }) => {
      fetchEvents(arg.start.toISOString(), arg.end.toISOString());
    },
    [fetchEvents]
  );

  const handleDateClick = (arg: { date: Date; allDay: boolean }) => {
    setSelectedEvent(null);
    setInitialStart(arg.date);
    const end = new Date(arg.date);
    if (arg.allDay) {
      end.setDate(end.getDate() + 1);
    } else {
      end.setHours(end.getHours() + 1);
    }
    setInitialEnd(end);
    setInitialAllDay(arg.allDay);
    setFormOpen(true);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const ev = events.find((e) => e.id === arg.event.id);
    if (ev) {
      setSelectedEvent(ev);
      setInitialStart(null);
      setInitialEnd(null);
      setInitialAllDay(false);
      setFormOpen(true);
    }
  };

  const handleSubmit = async (data: {
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
  }) => {
    try {
      if (selectedEvent) {
        const res = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Errore aggiornamento");
        toast.success("Evento aggiornato");
      } else {
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Errore creazione");
        toast.success("Evento creato");
      }
      setFormOpen(false);
      const api = calendarRef.current?.getApi();
      if (api) {
        fetchEvents(api.view.activeStart.toISOString(), api.view.activeEnd.toISOString());
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/calendar/events/${selectedEvent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
      toast.success("Evento eliminato");
      setFormOpen(false);
      const api = calendarRef.current?.getApi();
      if (api) {
        fetchEvents(api.view.activeStart.toISOString(), api.view.activeEnd.toISOString());
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleEventDrop = async (arg: EventDropArg) => {
    try {
      const res = await fetch(`/api/calendar/events/${arg.event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: arg.event.start?.toISOString(),
          endAt: arg.event.end?.toISOString(),
          allDay: arg.event.allDay,
        }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      toast.success("Evento spostato");
    } catch (e) {
      toast.error(String(e));
      arg.revert();
    }
  };

  const handleEventResize = async (arg: EventResizeDoneArg) => {
    try {
      const res = await fetch(`/api/calendar/events/${arg.event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: arg.event.start?.toISOString(),
          endAt: arg.event.end?.toISOString(),
          allDay: arg.event.allDay,
        }),
      });
      if (!res.ok) throw new Error("Errore aggiornamento");
      toast.success("Evento ridimensionato");
    } catch (e) {
      toast.error(String(e));
      arg.revert();
    }
  };

  const fcEvents = events.map(toFcEvent);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Calendario</h1>
        </div>
        <Button
          onClick={() => {
            const now = new Date();
            setSelectedEvent(null);
            setInitialStart(now);
            const end = new Date(now);
            end.setHours(end.getHours() + 1);
            setInitialEnd(end);
            setInitialAllDay(false);
            setFormOpen(true);
          }}
          className="cursor-pointer"
        >
          + Nuovo evento
        </Button>
      </div>

      <Card>
        <CardContent className="p-2 md:p-4">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
              }}
              locale={itLocale}
              firstDay={1}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              events={fcEvents}
              datesSet={handleDatesSet}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              height="auto"
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              allDaySlot={true}
              nowIndicator={true}
            />
          )}
        </CardContent>
      </Card>

      <EventForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        event={selectedEvent}
        initialStart={initialStart}
        initialEnd={initialEnd}
        initialAllDay={initialAllDay}
        contacts={contacts}
        currentUserId={currentUserId}
        onSubmit={handleSubmit}
        onDelete={selectedEvent ? handleDelete : undefined}
      />
    </div>
  );
}
