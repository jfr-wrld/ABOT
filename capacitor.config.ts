import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Permanent once the app is on Google Play; change it before the first upload if needed.
  appId: "app.abot.gym",
  appName: "ABOT",
  // `npm run build:android` exports the Next app here.
  webDir: "out",
  backgroundColor: "#09090b",
  plugins: {
    SystemBars: {
      // Light status bar icons on ABOT's dark UI, whatever the phone's theme.
      style: "DARK",
      initialViewportFitValueHint: "cover",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_abot",
      iconColor: "#CCFF00",
    },
  },
  android: {
    // Bundled assets only: the app runs with no network, like the web build.
    allowMixedContent: false,
  },
};

export default config;
