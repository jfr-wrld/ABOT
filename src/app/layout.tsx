import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { StoreHydrator } from "@/components/layout/StoreHydrator";
import { TabNotice } from "@/components/layout/TabNotice";
import { DynamicIsland } from "@/components/layout/DynamicIsland";
import { SplashScreen } from "@/components/animations/SplashScreen";
import { PageTransition } from "@/components/animations/PageTransition";
import { MotionProvider } from "@/components/animations/MotionProvider";
import { SignInReturn } from "@/components/sync/SignInReturn";
import { NativeShell } from "@/components/layout/NativeShell";
import { AutoGym } from "@/components/layout/AutoGym";
import { THEME_SCRIPT, ThemeController } from "@/components/layout/ThemeController";
import { LangAttr } from "@/components/layout/LangAttr";
import { LoadingStatus } from "@/components/ui/Loading";
import { AudioUnlock } from "@/components/layout/AudioUnlock";
import { EntitlementsProvider } from "@/components/paywall/EntitlementsProvider";
import { RemoteConfigLoader } from "@/components/remote/RemoteConfigLoader";

// next/font downloads both families at build time and serves them from this app,
// so the browser never calls Google: the zero-network rule still holds.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });

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
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <head>
        {/* Theme before the first paint, so a light page never flashes dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeController />
        <LangAttr />
        <AudioUnlock />
        <RemoteConfigLoader />
        <EntitlementsProvider />
        <MotionProvider>
          <StoreHydrator />
          <TabNotice />
          <SplashScreen />
          <DynamicIsland />
          <NativeShell />
          <AutoGym />
          {/* Edge-to-edge on Android: a solid strip behind the status bar, content starts below it. */}
          <div aria-hidden="true" className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-bg" />
          <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[calc(var(--dock-h,96px)+var(--live-bar,0px)+env(safe-area-inset-bottom))]">
            <Suspense fallback={<LoadingStatus />}>
              <PageTransition>{children}</PageTransition>
            </Suspense>
          </div>
          <BottomNav />
          <SignInReturn />
        </MotionProvider>
      </body>
    </html>
  );
}
