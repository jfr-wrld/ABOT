/**
 * Remotion Studio for ABOT's story videos, design time only (see README). The compositions draw
 * with the app's own painters, imported through the same "@/" alias the app uses, so Studio shows
 * exactly the frames the phone encodes.
 */
import path from "node:path";
import { Config } from "@remotion/cli/config";

const appSrc = path.resolve(process.cwd(), "../../src");

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), "@": appSrc },
  },
}));
// The app's fonts and photos are local files: nothing is fetched while designing.
Config.setPublicDir(path.resolve(process.cwd(), "public"));
