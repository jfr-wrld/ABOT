// Builds src/components/icons/solar/<Name>.tsx from the Solar icon set (480 Design, CC BY 4.0,
// via @iconify-json/solar, a dev dependency): one React component per icon the app uses, named
// as the app calls it, each in its own file so a page ships only the icons it draws.
// src/components/icons/solar.generated.tsx re-exports them all. Meaningful icons are drawn Bold (solid); small UI glyphs (arrows,
// chevrons, close, plus, minus, check, grips) are drawn Linear so they stay light. Every
// component can also be asked for the other style (`variant`). Run: node scripts/make-icons.mjs
//
// Size (owner-approved, 2026-11-15): only the styles the source draws ship (scripts/icon-usage.mjs;
// an icon whose use cannot be read keeps both), and path numbers keep two decimals, invisible in
// a 24-unit box. src/components/icons/icon-usage.test.ts fails when the source asks for a style
// this file left out; run the script again then.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { iconUsage } from "./icon-usage.mjs";

const set = JSON.parse(readFileSync(new URL("../node_modules/@iconify-json/solar/icons.json", import.meta.url), "utf8"));

/** App name -> [Solar base name, default style]. "l" = linear by default, otherwise bold. */
const MAP = {
  Activity: ["pulse"],
  AlertTriangle: ["danger-triangle"],
  ArrowDown: ["arrow-down", "l"],
  ArrowDownRight: ["arrow-right-down", "l"],
  ArrowLeft: ["arrow-left", "l"],
  ArrowLeftRight: ["transfer-horizontal", "l"],
  ArrowRight: ["arrow-right", "l"],
  ArrowUp: ["arrow-up", "l"],
  ArrowUpDown: ["sort-vertical", "l"],
  ArrowUpRight: ["arrow-right-up", "l"],
  Bell: ["bell"],
  BellOff: ["bell-off"],
  BellRing: ["bell-bing"],
  Bike: ["bicycling"],
  BookOpen: ["book-minimalistic"],
  Bookmark: ["bookmark"],
  Brain: ["brain"],
  CalendarCheck: ["calendar-check"],
  CalendarClock: ["calendar-date"],
  CalendarDays: ["calendar"],
  CalendarPlus: ["calendar-add"],
  Camera: ["camera"],
  Check: ["check-read", "l"],
  ChevronDown: ["alt-arrow-down", "l"],
  ChevronLeft: ["alt-arrow-left", "l"],
  ChevronRight: ["alt-arrow-right", "l"],
  ChevronUp: ["alt-arrow-up", "l"],
  CircleHelp: ["question-circle"],
  ClipboardList: ["clipboard-list"],
  Cloud: ["cloud"],
  CloudAlert: ["cloud-cross"],
  CloudCheck: ["cloud-check"],
  CloudOff: ["cloud-cross"],
  CloudUpload: ["cloud-upload"],
  Copy: ["copy"],
  Cpu: ["cpu"],
  Crosshair: ["target"],
  Crown: ["crown"],
  Database: ["database"],
  Download: ["download-minimalistic"],
  Droplets: ["waterdrops"],
  Dumbbell: ["dumbbell-large-minimalistic"],
  DumbbellLarge: ["dumbbell-large"],
  ExternalLink: ["square-arrow-right-up", "l"],
  FileDown: ["file-download"],
  Film: ["clapperboard-play"],
  Flag: ["flag"],
  Flame: ["fire"],
  FlaskConical: ["flask"],
  Footprints: ["walking"],
  Gauge: ["speedometer-middle"],
  Gem: ["diamond"],
  GripVertical: ["menu-dots-vertical", "l"],
  Hammer: ["sledgehammer"],
  HardHat: ["toolbox"],
  HeartPulse: ["heart-pulse"],
  Home: ["home-smile"],
  House: ["home-smile"],
  Image: ["gallery"],
  ImagePlus: ["gallery-add"],
  Info: ["info-circle"],
  KeyRound: ["key-minimalistic"],
  Laptop: ["laptop"],
  Layers: ["layers-minimalistic"],
  LayoutGrid: ["widget"],
  LayoutTemplate: ["widget-2"],
  Link2: ["link"],
  Link2Off: ["link-broken"],
  List: ["list"],
  ListChecks: ["checklist-minimalistic"],
  ListOrdered: ["list-ordered"],
  ListPlus: ["list-plus"],
  LocateFixed: ["gps"],
  Lock: ["lock-keyhole-minimalistic"],
  LockKeyhole: ["lock-keyhole"],
  LogOut: ["logout-2"],
  Mail: ["letter"],
  MapPin: ["map-point"],
  Megaphone: ["megaphone"],
  Mic: ["microphone"],
  Minus: ["minus", "l"],
  Moon: ["moon"],
  MoreHorizontal: ["menu-dots", "l"],
  NotebookPen: ["notebook"],
  Pause: ["pause"],
  Pencil: ["pen"],
  PersonStanding: ["body"],
  Play: ["play"],
  Plus: ["add", "l"],
  RefreshCw: ["refresh"],
  Repeat: ["repeat"],
  RotateCcw: ["restart"],
  Scale: ["weigher"],
  Scissors: ["scissors"],
  Search: ["magnifer"],
  Settings: ["settings"],
  Settings2: ["settings-minimalistic"],
  Share: ["share"],
  Share2: ["share"],
  Shield: ["shield"],
  ShieldCheck: ["shield-check"],
  ShoppingBasket: ["cart-large-minimalistic"],
  SlidersHorizontal: ["tuning-2"],
  Smartphone: ["smartphone"],
  Sparkles: ["stars"],
  SquarePlus: ["add-square"],
  Star: ["star"],
  Sun: ["sun"],
  Timer: ["stopwatch"],
  Trash2: ["trash-bin-minimalistic"],
  TrendingDown: ["graph-down"],
  TrendingUp: ["graph-up"],
  TriangleAlert: ["danger-triangle"],
  Trophy: ["cup-star"],
  Utensils: ["fork-knife"],
  WifiOff: ["wi-fi-router-minimalistic"],
  X: ["close", "l"],
  Zap: ["bolt"],
  ZoomIn: ["magnifer-zoom-in"],
  ZoomOut: ["magnifer-zoom-out"],
};

/**
 * Two decimals: 0.01 of a 24-unit box is under a hundredth of a pixel at the sizes the app draws
 * (checked by rendering every shape before and after, 2026-11-15). Only the fraction is rounded:
 * the digits before the point stay as written (plus a carry), so arc flags written without a
 * separator ("0 011.5") keep their meaning.
 */
const round = (svg) =>
  svg.replace(/(\d*)\.(\d+)/g, (_, int, frac) => {
    const lead = int.length > 1 ? (int.match(/^0+/)?.[0] ?? "") : "";
    const rest = int.slice(lead.length);
    let r = Number(`${rest || "0"}.${frac}`).toFixed(2).replace(/\.?0+$/, "");
    if (!rest) r = r.replace(/^0(?=\.)/, "");
    return lead + (r || "0");
  });

function body(name) {
  const icon = set.icons[name] ?? (set.aliases?.[name] && set.icons[set.aliases[name].parent]);
  if (!icon) throw new Error(`Solar has no ${name}`);
  return { body: round(icon.body), w: icon.width ?? set.width ?? 24, h: icon.height ?? set.height ?? 24 };
}

const defaults = Object.fromEntries(Object.entries(MAP).map(([app, [, style]]) => [app, style === "l" ? "linear" : "bold"]));
const usage = iconUsage(new URL("../src", import.meta.url).pathname, defaults);
let left = 0;

const HEADER = "// Generated by scripts/make-icons.mjs from Solar (480 Design, CC BY 4.0). Do not edit by hand.";
const dir = new URL("../src/components/icons/solar/", import.meta.url);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir);
const index = [HEADER, ""];
for (const [app, [base]] of Object.entries(MAP).sort(([a], [b]) => a.localeCompare(b))) {
  const want = usage.get(app);
  const both = want.has("both") || (want.has("bold") && want.has("linear"));
  // Not drawn anywhere yet: keep its default style, so a new use shows the right shape.
  const keepBold = both || want.has("bold") || (want.size === 0 && defaults[app] === "bold");
  const keepLinear = both || want.has("linear") || (want.size === 0 && defaults[app] === "linear");
  if (!keepBold || !keepLinear) left++;
  const bold = keepBold ? JSON.stringify(body(`${base}-bold`)) : "null";
  const lin = keepLinear ? JSON.stringify(body(`${base}-linear`)) : "null";
  writeFileSync(
    new URL(`${app}.tsx`, dir),
    [HEADER, 'import { solarIcon } from "../solar";', "", `export const ${app} = /*#__PURE__*/ solarIcon(${JSON.stringify(app)}, ${JSON.stringify(defaults[app])}, ${bold}, ${lin});`, ""].join("\n"),
  );
  index.push(`export { ${app} } from "./solar/${app}";`);
}
writeFileSync(new URL("../src/components/icons/solar.generated.tsx", import.meta.url), index.join("\n") + "\n");
console.log(`${Object.keys(MAP).length} icons written, ${left} with one style only`);
