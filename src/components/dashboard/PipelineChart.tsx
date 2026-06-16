"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/constants";

interface StageData {
  name: string;
  count: number;
  value: number;
  color: string;
}

interface PipelineChartProps {
  data: StageData[];
}

export function PipelineChart({ data }: PipelineChartProps) {
  const [mode, setMode] = useState<"count" | "value">("value");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Pipeline di Vendita</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "value" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs cursor-pointer"
            onClick={() => setMode("value")}
          >
            Valore
          </Button>
          <Button
            variant={mode === "count" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs cursor-pointer"
            onClick={() => setMode("count")}
          >
            Quantità
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessuna trattativa nel pipeline
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                height={50}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  mode === "value" ? `€${Number(v).toLocaleString("it")}` : v
                }
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(value) => [
                  mode === "value"
                    ? formatCurrency(Number(value))
                    : `${value} trattative`,
                  mode === "value" ? "Valore" : "Quantità",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                }}
              />
              <Bar dataKey={mode} radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
