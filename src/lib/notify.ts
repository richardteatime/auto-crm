import { createNotification, type NotificationType } from "@/lib/db/notifications";

export async function notifyAssignment({
  assignedToUserId,
  fromUserId,
  fromUserName,
  type,
  title,
  body,
  relatedId,
}: {
  assignedToUserId: string;
  fromUserId: string;
  fromUserName: string;
  type: NotificationType;
  title: string;
  body?: string;
  relatedId: string;
}) {
  if (!assignedToUserId || assignedToUserId === fromUserId) return;

  const relatedType = type === "activity_assigned" ? "activity" : "project";

  try {
    await createNotification({
      userId: assignedToUserId,
      type,
      title,
      body: body ?? null,
      relatedId,
      relatedType,
      fromUserId,
      fromUserName,
    });
  } catch {
    // Notifications are non-critical — never fail the main request
  }
}
