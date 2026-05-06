import type { ProjectStatus, ProjectPriority } from "@/types";

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  aperto:        { label: "Aperto",        color: "text-blue-600",   bg: "bg-blue-100",   border: "border-blue-300" },
  in_lavorazione:{ label: "In Lavorazione",color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-300" },
  bloccato:      { label: "Bloccato",      color: "text-red-600",    bg: "bg-red-100",    border: "border-red-300" },
  in_pausa:      { label: "In Pausa",      color: "text-gray-500",   bg: "bg-gray-100",   border: "border-gray-300" },
  revisione_cto: { label: "Revisione CTO", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-300" },
  consegnato:    { label: "Consegnato",    color: "text-green-600",  bg: "bg-green-100",  border: "border-green-300" },
};

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "aperto",
  "in_lavorazione",
  "bloccato",
  "in_pausa",
  "revisione_cto",
  "consegnato",
];

export const PROJECT_PRIORITY_CONFIG: Record<ProjectPriority, { label: string; color: string }> = {
  bassa: { label: "Bassa",  color: "text-gray-500" },
  media: { label: "Media",  color: "text-blue-500" },
  alta:  { label: "Alta",   color: "text-red-500"  },
};
