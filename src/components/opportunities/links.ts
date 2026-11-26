/** What /api/opportunities adds to each opportunity: the deal it became and that deal's quotes */
export interface OppLinks {
  deal?: { id: string; title: string; stageName: string | null } | null;
  quotes?: Array<{ id: string; number: string; status: string }>;
}
