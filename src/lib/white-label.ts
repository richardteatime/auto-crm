/**
 * White-label configuration
 *
 * Edit this file to rebrand the CRM for your client.
 * All UI references to the product name, company, and branding
 * are read from here.
 */

export const WHITE_LABEL = {
  /** Product name displayed throughout the UI */
  productName: "CRM Pro",

  /** Company or vendor name */
  companyName: "Your Company",

  /** Version string shown in the sidebar/footer */
  version: "1.0.0",

  /** Support email used in digests and communications */
  supportEmail: "support@example.com",

  /** Default language code (it | es | en) */
  defaultLanguage: "it" as const,

  /** Default theme */
  defaultTheme: "light" as const,

  /** Sender name for email digest */
  digestSender: "CRM Pro",

  /** Sender email for email digest */
  digestFromEmail: "onboarding@resend.dev",
} as const;

export type WhiteLabelConfig = typeof WHITE_LABEL;
