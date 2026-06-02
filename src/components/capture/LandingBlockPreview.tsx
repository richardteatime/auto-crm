"use client";

// Client-side WYSIWYG mirror of LandingBlockRenderer, used inside the editor
// canvas. It is intentionally non-interactive (the form block renders static
// placeholder fields) so the canvas is safe to click for selection. The
// canonical, interactive render lives in LandingBlockRenderer (server, /l/[slug]).

import { Check, Star, X } from "lucide-react";
import { assertNever, type LandingBlock } from "@/lib/capture/types";

export function LandingBlockPreview({
  block,
  primaryColor,
}: {
  block: LandingBlock;
  primaryColor: string;
}) {
  switch (block.type) {
    case "hero":
      return (
        <section
          style={{ background: block.backgroundColor, color: block.textColor }}
          className="px-8 py-14"
        >
          <div
            className={
              block.align === "center"
                ? "flex flex-col items-center text-center gap-3"
                : "flex flex-col items-start text-left gap-3"
            }
          >
            <h1 className="text-3xl font-bold tracking-tight max-w-2xl">{block.heading}</h1>
            <p className="text-base opacity-90 max-w-xl">{block.subheading}</p>
            {block.buttonText && (
              <span
                className="inline-block rounded-md px-5 py-2.5 text-sm font-semibold"
                style={{ background: block.textColor, color: block.backgroundColor }}
              >
                {block.buttonText}
              </span>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section className="px-8 py-12">
          {block.heading && <h2 className="text-2xl font-bold text-center mb-8">{block.heading}</h2>}
          <div className="grid gap-6 grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3">
            {block.items.map((item, i) => (
              <div key={i} className="space-y-2">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ background: primaryColor }}
                >
                  {item.title.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case "testimonials":
      return (
        <section className="px-8 py-12 bg-gray-50">
          {block.heading && <h2 className="text-2xl font-bold text-center mb-8">{block.heading}</h2>}
          <div className="grid gap-4 grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3">
            {block.items.map((item, i) => (
              <figure key={i} className="rounded-xl border bg-white p-5 space-y-2">
                <blockquote className="text-sm text-gray-700">&ldquo;{item.quote}&rdquo;</blockquote>
                <figcaption className="text-sm font-semibold">
                  {item.author}
                  {item.role && <span className="block text-xs font-normal text-gray-500">{item.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      );

    case "cta":
      return (
        <section
          style={{ background: block.backgroundColor, color: block.textColor }}
          className="px-8 py-12"
        >
          <div className="flex flex-col items-center text-center gap-3">
            <h2 className="text-2xl font-bold">{block.heading}</h2>
            {block.subheading && <p className="text-base opacity-90 max-w-xl">{block.subheading}</p>}
            {block.buttonText && (
              <span
                className="inline-block rounded-md px-5 py-2.5 text-sm font-semibold"
                style={{ background: block.textColor, color: block.backgroundColor }}
              >
                {block.buttonText}
              </span>
            )}
          </div>
        </section>
      );

    case "form":
      return (
        <section className="px-8 py-12">
          {block.heading && <h2 className="text-xl font-bold text-center mb-5">{block.heading}</h2>}
          <div className="mx-auto max-w-sm space-y-3 rounded-xl border bg-white p-5 shadow-sm">
            {["Nome", "Email", "Telefono"].map((label) => (
              <div key={label} className="space-y-1">
                <span className="block text-xs font-medium text-gray-500">{label}</span>
                <div className="h-9 rounded-md border border-gray-200 bg-gray-50" />
              </div>
            ))}
            <div
              className="mt-1 h-10 rounded-md text-white text-sm font-semibold flex items-center justify-center"
              style={{ background: primaryColor }}
            >
              Invia
            </div>
          </div>
        </section>
      );

    case "image":
      return (
        <section className="px-8 py-6">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.url}
              alt={block.alt}
              className="mx-auto rounded-lg"
              style={{ maxWidth: block.maxWidth, width: "100%" }}
            />
          ) : (
            <div className="mx-auto flex h-40 max-w-md items-center justify-center rounded-lg border border-dashed bg-gray-50 text-sm text-gray-400">
              Immagine non impostata
            </div>
          )}
        </section>
      );

    case "text":
      return (
        <section className="px-8 py-6">
          <p
            className="text-sm text-gray-700 whitespace-pre-line"
            style={{ textAlign: block.align }}
          >
            {block.content}
          </p>
        </section>
      );

    case "divider":
      return (
        <div className="px-8 py-4">
          <hr className="border-gray-200" />
        </div>
      );

    case "footer":
      return (
        <footer className="px-8 py-8 border-t">
          <p className="text-center text-xs text-gray-500">{block.text}</p>
        </footer>
      );

    case "logos":
      return (
        <section className="px-8 py-9">
          {block.heading && <h2 className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{block.heading}</h2>}
          <div className="flex flex-wrap items-center justify-center gap-7">
            {block.items.map((item, i) => (
              item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={item.imageUrl} alt={item.name} className="h-6 max-w-28 object-contain grayscale opacity-55" />
              ) : (
                <span key={i} className="font-serif text-xl font-bold text-gray-500 opacity-65">{item.name}</span>
              )
            ))}
          </div>
        </section>
      );

    case "faq":
      return (
        <section className="bg-gray-50 px-8 py-12">
          {block.heading && <h2 className="mb-6 text-center text-2xl font-bold">{block.heading}</h2>}
          <div className="mx-auto max-w-2xl space-y-2">
            {block.items.map((item, i) => (
              <div key={i} className="rounded-lg border bg-white px-4 py-3 text-sm font-semibold">
                {item.question}
              </div>
            ))}
          </div>
        </section>
      );

    case "reviews":
      return (
        <section className="px-8 py-12">
          {block.heading && <h2 className="text-center text-2xl font-bold">{block.heading}</h2>}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-600">
            <span className="inline-flex gap-0.5 text-amber-400">
              {[0, 1, 2, 3, 4].map((index) => <Star key={index} className="h-4 w-4" fill={index < Math.round(block.averageRating) ? "currentColor" : "none"} />)}
            </span>
            <strong className="text-sm text-gray-900">{block.averageRating.toFixed(1)}</strong>
            <span>{block.ratingCountLabel}</span>
          </div>
          <div className="mt-6 grid gap-3 grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3">
            {block.items.map((item, i) => (
              <figure key={i} className="rounded-lg border bg-white p-4">
                <span className="inline-flex gap-0.5 text-amber-400">
                  {[0, 1, 2, 3, 4].map((index) => <Star key={index} className="h-3.5 w-3.5" fill={index < item.rating ? "currentColor" : "none"} />)}
                </span>
                <blockquote className="mt-3 text-xs text-gray-700">&ldquo;{item.quote}&rdquo;</blockquote>
                <figcaption className="mt-3 text-xs font-semibold">{item.author}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      );

    case "offer":
      return (
        <section className="px-8 py-12">
          <div className="mx-auto max-w-xl rounded-xl px-7 py-8 shadow-lg" style={{ background: block.backgroundColor, color: block.textColor }}>
            {block.badgeText && <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase">{block.badgeText}</span>}
            <h2 className="mt-3 text-2xl font-bold">{block.heading}</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <strong className="text-2xl">{block.priceLabel}</strong>
              {block.comparePriceLabel && <span className="text-sm opacity-60 line-through">{block.comparePriceLabel}</span>}
            </div>
            <ul className="mt-4 space-y-2 text-xs">
              {block.includes.map((item, i) => <li key={i} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0" />{item}</li>)}
            </ul>
            {block.buttonText && <span className="mt-5 inline-block rounded-md bg-white px-4 py-2 text-xs font-bold text-gray-900">{block.buttonText}</span>}
          </div>
        </section>
      );

    case "comparison":
      return (
        <section className="px-8 py-12">
          {block.heading && <h2 className="mb-6 text-center text-2xl font-bold">{block.heading}</h2>}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-xs">
              <thead><tr><th className="bg-gray-50 px-3 py-3 text-left">Confronto</th>{block.columns.map((column, index) => <th key={index} className="px-3 py-3 text-center" style={index === block.highlightColumn ? { backgroundColor: primaryColor, color: "#fff" } : undefined}>{column}</th>)}</tr></thead>
              <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t"><th className="bg-gray-50 px-3 py-3 text-left">{row.label}</th>{block.columns.map((_, columnIndex) => {
                const value = row.values[columnIndex] ?? "";
                return <td key={columnIndex} className="px-3 py-3 text-center" style={columnIndex === block.highlightColumn ? { backgroundColor: `${primaryColor}12` } : undefined}>{value === true ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : value === false ? <X className="mx-auto h-4 w-4 text-red-500" /> : value}</td>;
              })}</tr>)}</tbody>
            </table>
          </div>
        </section>
      );

    default:
      return assertNever(block);
  }
}
