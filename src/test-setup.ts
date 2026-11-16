import { SEED_EXERCISES } from "@/data/exercises";
import { useExerciseStore } from "@/store/useExerciseStore";
import { loadIndonesian } from "@/i18n";

// The app loads these at start (appSession.startApp); tests start with them loaded.
useExerciseStore.setState({ seed: SEED_EXERCISES });
await loadIndonesian();
