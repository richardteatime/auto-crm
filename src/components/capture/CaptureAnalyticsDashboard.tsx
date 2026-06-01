"use client";

import { BarChart3, Eye, LayoutGrid, MousePointerClick } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface AssetRow {
  type: string;
  name: string;
  views: number;
  conversions: number;
}

export function CaptureAnalyticsDashboard({
  assets,
  daily,
  totals,
}: {
  assets: AssetRow[];
  daily: Array<{ day: string; views: number; conversions: number }>;
  totals: { assets: number; views: number; conversions: number };
}) {
  const rate = totals.views > 0 ? Math.round((totals.conversions / totals.views) * 100) : 0;
  const cards = [
    { label: "Asset pubblicabili", value: totals.assets, icon: LayoutGrid },
    { label: "Visite tracciate", value: totals.views, icon: Eye },
    { label: "Conversioni", value: totals.conversions, icon: MousePointerClick },
    { label: "Conversion rate", value: `${rate}%`, icon: BarChart3 },
  ];
  return <div className="space-y-6">
    <div><h1 className="text-lg font-semibold tracking-tight">Analytics Capture</h1><p className="text-xs text-muted-foreground">Visite, submission e prenotazioni generate dagli asset pubblici</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => <div key={card.label} className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{card.label}</p><card.icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-2 text-2xl font-semibold">{card.value}</p></div>)}
    </div>
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-4 text-sm font-semibold">Ultimi 14 giorni</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="views" name="Visite" fill="#2563eb" /><Bar dataKey="conversions" name="Conversioni" fill="#16a34a" /></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Performance asset</h2></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Visite</th><th className="px-4 py-3">Conversioni</th><th className="px-4 py-3">Tasso</th></tr></thead><tbody>{assets.map((asset, index) => <tr key={`${asset.type}-${asset.name}-${index}`} className="border-b last:border-0"><td className="px-4 py-3">{asset.type}</td><td className="px-4 py-3 font-medium">{asset.name}</td><td className="px-4 py-3">{asset.views}</td><td className="px-4 py-3">{asset.conversions}</td><td className="px-4 py-3">{asset.views > 0 ? Math.round((asset.conversions / asset.views) * 100) : 0}%</td></tr>)}</tbody></table></div>
    </div>
  </div>;
}
