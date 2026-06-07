// Server component. Renders a typed LandingConfig to React. Shared by the
// admin editor preview and the public SSR route (/l/[slug]), so the preview is
// always faithful to what visitors see. No "use client" — it only embeds the
// PublicLeadForm island where a form block needs interactivity.

import Image from "next/image";
import { PublicLeadForm } from "@/components/capture/PublicLeadForm";
import { LandingEmbeddedForm } from "@/components/capture/LandingEmbeddedForm";
import { Check, Star, X } from "lucide-react";
import type {
  LandingBlock,
  LandingConfig,
  HeroBlock,
  FeaturesBlock,
  TestimonialsBlock,
  CtaBlock,
  FormBlock,
  ImageBlock,
  TextBlock,
  FooterBlock,
  LogosBlock,
  FaqBlock,
  ReviewsBlock,
  OfferBlock,
  ComparisonBlock,
} from "@/lib/capture/types";
import { assertNever } from "@/lib/capture/types";

export function parseLandingConfig(raw: string): LandingConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<LandingConfig>;
    return {
      blocks: Array.isArray(parsed.blocks) ? (parsed.blocks as LandingBlock[]) : [],
      theme: {
        primaryColor: parsed.theme?.primaryColor ?? "#2563eb",
        fontFamily: parsed.theme?.fontFamily ?? "Inter, system-ui, sans-serif",
        maxWidth: parsed.theme?.maxWidth ?? 1120,
      },
    };
  } catch {
    return {
      blocks: [],
      theme: { primaryColor: "#2563eb", fontFamily: "Inter, system-ui, sans-serif", maxWidth: 1120 },
    };
  }
}

interface RenderProps {
  config: LandingConfig;
  landingPageId: string;
  funnelId?: string | null;
  sessionId?: string | null;
  funnelSlug?: string | null;
  funnelStepId?: string | null;
}

export function LandingBlockRenderer({
  config,
  landingPageId,
  funnelId = null,
  sessionId = null,
  funnelSlug = null,
  funnelStepId = null,
}: RenderProps) {
  const { theme } = config;
  const firstFormBlockId = config.blocks.find((block) => block.type === "form")?.id;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#0f172a" }}>
      {config.blocks.map((block) => (
        <BlockSwitch
          key={block.id}
          block={block}
          formAnchorId={block.id === firstFormBlockId ? "form" : undefined}
          primaryColor={theme.primaryColor}
          maxWidth={theme.maxWidth}
          landingPageId={landingPageId}
          funnelId={funnelId}
          sessionId={sessionId}
          funnelSlug={funnelSlug}
          funnelStepId={funnelStepId}
        />
      ))}
    </div>
  );
}

function Container({
  maxWidth,
  children,
  className = "",
}: {
  maxWidth: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto px-6 ${className}`} style={{ maxWidth }}>
      {children}
    </div>
  );
}

function BlockSwitch({
  block,
  formAnchorId,
  primaryColor,
  maxWidth,
  landingPageId,
  funnelId,
  sessionId,
  funnelSlug,
  funnelStepId,
}: {
  block: LandingBlock;
  formAnchorId?: string;
  primaryColor: string;
  maxWidth: number;
  landingPageId: string;
  funnelId: string | null;
  sessionId: string | null;
  funnelSlug: string | null;
  funnelStepId: string | null;
}) {
  switch (block.type) {
    case "hero":
      return <Hero block={block} maxWidth={maxWidth} />;
    case "features":
      return <Features block={block} maxWidth={maxWidth} primaryColor={primaryColor} />;
    case "testimonials":
      return <Testimonials block={block} maxWidth={maxWidth} />;
    case "cta":
      return <Cta block={block} maxWidth={maxWidth} />;
    case "form":
      return (
        <FormSection
          block={block}
          anchorId={formAnchorId}
          maxWidth={maxWidth}
          primaryColor={primaryColor}
          landingPageId={landingPageId}
          funnelId={funnelId}
          sessionId={sessionId}
          submitUrl={
            funnelSlug && funnelStepId
              ? `/api/public/funnel/${encodeURIComponent(funnelSlug)}/step/${encodeURIComponent(funnelStepId)}/submit`
              : undefined
          }
        />
      );
    case "image":
      return <ImageSection block={block} maxWidth={maxWidth} />;
    case "text":
      return <TextSection block={block} maxWidth={maxWidth} />;
    case "divider":
      return (
        <Container maxWidth={maxWidth} className="py-6">
          <hr className="border-gray-200" />
        </Container>
      );
    case "footer":
      return <Footer block={block} maxWidth={maxWidth} />;
    case "logos":
      return <Logos block={block} maxWidth={maxWidth} />;
    case "faq":
      return <Faq block={block} maxWidth={maxWidth} />;
    case "reviews":
      return <Reviews block={block} maxWidth={maxWidth} />;
    case "offer":
      return <Offer block={block} maxWidth={maxWidth} />;
    case "comparison":
      return <Comparison block={block} maxWidth={maxWidth} primaryColor={primaryColor} />;
    default:
      return assertNever(block);
  }
}

function Hero({ block, maxWidth }: { block: HeroBlock; maxWidth: number }) {
  const alignClass = block.align === "center" ? "text-center items-center" : "text-left items-start";
  return (
    <section style={{ background: block.backgroundColor, color: block.textColor }} className="py-20">
      <Container maxWidth={maxWidth}>
        <div className={`flex flex-col gap-5 ${alignClass}`}>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">{block.heading}</h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl">{block.subheading}</p>
          {block.buttonText && (
            <a
              href={block.buttonUrl || "#"}
              data-sx-cta
              className="inline-block rounded-md px-6 py-3 text-base font-semibold"
              style={{ background: block.textColor, color: block.backgroundColor }}
            >
              {block.buttonText}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}

function Features({
  block,
  maxWidth,
  primaryColor,
}: {
  block: FeaturesBlock;
  maxWidth: number;
  primaryColor: string;
}) {
  return (
    <section className="py-16">
      <Container maxWidth={maxWidth}>
        {block.heading && (
          <h2 className="text-3xl font-bold text-center mb-10">{block.heading}</h2>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, i) => (
            <div key={i} className="space-y-2">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: primaryColor }}
              >
                {item.title.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Testimonials({ block, maxWidth }: { block: TestimonialsBlock; maxWidth: number }) {
  return (
    <section className="py-16 bg-gray-50">
      <Container maxWidth={maxWidth}>
        {block.heading && (
          <h2 className="text-3xl font-bold text-center mb-10">{block.heading}</h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, i) => (
            <figure key={i} className="rounded-xl border bg-white p-6 space-y-3">
              <blockquote className="text-sm text-gray-700">“{item.quote}”</blockquote>
              <figcaption className="text-sm font-semibold">
                {item.author}
                {item.role && <span className="block text-xs font-normal text-gray-500">{item.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Logos({ block, maxWidth }: { block: LogosBlock; maxWidth: number }) {
  return (
    <section className="py-12">
      <Container maxWidth={maxWidth}>
        {block.heading && (
          <h2 className="mb-7 text-center text-sm font-semibold uppercase tracking-[0.25em] text-gray-500">
            {block.heading}
          </h2>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {block.items.map((item, i) => (
            item.imageUrl ? (
              <Image
                key={i}
                src={item.imageUrl}
                alt={item.name}
                width={144}
                height={32}
                className="h-8 max-w-36 object-contain grayscale opacity-55"
                unoptimized
              />
            ) : (
              <span key={i} className="font-serif text-2xl font-bold tracking-wide text-gray-500 opacity-65">
                {item.name}
              </span>
            )
          ))}
        </div>
      </Container>
    </section>
  );
}

function Faq({ block, maxWidth }: { block: FaqBlock; maxWidth: number }) {
  return (
    <section className="bg-gray-50 py-16">
      <Container maxWidth={Math.min(maxWidth, 860)}>
        {block.heading && <h2 className="mb-10 text-center text-3xl font-bold">{block.heading}</h2>}
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <details key={i} className="group rounded-xl border bg-white p-5">
              <summary className="cursor-pointer list-none pr-6 text-base font-semibold marker:hidden">
                {item.question}
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  const normalized = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex gap-0.5 text-amber-400" aria-label={`${rating} stelle su 5`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Star key={index} size={size} fill={index < normalized ? "currentColor" : "none"} aria-hidden />
      ))}
    </span>
  );
}

function Reviews({ block, maxWidth }: { block: ReviewsBlock; maxWidth: number }) {
  return (
    <section className="py-16">
      <Container maxWidth={maxWidth}>
        {block.heading && <h2 className="text-center text-3xl font-bold">{block.heading}</h2>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600">
          <Stars rating={block.averageRating} size={20} />
          <strong className="text-base text-gray-900">{block.averageRating.toFixed(1)}</strong>
          {block.ratingCountLabel && <span>{block.ratingCountLabel}</span>}
        </div>
        <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, i) => (
            <figure key={i} className="rounded-xl border bg-white p-6 shadow-sm">
              <Stars rating={item.rating} size={16} />
              <blockquote className="mt-4 text-sm leading-6 text-gray-700">&ldquo;{item.quote}&rdquo;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 text-sm font-semibold">
                {item.avatarUrl ? (
                  <Image src={item.avatarUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600">
                    {item.author.charAt(0).toUpperCase()}
                  </span>
                )}
                {item.author}
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Offer({ block, maxWidth }: { block: OfferBlock; maxWidth: number }) {
  return (
    <section className="py-16">
      <Container maxWidth={Math.min(maxWidth, 720)}>
        <div
          className="relative overflow-hidden rounded-2xl px-7 py-9 shadow-xl sm:px-10"
          style={{ background: block.backgroundColor, color: block.textColor }}
        >
          {block.badgeText && (
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              {block.badgeText}
            </span>
          )}
          <h2 className="mt-4 text-3xl font-bold">{block.heading}</h2>
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold">{block.priceLabel}</span>
            {block.comparePriceLabel && <span className="text-base opacity-65 line-through">{block.comparePriceLabel}</span>}
          </div>
          <ul className="mt-6 space-y-3">
            {block.includes.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {block.buttonText && (
            <a
              href={block.buttonUrl || "#form"}
              data-sx-cta
              className="mt-8 inline-block rounded-md bg-white px-6 py-3 text-base font-bold text-gray-900"
            >
              {block.buttonText}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}

function ComparisonValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-emerald-600" aria-label="Sì" />;
  if (value === false) return <X className="mx-auto h-5 w-5 text-red-500" aria-label="No" />;
  return <span>{value}</span>;
}

function Comparison({
  block,
  maxWidth,
  primaryColor,
}: {
  block: ComparisonBlock;
  maxWidth: number;
  primaryColor: string;
}) {
  return (
    <section className="py-16">
      <Container maxWidth={maxWidth}>
        {block.heading && <h2 className="mb-10 text-center text-3xl font-bold">{block.heading}</h2>}
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="border-b bg-gray-50 px-4 py-4 font-semibold">Confronto</th>
                {block.columns.map((column, index) => (
                  <th
                    key={index}
                    className="border-b px-4 py-4 text-center font-semibold"
                    style={index === block.highlightColumn ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-b-0">
                  <th className="bg-gray-50 px-4 py-4 font-medium">{row.label}</th>
                  {block.columns.map((_, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="px-4 py-4 text-center text-gray-700"
                      style={columnIndex === block.highlightColumn ? { backgroundColor: `${primaryColor}12` } : undefined}
                    >
                      <ComparisonValue value={row.values[columnIndex] ?? ""} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}

function Cta({ block, maxWidth }: { block: CtaBlock; maxWidth: number }) {
  return (
    <section style={{ background: block.backgroundColor, color: block.textColor }} className="py-16">
      <Container maxWidth={maxWidth}>
        <div className="flex flex-col items-center text-center gap-4">
          <h2 className="text-3xl font-bold">{block.heading}</h2>
          {block.subheading && <p className="text-lg opacity-90 max-w-2xl">{block.subheading}</p>}
          {block.buttonText && (
            <a
              href={block.buttonUrl || "#"}
              data-sx-cta
              className="inline-block rounded-md px-6 py-3 text-base font-semibold"
              style={{ background: block.textColor, color: block.backgroundColor }}
            >
              {block.buttonText}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}

function FormSection({
  block,
  anchorId,
  maxWidth,
  primaryColor,
  landingPageId,
  funnelId,
  sessionId,
  submitUrl,
}: {
  block: FormBlock;
  anchorId?: string;
  maxWidth: number;
  primaryColor: string;
  landingPageId: string;
  funnelId: string | null;
  sessionId: string | null;
  submitUrl?: string;
}) {
  return (
    <section id={anchorId} className="py-16">
      <Container maxWidth={Math.min(maxWidth, 560)}>
        {block.heading && (
          <h2 className="text-2xl font-bold text-center mb-6">{block.heading}</h2>
        )}
        {block.formId ? (
          <LandingEmbeddedForm
            formId={block.formId}
            landingPageId={landingPageId}
            funnelId={funnelId}
            sessionId={sessionId}
            submitUrl={submitUrl}
            primaryColor={primaryColor}
          />
        ) : (
          <PublicLeadForm
            landingPageId={landingPageId}
            funnelId={funnelId}
            sessionId={sessionId}
            source={funnelId ? "funnel" : "landing"}
            primaryColor={primaryColor}
            buttonText="Invia"
            submitUrl={submitUrl}
          />
        )}
      </Container>
    </section>
  );
}

function ImageSection({ block, maxWidth }: { block: ImageBlock; maxWidth: number }) {
  if (!block.url) return null;
  return (
    <section className="py-8">
      <Container maxWidth={maxWidth}>
        <Image
          src={block.url}
          alt={block.alt}
          width={800}
          height={450}
          className="mx-auto rounded-lg"
          style={{ maxWidth: block.maxWidth, width: "100%", height: "auto" }}
          unoptimized
        />
      </Container>
    </section>
  );
}

function TextSection({ block, maxWidth }: { block: TextBlock; maxWidth: number }) {
  return (
    <section className="py-8">
      <Container maxWidth={maxWidth}>
        <p className="text-base text-gray-700 whitespace-pre-line" style={{ textAlign: block.align }}>
          {block.content}
        </p>
      </Container>
    </section>
  );
}

function Footer({ block, maxWidth }: { block: FooterBlock; maxWidth: number }) {
  return (
    <footer className="py-10 border-t">
      <Container maxWidth={maxWidth}>
        <p className="text-center text-xs text-gray-500">{block.text}</p>
      </Container>
    </footer>
  );
}
