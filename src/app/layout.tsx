import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spec Studio",
  description: "Turn a rough feature request into a developer-ready spec.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
