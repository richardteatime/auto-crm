import { cn } from "@/lib/utils";

export function Bone({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

export function PageSkeleton({ variant = "cards" }: { variant?: "dashboard" | "cards" | "board" | "table" | "detail" }) {
  return (
    <div role="status" aria-label="Caricamento" className="space-y-5">
      {variant === "dashboard" ? (
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <Bone className="h-3 w-40" />
          <Bone className="mt-3 h-8 w-72" />
          <Bone className="mt-3 h-4 w-96 max-w-full" />
          <div className="mt-5 flex gap-2">
            <Bone className="h-6 w-36 rounded-full" />
            <Bone className="h-6 w-32 rounded-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Bone className="h-8 w-48" />
          <Bone className="h-4 w-80 max-w-full" />
        </div>
      )}

      {(variant === "dashboard" || variant === "cards") && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-card">
              <Bone className="h-3.5 w-28" />
              <Bone className="mt-4 h-7 w-32" />
              <Bone className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      )}

      {variant === "dashboard" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-card lg:col-span-2">
            <Bone className="h-4 w-32" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="mt-4 flex items-center gap-3">
                <Bone className="size-7 rounded-lg" />
                <Bone className="h-4 flex-1" />
                <Bone className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <Bone className="h-4 w-24" />
            {Array.from({ length: 3 }, (_, i) => (
              <Bone key={i} className="mt-4 h-10 w-full" />
            ))}
          </div>
        </div>
      )}

      {variant === "board" && (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="w-[288px] shrink-0 rounded-xl border bg-muted/40 p-3">
              <Bone className="h-4 w-28" />
              <Bone className="mt-2 h-3 w-20" />
              {Array.from({ length: 3 - (i % 2) }, (_, j) => (
                <div key={j} className="mt-3 rounded-lg border bg-card p-3">
                  <Bone className="h-4 w-full" />
                  <Bone className="mt-2 h-3 w-24" />
                  <Bone className="mt-4 h-4 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {variant === "table" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
              <Bone className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-4 w-48" />
                <Bone className="h-3 w-32" />
              </div>
              <Bone className="hidden h-5 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
      )}

      {variant === "detail" && (
        <>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="flex items-center gap-4">
              <Bone className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-7 w-64" />
                <Bone className="h-4 w-48" />
              </div>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-card lg:col-span-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Bone key={i} className="mt-3 h-12 w-full first:mt-0" />
              ))}
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <Bone className="h-24 w-full" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
