// ---------------------------------------------------------------------------
// SarconX Capture & Conversion Platform (FASE 2) — core types
//
// Covers: Landing Pages, Forms, Booking, Funnels, Analytics.
// Every asset stores its layout/config as typed JSON; public routes render
// it server-side. No external page-builder dependency (GrapesJS) is used —
// see IMPLEMENTATION_LOG.md for the rationale.
// ---------------------------------------------------------------------------

export type AssetStatus = "draft" | "published" | "archived";

// ===========================================================================
// Landing Page blocks (custom block-based builder)
// ===========================================================================

export type BlockType =
  | "hero"
  | "features"
  | "testimonials"
  | "cta"
  | "form"
  | "image"
  | "text"
  | "divider"
  | "footer"
  | "logos"
  | "faq"
  | "reviews"
  | "offer"
  | "comparison";

export const BLOCK_TYPES: BlockType[] = [
  "hero",
  "features",
  "testimonials",
  "cta",
  "form",
  "image",
  "text",
  "divider",
  "footer",
  "logos",
  "faq",
  "reviews",
  "offer",
  "comparison",
];

export interface HeroBlock {
  id: string;
  type: "hero";
  heading: string;
  subheading: string;
  buttonText: string;
  buttonUrl: string;
  align: "left" | "center";
  backgroundColor: string;
  textColor: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  icon: string; // lucide icon name
}

export interface FeaturesBlock {
  id: string;
  type: "features";
  heading: string;
  items: FeatureItem[];
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
}

export interface TestimonialsBlock {
  id: string;
  type: "testimonials";
  heading: string;
  items: TestimonialItem[];
}

export interface CtaBlock {
  id: string;
  type: "cta";
  heading: string;
  subheading: string;
  buttonText: string;
  buttonUrl: string;
  backgroundColor: string;
  textColor: string;
}

export interface FormBlock {
  id: string;
  type: "form";
  formId: string | null;
  heading: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  url: string;
  alt: string;
  maxWidth: number; // px
}

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
  align: "left" | "center" | "right";
}

export interface DividerBlock {
  id: string;
  type: "divider";
}

export interface FooterBlock {
  id: string;
  type: "footer";
  text: string;
}

export interface LogoItem {
  name: string;
  imageUrl: string;
}

export interface LogosBlock {
  id: string;
  type: "logos";
  heading: string;
  items: LogoItem[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqBlock {
  id: string;
  type: "faq";
  heading: string;
  items: FaqItem[];
}

export interface ReviewItem {
  quote: string;
  author: string;
  rating: number;
  avatarUrl?: string;
}

export interface ReviewsBlock {
  id: string;
  type: "reviews";
  heading: string;
  averageRating: number;
  ratingCountLabel: string;
  items: ReviewItem[];
}

export interface OfferBlock {
  id: string;
  type: "offer";
  badgeText: string;
  heading: string;
  priceLabel: string;
  comparePriceLabel: string;
  includes: string[];
  buttonText: string;
  buttonUrl: string;
  backgroundColor: string;
  textColor: string;
}

export interface ComparisonRow {
  label: string;
  values: Array<boolean | string>;
}

export interface ComparisonBlock {
  id: string;
  type: "comparison";
  heading: string;
  columns: string[];
  highlightColumn: number;
  rows: ComparisonRow[];
}

export type LandingBlock =
  | HeroBlock
  | FeaturesBlock
  | TestimonialsBlock
  | CtaBlock
  | FormBlock
  | ImageBlock
  | TextBlock
  | DividerBlock
  | FooterBlock
  | LogosBlock
  | FaqBlock
  | ReviewsBlock
  | OfferBlock
  | ComparisonBlock;

export function assertNever(value: never): never {
  throw new Error(`Tipo blocco non gestito: ${JSON.stringify(value)}`);
}

export interface LandingConfig {
  blocks: LandingBlock[];
  theme: {
    primaryColor: string;
    fontFamily: string;
    maxWidth: number;
  };
}

export interface LandingPage {
  id: string;
  name: string;
  slug: string;
  status: AssetStatus;
  templateId: string | null;
  config: string; // JSON of LandingConfig
  metaTitle: string;
  metaDescription: string;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  views: number;
  submissions: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LandingTemplateCategory =
  | "blank"
  | "saas"
  | "local_business"
  | "event"
  | "lead_gen";

export interface LandingTemplate {
  id: string;
  name: string;
  category: LandingTemplateCategory;
  config: string; // JSON of LandingConfig
  thumbnailUrl: string | null;
  createdAt: Date;
}

// ===========================================================================
// Forms
// ===========================================================================

export type FormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "number";

export const FORM_FIELD_TYPES: FormFieldType[] = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "date",
  "number",
];

// Which CRM contact/lead field a form field maps to.
export type CrmFieldKey =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "message"
  | "website"
  | "budget"
  | "none";

export interface FormFieldValidation {
  required: boolean;
  min?: number | null;
  max?: number | null;
  pattern?: string | null;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder: string;
  crmField: CrmFieldKey;
  options: string[]; // for select / radio
  validation: FormFieldValidation;
}

export interface FormStyle {
  theme: "light" | "dark";
  primaryColor: string;
  borderRadius: number;
  // Branding (FASE 2.1) — opzionali per retrocompatibilità coi form salvati
  logoUrl?: string; // URL logo mostrato in cima al form ("" = nessuno)
  backgroundColor?: string; // sfondo del form ("" = default tema)
  buttonText?: string; // testo del pulsante di invio (default "Invia")
  fontFamily?: string; // famiglia font CSS ("" = eredita)
}

export type FormStatus = "draft" | "active" | "archived";

export interface CrmForm {
  id: string;
  name: string;
  description: string | null;
  fields: string; // JSON of FormField[]
  style: string; // JSON of FormStyle
  successMessage: string;
  redirectUrl: string | null;
  embedEnabled: boolean;
  status: FormStatus;
  views: number;
  submissions: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormSubmission {
  id: string;
  formId: string;
  landingPageId: string | null;
  funnelId: string | null;
  contactId: string | null;
  data: string; // JSON of submitted values
  ipHash: string | null;
  userAgent: string | null;
  referrer: string | null;
  createdAt: Date;
}

// ===========================================================================
// Booking
// ===========================================================================

export interface DayAvailability {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export interface BookingAvailability {
  days: Record<WeekdayKey, DayAvailability>;
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
  maxPerDay: number;
}

export type BookingLinkStatus = "active" | "paused" | "archived";

export interface BookingLink {
  id: string;
  name: string;
  slug: string;
  assignedTo: string; // comma-separated userIds who can receive bookings
  durationMinutes: number;
  availability: string; // JSON of BookingAvailability
  successMessage: string;
  redirectUrl: string | null;
  status: BookingLinkStatus;
  bookingsCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingAppointmentStatus =
  | "confirmed"
  | "pending"
  | "cancelled"
  | "completed";

export interface BookingAppointment {
  id: string;
  bookingLinkId: string;
  calendarEventId: string | null;
  contactId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestNotes: string | null;
  startAt: Date;
  endAt: Date;
  status: BookingAppointmentStatus;
  createdAt: Date;
}

export interface AvailabilitySlot {
  start: string; // ISO
  end: string; // ISO
}

// ===========================================================================
// Funnels
// ===========================================================================

export type FunnelConditionOperator = "exists" | "equals";

export interface FunnelCondition {
  field: string;
  operator: FunnelConditionOperator;
  value: string | null;
  trueNextStepId: string | null;
  falseNextStepId: string | null;
}

export interface FunnelStep {
  id: string;
  name: string;
  landingPageId: string;
  nextStepId: string | null;
  conditions: FunnelCondition[];
}

export type FunnelStatus = "draft" | "active" | "archived";

export interface Funnel {
  id: string;
  name: string;
  slug: string;
  steps: string; // JSON of FunnelStep[]
  thankYouPageId: string | null;
  status: FunnelStatus;
  views: number;
  conversions: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FunnelSession {
  id: string;
  funnelId: string;
  sessionId: string;
  contactId: string | null;
  currentStep: string | null;
  completed: boolean;
  abandoned: boolean;
  startedAt: Date;
  completedAt: Date | null;
}

export type FunnelEventType =
  | "step_view"
  | "step_submit"
  | "step_skip"
  | "funnel_complete"
  | "funnel_abandon";

export interface FunnelEvent {
  id: string;
  funnelId: string;
  sessionId: string;
  stepId: string;
  eventType: FunnelEventType;
  data: string | null; // JSON
  createdAt: Date;
}

// ===========================================================================
// Analytics
// ===========================================================================

export type AnalyticsAssetType = "landing" | "form" | "booking" | "funnel";

export type AnalyticsEventType =
  | "page_view"
  | "cta_click"
  | "scroll_50"
  | "scroll_90"
  | "form_view"
  | "form_start"
  | "form_submit"
  | "form_field_error"
  | "booking_page_view"
  | "slot_select"
  | "booking_submit"
  | "booking_confirm"
  | "booking_complete"
  | "funnel_start"
  | "step_view"
  | "step_submit"
  | "funnel_complete"
  | "funnel_abandon"
  | "funnel_step";

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  assetType: AnalyticsAssetType;
  assetId: string;
  sessionId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  referrer: string | null;
  createdAt: Date;
}

// ===========================================================================
// Display labels (Italian)
// ===========================================================================

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  draft: "Bozza",
  published: "Pubblicata",
  archived: "Archiviata",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  features: "Caratteristiche",
  testimonials: "Testimonianze",
  cta: "Call to Action",
  form: "Form",
  image: "Immagine",
  text: "Testo",
  divider: "Separatore",
  footer: "Footer",
  logos: "Loghi",
  faq: "FAQ",
  reviews: "Recensioni",
  offer: "Offerta",
  comparison: "Tabella comparativa",
};

export const FORM_FIELD_LABELS: Record<FormFieldType, string> = {
  text: "Testo",
  email: "Email",
  phone: "Telefono",
  textarea: "Testo lungo",
  select: "Menu a tendina",
  checkbox: "Checkbox",
  radio: "Scelta singola",
  date: "Data",
  number: "Numero",
};

export const CRM_FIELD_LABELS: Record<CrmFieldKey, string> = {
  name: "Nome",
  email: "Email",
  phone: "Telefono",
  company: "Azienda",
  message: "Messaggio",
  website: "Sito web",
  budget: "Budget",
  none: "Nessuna mappatura",
};

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Lunedì",
  tue: "Martedì",
  wed: "Mercoledì",
  thu: "Giovedì",
  fri: "Venerdì",
  sat: "Sabato",
  sun: "Domenica",
};
