"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

const NOTIFICATION_STORAGE_KEY = "crm-notifications";
const NOTIFICATION_STORAGE_EVENT = "crm-notifications-change";
const subscribeToMount = () => () => {};

function subscribeToNotificationPreference(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(NOTIFICATION_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(NOTIFICATION_STORAGE_EVENT, callback);
  };
}

function getNotificationPreference() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATION_STORAGE_KEY) === "true";
}

function setNotificationPreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new Event(NOTIFICATION_STORAGE_EVENT));
}

export function NotificationToggle() {
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const enabled = useSyncExternalStore(
    subscribeToNotificationPreference,
    getNotificationPreference,
    () => false,
  );
  const supported = mounted && "Notification" in window;

  const toggle = async () => {

    if (!enabled) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationPreference(true);
        toast.success("Notifiche attivate");

        // Show test notification
        new Notification("SarconX CRM", {
          body: "Le notifiche sono attive. Ti avviseremo dei follow-up in sospeso.",
        });
      } else {
        toast.error("Permesso notifiche negato");
      }
    } else {
      setNotificationPreference(false);
      toast.success("Notifiche disattivate");
    }
  };

  if (!mounted || !supported) return null;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            Notifiche del browser
          </p>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Riceverai avvisi per i follow-up scaduti"
              : "Attiva per ricevere avvisi sui follow-up"}
          </p>
        </div>
      </div>
      <Button
        variant={enabled ? "default" : "outline"}
        size="sm"
        onClick={toggle}
        className="cursor-pointer"
      >
        {enabled ? "Disattiva" : "Attiva"}
      </Button>
    </div>
  );
}
