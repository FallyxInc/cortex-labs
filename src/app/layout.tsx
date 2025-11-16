import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
