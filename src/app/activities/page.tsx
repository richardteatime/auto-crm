"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { ActivityForm } from "@/components/activities/ActivityForm";
import {
  Phone, Mail, Users, FileText, Clock, AlertCircle, Activity,
  Plus, Paperclip, CalendarDays, Search, X,
} from "lucide-react";
import { formatRelativeDate, formatDate, getActivityStatus, ACTIVITY_STATUS_STYLE, ACTIVITY_TYPE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActivityType } from "@/types";
import { ReportDialog } from "@/components/shared/ReportDialog";

const typeIcons: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: Users, note: FileText, follow_up: Clock,
};

const TYPE_OPTIONS = [
  { value: "", label: "Tutti i tipi" },
  { value: "call", label: "Chiamata" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Riunione" },
  { value: "note", label: "Nota" },
  { value: "follow_up", label: "Follow-up" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tutti" },
  { value: "completed", label: "Completate" },
  { value: "open", label: "In attesa" },
  { value: "overdue", label: "Scadute" },
];

const PERIOD_OPTIONS = [
  { value: "", label: "Sempre" },
  { value: "7", label: "Ultimi 7 giorni" },
  { value: "30", label: "Ultimi 30 giorni" },
  { value: "90", label: "Ultimi 90 giorni" },
];

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  startAt?: number | Date | null;
  endAt?: number | Date | null;
  notes?: string | null;
  attachments?: string | null;
  contactName: string | null;
  contactCompany?: string | null;
  contactId: string;
  scheduledAt: number | Date | null;
  completedAt: number | Date | null;
  createdAt: number | Date;
}

interface FollowUps {
  overdue: ActivityItem[];
  today: ActivityItem[];
  upcoming: ActivityItem[];
  unscheduled: ActivityItem[];
}

function toMs(val: number | Date | null | undefined): number {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  return val < 1e12 ? val * 1000 : val;
}

export default function ActivitiesPage() {
  const [allActivities, setActivities] = useState<ActivityItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUps | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterContact, setFilterContact] = useState("");

  const loadData = () => {
    Promise.all([
      fetch("/api/activities").then((r) => r.json()),
      fetch("/api/followups").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]).then(([acts, fups, contacts]) => {
      const companyMap: Record<string, string | null> = {};
      if (Array.isArray(contacts)) {
        for (const c of contacts) companyMap[c.id] = c.company ?? null;
      }
      const enriched = Array.isArray(acts)
        ? acts.map((a: ActivityItem) => ({ ...a, contactCompany: companyMap[a.contactId] ?? null }))
        : [];
      setActivities(enriched);
      setFollowUps(fups);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => allActivities.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      const hit = a.description.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q) ||
        a.contactName?.toLowerCase().includes(q) ||
        a.contactCompany?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filterType && a.type !== filterType) return false;
    if (filterContact) {
      if (!a.contactName?.toLowerCase().includes(filterContact.toLowerCase())) return false;
    }
    if (filterStatus) {
      const s = getActivityStatus(a);
      if (s !== filterStatus) return false;
    }
    if (filterPeriod) {
      const days = parseInt(filterPeriod);
      const cutoff = Date.now() - days * 86400000;
      if (toMs(a.createdAt) < cutoff) return false;
    }
    return true;
  }), [allActivities, search, filterType, filterStatus, filterPeriod, filterContact]);

  const isFiltered = !!(search || filterType || filterStatus || filterPeriod || filterContact);

  const resetFilters = () => {
    setSearch(""); setFilterType(""); setFilterStatus(""); setFilterPeriod(""); setFilterContact("");
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { "": allActivities.length };
    for (const a of allActivities) {
      const s = getActivityStatus(a);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [allActivities]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Attività</h1></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attività</h1>
          <p className="text-muted-foreground">Storico interazioni e follow-up</p>
        </div>
        <div className="flex gap-2">
          <ReportDialog section="activities" />
          <Button onClick={() => setShowForm(true)} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Registra
          </Button>
        </div>
      </div>

      <ActivityForm open={showForm} onClose={() => { setShowForm(false); loadData(); }} />

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca in descrizione, note, contatto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="cursor-pointer gap-1 shrink-0">
              <X className="h-3.5 w-3.5" />
              Azzera
            </Button>
          )}
        </div>

        {/* Tipo chips */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterType(value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                  filterType === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
                {value && <span className="ml-1 opacity-60">({allActivities.filter((a) => a.type === value).length})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Status + Period */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Stato</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterStatus(value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                    filterStatus === value
                      ? value === "overdue" ? "bg-red-500 text-white border-red-500"
                        : value === "completed" ? "bg-green-600 text-white border-green-600"
                        : value === "open" ? "bg-yellow-500 text-white border-yellow-500"
                        : "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                  <span className="ml-1 opacity-70">({statusCounts[value] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Periodo</p>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterPeriod(value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                    filterPeriod === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 min-w-[160px]">
            <p className="text-xs text-muted-foreground font-medium">Filtra contatto</p>
            <Input
              placeholder="Nome contatto..."
              value={filterContact}
              onChange={(e) => setFilterContact(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Follow-ups urgenti */}
      {followUps && (followUps.overdue.length > 0 || followUps.today.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {followUps.overdue.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Scaduti ({followUps.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUps.overdue.map((f) => (
                  <div key={f.id} className="p-2 rounded bg-destructive/5 text-sm">
                    <p className="font-medium">{f.description}</p>
                    <p className="text-xs text-muted-foreground">{f.contactName} &middot; {formatDate(f.scheduledAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {followUps.today.length > 0 && (
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  Oggi ({followUps.today.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUps.today.map((f) => (
                  <div key={f.id} className="p-2 rounded bg-yellow-500/5 text-sm">
                    <p className="font-medium">{f.description}</p>
                    <p className="text-xs text-muted-foreground">{f.contactName}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Tutte le Attività</span>
            <span className="text-sm font-normal text-muted-foreground">
              {filtered.length}{isFiltered ? ` di ${allActivities.length}` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            allActivities.length === 0 ? (
              <EmptyState icon={Activity} title="Nessuna attività"
                description="Le attività appaiono quando registri chiamate, email, riunioni o note." />
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nessuna attività corrisponde ai filtri applicati.
                <button onClick={resetFilters} className="ml-1 underline cursor-pointer">Azzera filtri</button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {filtered.map((activity) => {
                const Icon = typeIcons[activity.type] || FileText;
                const config = ACTIVITY_TYPE_CONFIG[activity.type as ActivityType];
                const status = getActivityStatus(activity);
                const style = ACTIVITY_STATUS_STYLE[status];
                let attachmentList: { name: string; url: string }[] = [];
                try { attachmentList = JSON.parse(activity.attachments || "[]"); } catch { /* */ }
                return (
                  <div key={activity.id} className="flex gap-3 items-start">
                    <div className={`rounded-full p-2 shrink-0 ${style.iconBg}`}>
                      <Icon className={`h-4 w-4 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{config?.label || activity.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {activity.contactName}
                          {activity.contactCompany && (
                            <span className="text-muted-foreground/60"> · {activity.contactCompany}</span>
                          )}
                        </span>
                        <span className={cn("text-xs font-medium",
                          status === "completed" ? "text-green-600" : status === "overdue" ? "text-red-600" : "text-yellow-600")}>
                          {style.label}
                        </span>
                        {attachmentList.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />{attachmentList.length}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1">{activity.description}</p>
                      {activity.startAt && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(activity.startAt as number | Date)}
                          {activity.endAt ? ` → ${formatDate(activity.endAt as number | Date)}` : ""}
                        </p>
                      )}
                      {activity.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.notes}</p>
                      )}
                      {attachmentList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {attachmentList.map((a) => (
                            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-0.5">
                              <Paperclip className="h-3 w-3" />{a.name}
                            </a>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeDate(activity.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
