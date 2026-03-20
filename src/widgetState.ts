import type {
  PrefetchedThreadMessage,
  ThreadHistoryRaw,
} from "./threadHistory";

export type WidgetState = {
  pinnedOpenPreference: boolean;
  pinnedOpenPreferenceInitialized: boolean;
  launcherVisibilityForced: boolean;
  hasActiveChat: boolean;
  isWidgetOpen: boolean;
  isLauncherCurrentlyVisible: boolean;
  launcherGreetingDismissed: boolean;
  prefetchedThreadMessages: PrefetchedThreadMessage[];
  prefetchedThreadMessagesPromise: Promise<void> | null;
  prefetchedMessagesInjected: boolean;
  privacyNoticeDismissed: boolean;
  threadHistoryRaw: ThreadHistoryRaw;
};

export function createInitialWidgetState({
  hasActiveChat,
  launcherVisibilityForced,
  launcherGreetingDismissed,
}: Pick<
  WidgetState,
  "hasActiveChat" | "launcherVisibilityForced" | "launcherGreetingDismissed"
>): WidgetState {
  return {
    pinnedOpenPreference: false,
    pinnedOpenPreferenceInitialized: false,
    launcherVisibilityForced,
    hasActiveChat,
    isWidgetOpen: false,
    isLauncherCurrentlyVisible: false,
    launcherGreetingDismissed,
    prefetchedThreadMessages: [],
    prefetchedThreadMessagesPromise: null,
    prefetchedMessagesInjected: false,
    privacyNoticeDismissed: false,
    threadHistoryRaw: { value: { data: [] } },
  };
}
