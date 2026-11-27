export {
  PlatformProvider,
  PlatformActionsProvider,
  usePlatformStore,
  usePlatformLoading,
} from "./model/PlatformProvider";
export { platformService, normalizePlatformState } from "./api/platformService";
export { createPlatformActions } from "./api/createPlatformActions";
export type { PlatformState, PlatformActions, TeamDraft, TournamentDraft } from "./model/types";

export {
  getStatisticsRange,
  getStatisticsMetrics,
  getStatisticsChart,
  inRange,
  safeDate,
} from "./lib/statistics";
export type { Period } from "./lib/statistics";
