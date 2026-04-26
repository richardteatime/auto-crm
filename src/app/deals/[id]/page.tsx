import { getDeal, getStages, listActivities } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Euro, Percent } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/constants";
import { DealEditButton } from "@/components/deals/DealEditButton";
import { DealActivities } from "@/components/deals/DealActivities";
import { QuoteList } from "@/components/quotes/QuoteList";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const deal = await getDeal(id);
  if (!deal) notFound();

  const [stages, dealActivities] = await Promise.all([
    getStages(),
    listActivities({ dealId: id }),
  ]);

  const stage = stages.find((s) => s.id === deal.stageId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/deals">
          <Button variant="ghost" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            {stage && (
              <Badge
                variant="outline"
                style={{ borderColor: stage.color, color: stage.color }}
              >
                {stage.name}
              </Badge>
            )}
          </div>
          {deal.contact && (
            <Link
              href={`/contacts/${deal.contact.id}`}
              className="text-muted-foreground hover:text-primary text-sm"
            >
              {deal.contact.name}
            </Link>
          )}
          {!deal.contact && deal.contactName && (
            <span className="text-muted-foreground text-sm">
              {deal.contactName}
            </span>
          )}
        </div>
        <DealEditButton
          deal={{
            id: deal.id,
            title: deal.title,
            value: deal.value,
            contactId: deal.contactId,
            stageId: deal.stageId,
            probability: deal.probability,
            expectedClose: deal.expectedClose
              ? (deal.expectedClose instanceof Date
                  ? deal.expectedClose.getTime()
                  : deal.expectedClose)
              : null,
            notes: deal.notes,
            attachments: deal.attachments,
            isRecurring: deal.isRecurring,
            recurringMonths: deal.recurringMonths,
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Euro className="h-4 w-4" />
              Valore
            </div>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(deal.value)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Percent className="h-4 w-4" />
              Probabilità
            </div>
            <p className="text-xl font-bold">{deal.probability}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Chiusura stimata
            </div>
            <p className="text-xl font-bold">
              {formatDate(deal.expectedClose)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Euro className="h-4 w-4" />
              Valore ponderato
            </div>
            <p className="text-xl font-bold">
              {formatCurrency(Math.round(deal.value * (deal.probability / 100)))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {deal.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{deal.notes}</p>
            </CardContent>
          </Card>
        )}

        <DealActivities
          dealId={deal.id}
          contactId={deal.contactId}
          activities={dealActivities}
        />
      </div>

      <QuoteList dealId={deal.id} />
    </div>
  );
}
