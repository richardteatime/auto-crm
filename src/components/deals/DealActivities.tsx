"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityForm, type ActivityInitialData } from "@/components/activities/ActivityForm";
import {
  Plus,
  Phone,
  Mail,
  Users,
  FileText,
  Clock,
  Paperclip,
  CalendarDays,
  Pencil,
} from "lucide-react";
import { formatRelativeDate, formatDate, getActivityStatus, ACTIVITY_STATUS_STYLE } from "@/lib/constants";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/constants";
import { toast } from "sonner";
import type { ActivityType } from "@/types";

const activityIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  follow_up: Clock,
};

interface Activity {
  id: string;
  type: string;
  description: string;
  contactId: string;
  startAt?: number | Date | null;
  endAt?: number | Date | null;
  notes?: string | null;
  attachments?: string | null;
  scheduledAt: number | Date | null;
  completedAt: number | Date | null;
  createdAt: number | Date;
}

interface DealActivitiesProps {
  dealId: string;
  contactId: string;
  activities: Activity[];
}

export function DealActivities({ dealId, contactId, activities }: DealActivitiesProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityInitialData | undefined>(undefined);

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Attività completata");
      router.refresh();
    } catch {
      toast.error("Errore durante il completamento");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Attività ({activities.length})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1" />
            Registra
          </Button>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna attività registrata per questa trattativa.
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
                        {formatRelativeDate(activity.createdAt as number | Date)}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingActivity({
                        id: activity.id,
                        type: activity.type,
                        description: activity.description,
                        contactId: activity.contactId || contactId,
                        dealId: dealId,
                        startAt: activity.startAt ? String(activity.startAt) : null,
                        endAt: activity.endAt ? String(activity.endAt) : null,
                        notes: activity.notes ?? null,
                        attachments: activity.attachments ?? null,
                      })}
                      className="shrink-0 cursor-pointer p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Modifica attività"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityForm
        open={showForm || !!editingActivity}
        onClose={() => {
          setShowForm(false);
          setEditingActivity(undefined);
          router.refresh();
        }}
        preselectedContactId={contactId}
        preselectedDealId={dealId}
        initialData={editingActivity}
      />
    </>
  );
}
