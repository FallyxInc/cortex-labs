import type { Metadata } from "next";
import "./globals.css";
import MixpanelProvider from "@/components/MixpanelProvider";

export const metadata: Metadata = {
  title: "Fallyx Behaviours Dashboard",
  description: "Behaviour tracking and analysis dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Inter variable font is loaded via @import in globals.css with full weight range (100-900) */}
      {/* Next.js automatically handles preconnect optimization for Google Fonts */}
      <body>
        <MixpanelProvider>{children}</MixpanelProvider>
      </body>
    </html>
  );
}
