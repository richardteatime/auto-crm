import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NotificationChecker } from "@/components/shared/NotificationChecker";
import { WHITE_LABEL } from "@/lib/white-label";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${WHITE_LABEL.productName} - Il tuo CRM con Intelligenza Artificiale`,
  description:
    "CRM conversazionale con pipeline di vendita, classificazione automatica dei lead e follow-up intelligente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex" suppressHydrationWarning>
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
          <NotificationChecker />
        </TooltipProvider>
      </body>
    </html>
  );
}
