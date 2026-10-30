import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// SPEC §11: Inter for the interface, Geist Mono for IDs and code.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Spec Studio",
  description: "Turn a rough feature request into a developer-ready spec.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
