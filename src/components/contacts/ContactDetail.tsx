"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContactForm } from "./ContactForm";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { DealForm } from "@/components/deals/DealForm";
import { OpportunityList } from "@/components/opportunities/OpportunityList";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  Clock,
  Users,
  Pencil,
  Trash2,
  Plus,
  MessageCircle,
  Copy,
  Check,
  Paperclip,
  CalendarDays,
} from "lucide-react";
import { formatCurrency, formatDate, formatRelativeDate, cleanPhoneForWhatsApp, getActivityStatus, ACTIVITY_STATUS_STYLE } from "@/lib/constants";
import { ACTIVITY_TYPE_CONFIG, SOURCE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import type { Temperature, ActivityType, LeadSource } from "@/types";

const activityIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  follow_up: Clock,
};

interface ContactDetailClientProps {
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    source: string;
    temperature: string;
    score: number;
    notes: string | null;
    createdAt: number | Date;
  };
  deals: Array<{
    id: string;
    title: string;
    value: number;
    probability: number;
    stageName: string | null;
    stageColor: string | null;
    createdAt: number | Date;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    startAt?: number | Date | null;
    endAt?: number | Date | null;
    notes?: string | null;
    attachments?: string | null;
    scheduledAt: number | Date | null;
    completedAt: number | Date | null;
    createdAt: number | Date;
  }>;
}

export function ContactDetailClient({
  contact,
  deals,
  activities,
}: ContactDetailClientProps) {
  const router = useRouter();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copiato");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Errore durante la copia");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Sei sicuro di voler eliminare questo contatto? Questa azione non può essere annullata.")) {
      return;
    }

    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione");
      toast.success("Contatto eliminato");
      router.push("/contacts");
    } catch {
      toast.error("Errore durante l'eliminazione del contatto");
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Errore");
      toast.success("Attività completata");
      router.refresh();
    } catch {
      toast.error("Errore durante il completamento dell'attività");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/contacts")}
          className="cursor-pointer"
          aria-label="Torna ai contatti"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <StatusBadge temperature={contact.temperature as Temperature} />
          </div>
          <p className="text-muted-foreground">
            Score: {contact.score}/100 &middot;{" "}
            {SOURCE_LABELS[contact.source as LeadSource] || contact.source}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditForm(true)}
            className="cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Modifica
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="cursor-pointer text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Elimina
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline flex-1 truncate">
                  {contact.email}
                </a>
                <button
                  onClick={() => handleCopy(contact.email!, "email")}
                  className="p-1 rounded hover:bg-muted cursor-pointer"
                  title="Copia email"
                >
                  {copiedField === "email" ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{contact.phone}</span>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsApp(contact.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-green-50 cursor-pointer"
                    title="Apri WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  </a>
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-1 rounded hover:bg-blue-50 cursor-pointer"
                    title="Chiama"
                  >
                    <Phone className="h-3.5 w-3.5 text-blue-600" />
                  </a>
                  <button
                    onClick={() => handleCopy(contact.phone!, "phone")}
                    className="p-1 rounded hover:bg-muted cursor-pointer"
                    title="Copia telefono"
                  >
                    {copiedField === "phone" ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{contact.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Creato il {formatDate(contact.createdAt)}</span>
            </div>
            {contact.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Trattative ({deals.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDealForm(true)}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nuova
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna trattativa</p>
            ) : (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/deals/${deal.id}`)}
                  >
                    <p className="text-sm font-medium">{deal.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(deal.value)}
                      </span>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: deal.stageColor || undefined,
                          color: deal.stageColor || undefined,
                        }}
                      >
                        {deal.stageName}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Attività ({activities.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActivityForm(true)}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" />
              Registra
            </Button>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna attività. Registra una chiamata, email o nota.
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const Icon = activityIcons[activity.type] || FileText;
                  const config = ACTIVITY_TYPE_CONFIG[activity.type as ActivityType];
                  const status = getActivityStatus(activity);
                  const style = ACTIVITY_STATUS_STYLE[status];
                  let attachmentList: { name: string; url: string }[] = [];
                  try { attachmentList = JSON.parse(activity.attachments || "[]"); } catch { /* */ }
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className={`rounded-full p-2 h-fit shrink-0 ${style.iconBg}`}>
                        <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {config?.label || activity.type}
                          </Badge>
                          <span className={`text-xs font-medium ${
                            status === "completed" ? "text-green-600" :
                            status === "overdue"   ? "text-red-600"   :
                                                     "text-yellow-600"
                          }`}>
                            {style.label}
                          </span>
                          {status !== "completed" && (
                            <button
                              className="text-xs text-muted-foreground underline cursor-pointer hover:text-foreground"
                              onClick={() => handleCompleteActivity(activity.id)}
                            >
                              Segna completata
                            </button>
                          )}
                          {attachmentList.length > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Paperclip className="h-3 w-3" />
                              {attachmentList.length}
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
                              <a
                                key={a.url}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-0.5"
                              >
                                <Paperclip className="h-3 w-3" />
                                {a.name}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeDate(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Opportunità — sezione full width sotto le 3 card */}
      <OpportunityList contactId={contact.id} />

      <ContactForm
        open={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          router.refresh();
        }}
        initialData={{
          id: contact.id,
          name: contact.name,
          email: contact.email || "",
          phone: contact.phone || "",
          company: contact.company || "",
          source: contact.source,
          temperature: contact.temperature as "cold" | "warm" | "hot",
          notes: contact.notes || "",
        }}
      />

      <ActivityForm
        open={showActivityForm}
        onClose={() => {
          setShowActivityForm(false);
          router.refresh();
        }}
        preselectedContactId={contact.id}
      />

      <DealForm
        open={showDealForm}
        onClose={() => {
          setShowDealForm(false);
          router.refresh();
        }}
        preselectedContactId={contact.id}
      />
    </div>
  );
}
