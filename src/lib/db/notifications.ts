import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";

export type NotificationType = "activity_assigned" | "project_assigned";
export type NotificationRelatedType = "activity" | "project";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedId: string | null;
  relatedType: NotificationRelatedType | null;
  fromUserId: string | null;
  fromUserName: string | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function fromDoc(doc: Models.Document): AppNotification {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: new Date($createdAt),
    updatedAt: new Date($updatedAt),
    ...rest,
  } as AppNotification;
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.notifications, [
    Query.equal("userId", userId),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  return res.documents.map(fromDoc);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.notifications, [
    Query.equal("userId", userId),
    Query.equal("read", false),
    Query.limit(200),
  ]);
  return res.total;
}

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedId?: string | null;
  relatedType?: NotificationRelatedType | null;
  fromUserId?: string | null;
  fromUserName?: string | null;
}): Promise<AppNotification> {
  const doc = await databases.createDocument(
    DB_ID,
    COLLECTIONS.notifications,
    ID.unique(),
    {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      relatedId: data.relatedId ?? null,
      relatedType: data.relatedType ?? null,
      fromUserId: data.fromUserId ?? null,
      fromUserName: data.fromUserName ?? null,
      read: false,
    },
  );
  return fromDoc(doc);
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const doc = await databases.updateDocument(
    DB_ID,
    COLLECTIONS.notifications,
    id,
    { read: true },
  );
  return fromDoc(doc);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.notifications, [
    Query.equal("userId", userId),
    Query.equal("read", false),
    Query.limit(200),
  ]);
  await Promise.all(
    res.documents.map((doc) =>
      databases.updateDocument(DB_ID, COLLECTIONS.notifications, doc.$id, {
        read: true,
      }),
    ),
  );
}

export async function deleteNotification(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, COLLECTIONS.notifications, id);
}
