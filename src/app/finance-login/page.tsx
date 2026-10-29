"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/components/shared/CurrentUserContext";

export default function FinanceLoginPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/finance/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The email is prefilled with the signed-in user's, unless they typed another
        body: JSON.stringify({ email: email || user?.email || "", password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore di accesso");
      }
      toast.success("Accesso consentito");
      router.push("/finance");
      router.refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-5" />
          </span>
          <CardTitle className="text-xl font-bold tracking-tight">Area Finance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fatturato, spese e MRR sono riservati agli amministratori: conferma la tua password per entrare.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="finance-email">Email</Label>
              <Input
                id="finance-email"
                type="email"
                value={email || user?.email || ""}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="la tua email CRM"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finance-password">Password</Label>
              <Input
                id="finance-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="la tua password CRM"
                autoFocus
                required
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              className="w-full cursor-pointer h-11"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifica...
                </>
              ) : (
                "Accedi"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
