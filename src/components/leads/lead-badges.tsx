import { Badge } from "@/components/ui/badge";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  OUTCOME_LABELS,
  type LeadPipelineStage,
  type LeadCategory,
  type LeadStatus,
  type CallOutcome,
} from "@/lib/leads/types";

export function StageBadge({ stage }: { stage: LeadPipelineStage }) {
  const color = STAGE_COLORS[stage] ?? "#6b7280";
  return (
    <Badge variant="outline" style={{ color, borderColor: color }}>
      {STAGE_LABELS[stage] ?? stage}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: LeadCategory }) {
  return (
    <Badge variant="secondary">{CATEGORY_LABELS[category] ?? category}</Badge>
  );
}

const SCORE_BANDS = [
  { min: 70, label: "Caldo", color: "#16a34a", bg: "#dcfce7" },
  { min: 40, label: "Medio", color: "#d97706", bg: "#fef3c7" },
  { min: 0, label: "Debole", color: "#6b7280", bg: "#f3f4f6" },
];

export function ScoreBadge({ score }: { score: number }) {
  const band = SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[2];
  return (
    <Badge
      variant="outline"
      style={{ color: band.color, backgroundColor: band.bg, borderColor: band.color }}
    >
      {score}/100 · {band.label}
    </Badge>
  );
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#6b7280",
  to_call: "#d97706",
  working: "#2563eb",
  qualified: "#16a34a",
  lost: "#dc2626",
  won: "#16a34a",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <Badge variant="outline" style={{ color, borderColor: color }}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  return <Badge variant="outline">{OUTCOME_LABELS[outcome] ?? outcome}</Badge>;
}
