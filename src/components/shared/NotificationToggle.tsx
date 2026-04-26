"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

export function NotificationToggle() {
  const [mounted, setMounted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    if ("Notification" in window) {
      setSupported(true);
      setEnabled(localStorage.getItem("crm-notifications") === "true");
    }
  }, []);

  const toggle = async () => {

    if (!enabled) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        localStorage.setItem("crm-notifications", "true");
        setEnabled(true);
        toast.success("Notifiche attivate");

        // Show test notification
        new Notification("SarconX CRM", {
          body: "Le notifiche sono attive. Ti avviseremo dei follow-up in sospeso.",
        });
      } else {
        toast.error("Permesso notifiche negato");
      }
    } else {
      localStorage.setItem("crm-notifications", "false");
      setEnabled(false);
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
