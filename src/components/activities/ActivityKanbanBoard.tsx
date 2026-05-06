"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, Users, FileText, Clock, CheckCircle2, GripVertical,
} from "lucide-react";
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_STATUS_STYLE } from "@/lib/constants";
import type { ActivityType } from "@/types";
import { formatDate } from "@/lib/constants";
import { toMs } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  contactName: string | null;
  contactId: string;
  dealId?: string | null;
  scheduledAt: Date | number | string | null;
  startAt?: Date | number | string | null;
  endAt?: Date | number | string | null;
  completedAt: Date | number | string | null;
  notes?: string | null;
  attachments?: string | null;
  isCompleted?: boolean;
  assignedTo?: string | null;
}

interface KanbanProps {
  activities: ActivityItem[];
  users: Record<string, string>;
  onUpdate: (id: string, data: Partial<ActivityItem>) => void;
  onEdit: (activity: ActivityItem) => void;
}

const typeIcons: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: Users, note: FileText, follow_up: Clock,
};

function getColumnId(activity: ActivityItem): string {
  if (activity.isCompleted) return "done";
  if (!activity.scheduledAt) return "todo";
  const ms = typeof activity.scheduledAt === "number"
    ? (activity.scheduledAt < 1e12 ? activity.scheduledAt * 1000 : activity.scheduledAt)
    : new Date(activity.scheduledAt).getTime();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = todayStart + 86400000;
  if (ms >= todayStart && ms < todayEnd) return "in-progress";
  if (ms < todayStart) return "done";
  return "todo";
}

function SortableCard({
  activity,
  users,
  onEdit,
}: {
  activity: ActivityItem;
  users: Record<string, string>;
  onEdit: (activity: ActivityItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = typeIcons[activity.type] || FileText;
  const config = ACTIVITY_TYPE_CONFIG[activity.type as ActivityType];

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="cursor-pointer hover:shadow-sm transition-shadow">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div {...listeners} className="mt-0.5 text-muted-foreground cursor-grab">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {config?.label || activity.type}
                </Badge>
              </div>
              <p className="text-sm font-medium mt-1 truncate">{activity.description}</p>
              <p className="text-xs text-muted-foreground">{activity.contactName}</p>
              {activity.scheduledAt && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(toMs(activity.scheduledAt) || null)}
                </p>
              )}
              {activity.assignedTo && users[activity.assignedTo] && (
                <p className="text-xs text-primary mt-1">
                  Assegnato a: {users[activity.assignedTo]}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs cursor-pointer"
            onClick={() => onEdit(activity)}
          >
            Modifica
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ActivityKanbanBoard({ activities, users, onUpdate, onEdit }: KanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [items, setItems] = useState<ActivityItem[]>(activities);

  useMemo(() => setItems(activities), [activities]);

  const columns = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {
      todo: [],
      "in-progress": [],
      done: [],
    };
    for (const a of items) {
      const col = getColumnId(a);
      groups[col] = groups[col] || [];
      groups[col].push(a);
    }
    return groups;
  }, [items]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeItem = items.find((i) => i.id === activeId);
    if (!activeItem) return;

    // Determine target column from over item
    const overItem = items.find((i) => i.id === overId);
    let targetCol = overItem ? getColumnId(overItem) : null;

    if (!targetCol) {
      // Check if dropped over a column area
      const colId = overId;
      if (["todo", "in-progress", "done"].includes(colId)) {
        targetCol = colId;
      }
    }

    if (!targetCol) return;

    const currentCol = getColumnId(activeItem);
    if (currentCol === targetCol) {
      // Reorder within same column
      const colItems = columns[currentCol];
      const oldIndex = colItems.findIndex((i) => i.id === activeId);
      const newIndex = colItems.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newColItems = arrayMove(colItems, oldIndex, newIndex);
        const newItems = items.map((i) =>
          newColItems.find((c) => c.id === i.id) || i
        );
        setItems(newItems);
      }
      return;
    }

    // Move to different column
    let updates: Partial<ActivityItem> = {};
    if (targetCol === "done") {
      updates = { isCompleted: true, completedAt: new Date().toISOString() };
    } else if (targetCol === "todo") {
      updates = { isCompleted: false, completedAt: null };
    } else if (targetCol === "in-progress") {
      updates = { isCompleted: false, completedAt: null };
    }

    onUpdate(activeId, updates);
    setItems((prev) =>
      prev.map((i) => (i.id === activeId ? { ...i, ...updates } : i))
    );
  };

  const colConfig = [
    { id: "todo", label: "Da fare", color: "border-t-4 border-slate-400", bg: "bg-slate-50/50" },
    { id: "in-progress", label: "In corso", color: "border-t-4 border-blue-500", bg: "bg-blue-50/50" },
    { id: "done", label: "Fatto", color: "border-t-4 border-green-500", bg: "bg-green-50/50" },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {colConfig.map((col) => (
          <div
            key={col.id}
            id={col.id}
            className={cn("rounded-lg border p-3 space-y-3", col.color, col.bg)}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <span className="text-xs text-muted-foreground">
                {columns[col.id]?.length || 0}
              </span>
            </div>
            <SortableContext
              items={columns[col.id]?.map((i) => i.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 min-h-[120px]">
                {columns[col.id]?.map((activity) => (
                  <SortableCard
                    key={activity.id}
                    activity={activity}
                    users={users}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
