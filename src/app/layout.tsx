import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { StoreHydrator } from "@/components/layout/StoreHydrator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ABOT",
  description: "Log sets, rest, and progress for strength training.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <StoreHydrator />
        <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))]">
          <Suspense
            fallback={
              <p role="status" className="px-4 py-10 text-center text-sm text-text-muted">
                Loading
              </p>
            }
          >
            {children}
          </Suspense>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
