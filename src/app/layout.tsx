import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { StoreHydrator } from "@/components/layout/StoreHydrator";
import { TabNotice } from "@/components/layout/TabNotice";
import { UpdateCenter } from "@/components/update/UpdateCenter";
import { ScrollMemory } from "@/components/navigation/ScrollMemory";
import { DynamicIsland } from "@/components/layout/DynamicIsland";
import { SplashScreen } from "@/components/animations/SplashScreen";
import { PageTransition } from "@/components/animations/PageTransition";
import { MotionProvider } from "@/components/animations/MotionProvider";
import { SignInReturn } from "@/components/sync/SignInReturn";
import { NativeShell } from "@/components/layout/NativeShell";
import { AutoGym } from "@/components/layout/AutoGym";
import { THEME_SCRIPT, ThemeController } from "@/components/layout/ThemeController";
import { EffectsController } from "@/components/layout/EffectsController";
import { LangAttr } from "@/components/layout/LangAttr";
import { LoadingStatus } from "@/components/ui/Loading";
import { AudioUnlock } from "@/components/layout/AudioUnlock";
import { EntitlementsProvider } from "@/components/paywall/EntitlementsProvider";
import { RemoteConfigLoader } from "@/components/remote/RemoteConfigLoader";

// next/font downloads both families at build time and serves them from this app,
// so the browser never calls Google: the zero-network rule still holds.
const sans = Plus_Jakarta_Sans({ variable: "--font-sans-face", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });
// Story Studio's theme faces (src/fonts, OFL): declared on every page but not preloaded, so a
// phone downloads one only when a story card draws with it. next/font needs literal options.
const anton = localFont({ src: "../fonts/anton-latin.woff2", variable: "--font-anton", weight: "400", display: "swap", preload: false });
const fraunces = localFont({ src: "../fonts/fraunces-latin.woff2", variable: "--font-fraunces", weight: "400 900", display: "swap", preload: false });
const silkscreen = localFont({
  src: [
    { path: "../fonts/silkscreen-400-latin.woff2", weight: "400" },
    { path: "../fonts/silkscreen-700-latin.woff2", weight: "700" },
  ],
  variable: "--font-silkscreen",
  display: "swap",
  preload: false,
});
const grotesk = localFont({ src: "../fonts/space-grotesk-latin.woff2", variable: "--font-space-grotesk", weight: "400 700", display: "swap", preload: false });
const vt323 = localFont({ src: "../fonts/vt323-latin.woff2", variable: "--font-vt323", weight: "400", display: "swap", preload: false });
const storyFaces = [anton, fraunces, silkscreen, grotesk, vt323].map((f) => f.variable).join(" ");

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
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${storyFaces} h-full antialiased`}>
      <head>
        {/* Theme before the first paint, so a light page never flashes dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeController />
        <EffectsController />
        <LangAttr />
        <AudioUnlock />
        <RemoteConfigLoader />
        <EntitlementsProvider />
        <MotionProvider>
          <StoreHydrator />
          <TabNotice />
          <SplashScreen />
          <DynamicIsland />
          <UpdateCenter />
          <ScrollMemory />
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
