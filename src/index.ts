import { computePosition, flip, shift, autoUpdate } from "@floating-ui/dom";
import { createFocusTrap } from "focus-trap";
import { marked } from "marked";

import { widgetHTML } from "./widgetHtmlString";
import css from "./widget.css";

const WIDGET_BACKDROP_ID = "buildship-chat-widget__backdrop";
const WIDGET_CONTAINER_ID = "buildship-chat-widget__container";
const WIDGET_MESSAGES_HISTORY_CONTAINER_ID =
  "buildship-chat-widget__messages_history";
const WIDGET_THINKING_BUBBLE_ID = "buildship-chat-widget__thinking_bubble";
const WIDGET_CLEAR_BUTTON_ID = "buildship-chat-widget__clear";
const WIDGET_COLLAPSE_TAB_ID = "buildship-chat-widget__collapse-tab";
const WIDGET_LAUNCHER_ID = "buildship-chat-widget__launcher";
const WIDGET_LAUNCHER_BADGE_CLASS = "buildship-chat-widget__launcher-badge";
const DOCUMENT_OPEN_CLASS = "buildship-chat-widget--open";
const DOCUMENT_LAUNCHER_VISIBLE_CLASS =
  "buildship-chat-widget--launcher-visible";
const HIDE_TARGET_DATA_ATTRIBUTE = "data-buildship-chat-widget-hidden";
const STORAGE_KEYS = {
  pinnedOpen: "buildship-chat-widget:pinned-open",
  launcherForced: "buildship-chat-widget:launcher-forced",
  activeChat: "buildship-chat-widget:active-chat",
};


// Functions to handle thread id as session cookie
const THREAD_ID_COOKIE_NAME = "chatThreadID";

function getCookieValue(name: string): string | null {
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName.trim() === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function setSessionCookie(value: string) {
  if (value) {
    document.cookie = `${THREAD_ID_COOKIE_NAME}=${encodeURIComponent(value)}; path=/`;
  }
}
function clearSessionCookie() {
  document.cookie = `${THREAD_ID_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
}

// end session cookie

// Allow launcher offsets per side so users can fine tune button placement.
type LauncherPlacement = Partial<
  Record<"top" | "right" | "bottom" | "left", string>
>;

// Public config shape for the floating launcher button/icon.
type LauncherConfig = {
  enabled?: boolean;
  restrictToPaths?: string[];
  placement?: LauncherPlacement;
  ariaLabel?: string;
  text?: string;
  rememberVisibility?: boolean;
};

type HideTargetsConfig = {
  ids?: string[];
  classes?: string[];
};

type NormalizedHideTargets = {
  ids: string[];
  classes: string[];
};

export type WidgetConfig = {
  url: string;
  threadId: string | null;
  responseIsAStream: boolean;
  user: Record<any, any>;
  widgetTitle: string;
  greetingMessage: string | null;
  disableErrorAlert: boolean;
  closeOnOutsideClick: boolean;
  openOnLoad: boolean;
  linkTarget: string | null;
  urlFetchThreadHistory: string;
  urlFetchUpdateThreadHistory: string;
  addClearChat: boolean;
  launcher?: LauncherConfig;
  persistOpenState?: boolean;
  collapseTabLabel?: string;
  hideTargets?: HideTargetsConfig;
};

const renderer = new marked.Renderer();
const linkRenderer = renderer.link;
// To open links in a new tab
renderer.link = (href, title, text) => {
  const parsed = linkRenderer.call(renderer, href, title, text);
  return parsed.replace(/^<a /, '<a target="_' + config.linkTarget + '" rel="nofollow" ');
};

const config: WidgetConfig = {
  url: "",
//  threadId: null,
  threadId: getCookieValue(THREAD_ID_COOKIE_NAME),
  responseIsAStream: true,
  user: {},
  widgetTitle: "Chatbot",
  greetingMessage: null,
  disableErrorAlert: false,
  closeOnOutsideClick: false,
  openOnLoad: false,
  linkTarget: "self",
  urlFetchThreadHistory: "",
  urlFetchUpdateThreadHistory: "",
  addClearChat: false,
  launcher: undefined,
  persistOpenState: false,
  collapseTabLabel: "Chat ausblenden",
  hideTargets: undefined,
  ...(window as any).buildShipChatWidget?.config,
};

const DEFAULT_LAUNCHER_PLACEMENT: Required<
  Pick<LauncherPlacement, "bottom" | "right">
> = {
  bottom: "2rem",
  right: "2rem",
};
const DEFAULT_LAUNCHER_TEXT = "Chat";
const DEFAULT_LAUNCHER_ARIA_LABEL = "Chat starten";
const DEFAULT_COLLAPSE_TAB_LABEL = "Chat ausblenden";

// Internally we always resolve config to this explicit structure.
type NormalizedLauncherConfig = {
  enabled: boolean;
  restrictToPaths: string[];
  placement: LauncherPlacement;
  ariaLabel: string;
  text: string;
  rememberVisibility: boolean;
};

// Resolve launcher settings from the latest user config (which may be assigned
// after our bundle is evaluated).
function getNormalizedLauncherConfig(): NormalizedLauncherConfig {
  const launcher = config.launcher ?? {};
  const placement = launcher.placement ?? {};
  return {
    enabled: launcher.enabled ?? false,
    restrictToPaths: launcher.restrictToPaths ?? [],
    placement: {
      top: placement.top ?? "",
      right: placement.right ?? DEFAULT_LAUNCHER_PLACEMENT.right,
      bottom: placement.bottom ?? DEFAULT_LAUNCHER_PLACEMENT.bottom,
      left: placement.left ?? "",
    },
    ariaLabel: launcher.ariaLabel ?? DEFAULT_LAUNCHER_ARIA_LABEL,
    text: launcher.text ?? DEFAULT_LAUNCHER_TEXT,
    rememberVisibility: launcher.rememberVisibility ?? true,
  };
}

function getLauncherRestrictToPaths() {
  return getNormalizedLauncherConfig()
    .restrictToPaths.map((path) => path.trim())
    .filter(Boolean);
}

function getCollapseTabLabel() {
  return config.collapseTabLabel ?? DEFAULT_COLLAPSE_TAB_LABEL;
}

function isPersistOpenStateEnabled() {
  return Boolean(config.persistOpenState);
}

function getNormalizedHideTargets(): NormalizedHideTargets {
  const hideTargets = config.hideTargets ?? {};
  return {
    ids: (hideTargets.ids ?? []).map((id) => id.trim()).filter(Boolean),
    classes: (hideTargets.classes ?? [])
      .map((className) => className.trim())
      .filter(Boolean),
  };
}

// Basic storage helpers handle private mode/SSR failures gracefully.
function getStorageItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readBooleanFromStorage(key: string) {
  return getStorageItem(key) === "true";
}

function setBooleanInStorage(key: string, value: boolean) {
  if (value) {
    setStorageItem(key, "true");
  } else {
    removeStorageItem(key);
  }
}

const hiddenElements = new Set<HTMLElement>();

function collectHideTargetElements(): HTMLElement[] {
  const { ids, classes } = getNormalizedHideTargets();
  if (!ids.length && !classes.length) {
    return [];
  }
  const elements = new Set<HTMLElement>();
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
      elements.add(element);
    }
  });
  classes.forEach((className) => {
    const nodeList = document.querySelectorAll<HTMLElement>(`.${className}`);
    nodeList.forEach((element) => elements.add(element));
  });
  return Array.from(elements);
}

function hideElement(element: HTMLElement) {
  if (!hiddenElements.has(element)) {
    element.setAttribute(
      HIDE_TARGET_DATA_ATTRIBUTE,
      element.style.display || ""
    );
    hiddenElements.add(element);
  }
  element.style.display = "none";
}

function restoreHiddenElements() {
  hiddenElements.forEach((element) => {
    const previousDisplay =
      element.getAttribute(HIDE_TARGET_DATA_ATTRIBUTE) ?? "";
    element.style.display = previousDisplay;
    element.removeAttribute(HIDE_TARGET_DATA_ATTRIBUTE);
  });
  hiddenElements.clear();
}

function toggleHideTargets(shouldHide: boolean) {
  if (shouldHide) {
    const elements = collectHideTargetElements();
    elements.forEach((element) => hideElement(element));
  } else if (hiddenElements.size) {
    restoreHiddenElements();
  }
}

function updateHideTargetsVisibility() {
  const shouldHide = isWidgetOpen || isLauncherCurrentlyVisible;
  toggleHideTargets(shouldHide);
}

let pinnedOpenPreference = false;
let pinnedOpenPreferenceInitialized = false;
// Determines if the widget should reopen automatically on navigation reloads.
function getPinnedOpenPreference() {
  if (
    !pinnedOpenPreferenceInitialized &&
    isPersistOpenStateEnabled()
  ) {
    pinnedOpenPreference = readBooleanFromStorage(STORAGE_KEYS.pinnedOpen);
    pinnedOpenPreferenceInitialized = true;
  }
  return pinnedOpenPreference;
}
function setPinnedOpenState(value: boolean) {
  pinnedOpenPreference = value;
  if (!isPersistOpenStateEnabled()) {
    return;
  }
  pinnedOpenPreferenceInitialized = true;
  setBooleanInStorage(STORAGE_KEYS.pinnedOpen, value);
}

let launcherVisibilityForced =
  (getNormalizedLauncherConfig().rememberVisibility &&
    readBooleanFromStorage(STORAGE_KEYS.launcherForced)) ||
  false;

function forceLauncherVisibility() {
  if (
    !getNormalizedLauncherConfig().rememberVisibility ||
    launcherVisibilityForced
  ) {
    return;
  }
  launcherVisibilityForced = true;
  setBooleanInStorage(STORAGE_KEYS.launcherForced, true);
}

const initialActiveChatState =
  readBooleanFromStorage(STORAGE_KEYS.activeChat) || Boolean(config.threadId);
if (initialActiveChatState) {
  setBooleanInStorage(STORAGE_KEYS.activeChat, true);
}
let hasActiveChat = initialActiveChatState;

let isWidgetOpen = false;
let launcherElement: HTMLButtonElement | null = null;
let isLauncherCurrentlyVisible = false;

function normalizePath(path: string) {
  if (!path) {
    return "/";
  }
  let candidate = path;
  if (candidate.includes("://")) {
    try {
      candidate = new URL(candidate).pathname;
    } catch {
      // ignore invalid URLs
    }
  }
  if (!candidate.startsWith("/")) {
    candidate = `/${candidate}`;
  }
  candidate = candidate.replace(/\/+$/, "");
  if (candidate === "") {
    candidate = "/";
  }
  return candidate;
}

function pathMatchesRule(rule: string) {
  const trimmedRule = rule.trim();
  if (!trimmedRule) {
    return false;
  }
  // Support "*" for all pages and prefix matching via "/foo/*" rules.
  if (trimmedRule === "*") {
    return true;
  }
  const hasWildcard = trimmedRule.endsWith("*");
  const ruleWithoutWildcard = hasWildcard
    ? trimmedRule.slice(0, -1)
    : trimmedRule;
  const normalizedRule = normalizePath(ruleWithoutWildcard);
  const currentPath = normalizePath(window.location?.pathname || "/");
  if (hasWildcard) {
    return currentPath.startsWith(normalizedRule);
  }
  return currentPath === normalizedRule;
}

function shouldDisplayLauncher() {
  const normalized = getNormalizedLauncherConfig();
  if (!normalized.enabled) {
    return false;
  }
  if (launcherVisibilityForced) {
    return true;
  }
  const restrictToPaths = getLauncherRestrictToPaths();
  if (!restrictToPaths.length) {
    return true;
  }
  return restrictToPaths.some((rule) => pathMatchesRule(rule));
}

function updateLauncherVisibility() {
  if (!launcherElement) {
    isLauncherCurrentlyVisible = false;
    updateHideTargetsVisibility();
    return;
  }
  // Hide the launcher while the chat drawer is visible to avoid duplicate affordances.
  const shouldBeVisible = shouldDisplayLauncher() && !isWidgetOpen;
  launcherElement.style.display = shouldBeVisible ? "" : "none";
  document.documentElement.classList.toggle(
    DOCUMENT_LAUNCHER_VISIBLE_CLASS,
    shouldBeVisible
  );
  isLauncherCurrentlyVisible = shouldBeVisible;
  updateHideTargetsVisibility();
}

function applyLauncherPlacementStyles() {
  if (!launcherElement) {
    return;
  }
  const normalized = getNormalizedLauncherConfig();
  (["top", "right", "bottom", "left"] as const).forEach((property) => {
    const value = normalized.placement[property];
    if (value) {
      launcherElement!.style.setProperty(property, value);
    } else {
      launcherElement!.style.removeProperty(property);
    }
  });
}

function applyActiveStateToLauncher() {
  if (!launcherElement) {
    return;
  }
  // Toggle the badge whenever a conversation exists so the indicator persists.
  launcherElement.classList.toggle(
    "buildship-chat-widget__launcher--active",
    hasActiveChat
  );
}

function markChatAsActive() {
  hasActiveChat = true;
  setBooleanInStorage(STORAGE_KEYS.activeChat, true);
  applyActiveStateToLauncher();
}

function resetActiveChatIndicator() {
  hasActiveChat = false;
  setBooleanInStorage(STORAGE_KEYS.activeChat, false);
  applyActiveStateToLauncher();
}

function initializeLauncher() {
  const normalized = getNormalizedLauncherConfig();
  if (!normalized.enabled) {
    return;
  }
  if (launcherElement) {
    applyLauncherPlacementStyles();
    applyActiveStateToLauncher();
    updateLauncherVisibility();
    return;
  }

  launcherElement = document.createElement("button");
  launcherElement.id = WIDGET_LAUNCHER_ID;
  launcherElement.type = "button";
  launcherElement.setAttribute(
    "aria-label",
    normalized.ariaLabel
  );
  launcherElement.className = "buildship-chat-widget__launcher";

  const iconWrapper = document.createElement("span");
  iconWrapper.className = "buildship-chat-widget__launcher-icon";
  iconWrapper.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 19" aria-hidden="true">
        <path d="M9 6C9.55229 6 10 6.44772 10 7V9C10 9.55228 9.55229 10 9 10C8.44771 10 8 9.55228 8 9V7C8 6.44772 8.44771 6 9 6Z" />
        <path d="M16 7C16 6.44772 15.5523 6 15 6C14.4477 6 14 6.44772 14 7V9C14 9.55228 14.4477 10 15 10C15.5523 10 16 9.55228 16 9V7Z" />
        <path d="M19.2099 16C19.0086 16 18.815 16.0768 18.6684 16.2147L16.4858 18.269C15.2525 19.4298 13.2248 18.6278 13.1191 16.9374C13.0862 16.4105 12.6493 16 12.1213 16H5C3.34315 16 2 14.6569 2 13V9C2 9.55228 1.55228 10 1 10C0.447715 10 0 9.55228 0 9V6C0 5.44772 0.447715 5 1 5C1.55228 5 2 5.44772 2 6V3C2 1.34315 3.34315 0 5 0H19C20.6569 0 22 1.34315 22 3V6C22 5.44772 22.4477 5 23 5C23.5523 5 24 5.44772 24 6V9C24 9.55228 23.5523 10 23 10C22.4477 10 22 9.55228 22 9V13.2099C22 14.7508 20.7508 16 19.2099 16ZM5 2C4.44772 2 4 2.44772 4 3V13C4 13.5523 4.44772 14 5 14H12.1213C13.7053 14 15.0163 15.2315 15.1152 16.8124L17.2977 14.7583C17.8152 14.2712 18.4992 14 19.2099 14C19.6463 14 20 13.6463 20 13.2099V3C20 2.44772 19.5523 2 19 2H5Z" />
      </svg>
    `;

  const labelElement = document.createElement("span");
  labelElement.className = "buildship-chat-widget__launcher-text";
  labelElement.textContent = normalized.text;

  const badgeElement = document.createElement("span");
  badgeElement.className = WIDGET_LAUNCHER_BADGE_CLASS;
  launcherElement.append(iconWrapper, labelElement, badgeElement);

  launcherElement.addEventListener("click", handleLauncherClick);
  document.body.appendChild(launcherElement);

  applyLauncherPlacementStyles();
  applyActiveStateToLauncher();
  updateLauncherVisibility();
}

function handleLauncherClick(e: Event) {
  e.preventDefault();
  if (isPersistOpenStateEnabled()) {
    setPinnedOpenState(true);
  }
  open({ target: document.body } as unknown as Event);
}

function handleCollapseTabClick(e: Event) {
  e.preventDefault();
  if (isPersistOpenStateEnabled()) {
    setPinnedOpenState(false);
  }
  close();
}

function handleWidgetOpened() {
  isWidgetOpen = true;
  document.documentElement.classList.add(DOCUMENT_OPEN_CLASS);
  forceLauncherVisibility();
  updateLauncherVisibility();
}

function handleWidgetClosed() {
  isWidgetOpen = false;
  document.documentElement.classList.remove(DOCUMENT_OPEN_CLASS);
  updateLauncherVisibility();
}

let cleanup = () => {};

// Holds preloaded messages so we can hydrate the UI on open.
type PrefetchedThreadMessage = {
  message: string;
  timestamp: number;
  from: "system" | "user";
};

let prefetchedThreadMessages: PrefetchedThreadMessage[] = [];
let prefetchedThreadMessagesPromise: Promise<void> | null = null;
let prefetchedMessagesInjected = false;

// Structure of a raw thread history message.
type ThreadHistoryRawMessage = {
  message: string;
  timestamp: number;
  from: "system" | "user";
};

// Structure of the raw thread history as stored/fetched from the server.
type ThreadHistoryRaw = {
  value?: {
    data?: any[];
  };
  [key: string]: any;
};

// In-memory cache of the thread history raw messages.
let THREAD_HISTORY_RAW: ThreadHistoryRaw = { value: { data: [] } };

// Get the current thread history raw messages, ensuring structure is valid.
function getThreadHistoryRawMessages(): any[] {
  if (!THREAD_HISTORY_RAW || typeof THREAD_HISTORY_RAW !== "object") {
    THREAD_HISTORY_RAW = { value: { data: [] } };
  }
  if (!THREAD_HISTORY_RAW.value || typeof THREAD_HISTORY_RAW.value !== "object") {
    THREAD_HISTORY_RAW.value = { data: [] };
  }
  if (!Array.isArray(THREAD_HISTORY_RAW.value.data)) {
    THREAD_HISTORY_RAW.value.data = [];
  }
  if (config.threadId) {
    THREAD_HISTORY_RAW.threadId = config.threadId;
  }
  return THREAD_HISTORY_RAW.value!.data!;
}

// Convert a ThreadHistoryRawMessage to the format expected by the server.
function convertToThreadHistoryRawEntry({
  message,
  timestamp,
  from,
}: ThreadHistoryRawMessage) {
  return {
    id: `local-${timestamp}-${from}`,
    object: "thread.message",
    created_at: Math.floor(timestamp / 1000),
    role: from === "user" ? "user" : "assistant",
    content: [
      {
        type: "text",
        text: {
          value: message,
        },
      },
    ],
  };
}

// Send updated thread history to server.used when new messages are added.
async function appendToThreadHistoryRaw(
  entry: ThreadHistoryRawMessage,
  syncWithServer = false
) {
  const messages = getThreadHistoryRawMessages();
  messages.unshift(convertToThreadHistoryRawEntry(entry));
  if (config.threadId) {
    THREAD_HISTORY_RAW.threadId = config.threadId;
  }

  if (!syncWithServer) {
    return;
  }
 
  try {
    await fetch(config.urlFetchUpdateThreadHistory, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(THREAD_HISTORY_RAW),
    });

  } catch (error) {
    console.error(
      "BuildShip Chat Widget: Failed to sync thread history",
      error
    );
  }
    
}

// Map API roles to widget message variants.
function mapChatRole(role: unknown): "system" | "user" {
  return role === "user" ? "user" : "system";
}

// Convert timestamps from the API to millisecond precision.
function normalizeTimestamp(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input > 1_000_000_000_000 ? input : input * 1000;
  }
  if (typeof input === "string") {
    const numeric = Number(input);
    if (Number.isFinite(numeric)) {
      return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    }
  }
  return Date.now();
}

// Load historical messages for an existing thread id.
async function fetchThreadMessages(url: string, threadId: string) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ threadId }),
    });

    if (!response.ok) {
      throw new Error(
        `BuildShip Chat Widget: Failed to fetch thread messages (${response.status} ${response.statusText})`
      );
    }

    const payload = await response.json();
    THREAD_HISTORY_RAW = payload;
    const rawMessages: any[] = Array.isArray(payload?.value?.data)
      ? payload.value.data
      : [];

    if (threadId !== config.threadId) {
      return;
    }
    // Parse and store prefetched messages.
    prefetchedThreadMessages = rawMessages
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const contentEntry = Array.isArray((item as any).content)
          ? (item as any).content.find(
              (part: any) => typeof part?.text?.value === "string"
            )
          : undefined;
        const textValue = contentEntry?.text?.value;
        if (typeof textValue !== "string") {
          return null;
        }

        return {
          message: textValue,
          timestamp: normalizeTimestamp((item as any).created_at),
          from: mapChatRole((item as any).role),
        };
      })
      .filter(
        (entry): entry is PrefetchedThreadMessage => entry !== null
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error("BuildShip Chat Widget: Failed to load thread history", error);
    prefetchedThreadMessages = [];
    throw error;
  }
}

// Render prefetched messages once the widget container exists.
async function injectPrefetchedThreadMessages() {
  if (prefetchedMessagesInjected) {
    return;
  }

  if (!config.urlFetchThreadHistory || !config.threadId) {
    return;
  }

  if (prefetchedThreadMessagesPromise) {
    try {
      await prefetchedThreadMessagesPromise;
    } catch {
      prefetchedMessagesInjected = true;
      return;
    }
  }

  if (!prefetchedThreadMessages.length) {
    prefetchedMessagesInjected = true;
    return;
  }

  prefetchedMessagesInjected = true;
  for (const message of prefetchedThreadMessages) {
    const messageId = `buildship-chat-widget__message--${message.from}--${message.timestamp}`;
    if (messagesHistory.querySelector(`#${messageId}`)) {
      continue;
    }
    await createNewMessageEntry(message.message, message.timestamp, message.from);
  }
}

// Handle Clear button click
async function handleClearButtonClick(e: Event) {
  if (!config.addClearChat) {
    return;
  }

  e.preventDefault();
  const button = e.currentTarget as HTMLButtonElement | null;
  button?.setAttribute("disabled", "");

  try {
    clearSessionCookie();         // Clear session cookie
    window.localStorage.clear();  // Clear local storage
    config.threadId = null;
    prefetchedThreadMessages = [];
    prefetchedThreadMessagesPromise = null;
    prefetchedMessagesInjected = false;

    if (thinkingBubble.parentElement === messagesHistory) {
      thinkingBubble.remove();
    }

    messagesHistory.innerHTML = "";

    if (config.greetingMessage) {
      await createNewMessageEntry(config.greetingMessage, Date.now(), "system");
    }
    resetActiveChatIndicator();

    const inputElement = document.getElementById(
      "buildship-chat-widget__input"
    ) as HTMLTextAreaElement | null;
    inputElement?.focus();
  } finally {
    button?.removeAttribute("disabled");
  }
}

// Initialize the widget on window load
async function init() {
  const styleElement = document.createElement("style");
  styleElement.innerHTML = css;
  document.head.insertBefore(styleElement, document.head.firstChild);

  // Slight delay to allow DOMContent to be fully loaded
  // (particularly for the button to be available in the `if (config.openOnLoad)` block below).
  await new Promise((resolve) => setTimeout(resolve, 10));

  document
    .querySelector("[data-buildship-chat-widget-button]")
    ?.addEventListener("click", open);

  initializeLauncher();

  if (
    config.threadId &&
    config.urlFetchThreadHistory &&
    !prefetchedThreadMessagesPromise
  ) {
    // Prefetch thread history early when a thread id is known.
    prefetchedThreadMessagesPromise = fetchThreadMessages(
      config.urlFetchThreadHistory,
      config.threadId
    );
  }

  const shouldPersistOpen = isPersistOpenStateEnabled();
  if (
    config.openOnLoad ||
    (shouldPersistOpen && getPinnedOpenPreference())
  ) {
    if (prefetchedThreadMessagesPromise) {
      try {
        await prefetchedThreadMessagesPromise;
      } catch {
        console.error("continue opening even if history failed to load");
        // continue opening even if history failed to load
      }
    }
    const target = document.querySelector(
      "[data-buildship-chat-widget-button]"
    );
    await open({ target } as Event);
  }
}

// Start initialization on window load
window.addEventListener("load", init);

const containerElement = document.createElement("div");
containerElement.id = WIDGET_CONTAINER_ID;

const messagesHistory = document.createElement("div");
messagesHistory.id = WIDGET_MESSAGES_HISTORY_CONTAINER_ID;

const optionalBackdrop = document.createElement("div");
optionalBackdrop.id = WIDGET_BACKDROP_ID;

const thinkingBubble = document.createElement("div");
thinkingBubble.id = WIDGET_THINKING_BUBBLE_ID;
thinkingBubble.innerHTML = `
    <span class="circle"></span>
    <span class="circle"></span>
    <span class="circle"></span>
  `;

const trap = createFocusTrap(containerElement, {
  initialFocus: "#buildship-chat-widget__input",
  allowOutsideClick: true,
});

async function open(e: Event) {
  if (isWidgetOpen) {
    return;
  }

  if (config.closeOnOutsideClick) {
    document.body.appendChild(optionalBackdrop);
  }

  document.body.appendChild(containerElement);
  containerElement.innerHTML = widgetHTML;
  containerElement.style.display = "block";
  handleWidgetOpened();

  const formElement = document.getElementById(
    "buildship-chat-widget__form"
  ) as HTMLFormElement | null;
  const inputElement = document.getElementById(
    "buildship-chat-widget__input"
  ) as HTMLTextAreaElement | null;
  const submitButton = document.getElementById(
    "buildship-chat-widget__submit"
  ) as HTMLButtonElement | null;

  if (inputElement && formElement) {
    const maxHeight = 160;
    const computedStyles = window.getComputedStyle(inputElement);
    const minHeight =
      parseFloat(computedStyles.minHeight || "0") || inputElement.clientHeight;
    const submitForm = () => {
      if (!formElement.checkValidity()) {
        formElement.reportValidity?.();
        return;
      }
      if (typeof formElement.requestSubmit === "function") {
        formElement.requestSubmit(submitButton ?? undefined);
        return;
      }
      if (submitButton) {
        submitButton.click();
        return;
      }
      const fallbackEvent = new Event("submit", {
        bubbles: true,
        cancelable: true,
      });
      formElement.dispatchEvent(fallbackEvent);
    };
    const adjustInputHeight = () => {
      inputElement.style.height = "auto";
      const newHeight = Math.min(
        Math.max(inputElement.scrollHeight, minHeight),
        maxHeight
      );
      inputElement.style.height = `${newHeight}px`;
      inputElement.style.overflowY =
        inputElement.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    inputElement.addEventListener("input", adjustInputHeight);
    inputElement.addEventListener("focus", adjustInputHeight);
    inputElement.addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        submitForm();
      }
    });

    adjustInputHeight();
  }

  const collapseTab = document.getElementById(
    WIDGET_COLLAPSE_TAB_ID
  ) as HTMLButtonElement | null;
  if (collapseTab) {
    const collapseLabel = getCollapseTabLabel();
    collapseTab.setAttribute("aria-label", collapseLabel);
    const collapseTabLabelElement = collapseTab.querySelector("span");
    if (collapseTabLabelElement) {
      collapseTabLabelElement.textContent = collapseLabel;
    } else {
      collapseTab.textContent = collapseLabel;
    }
    collapseTab.addEventListener("click", handleCollapseTabClick);
  }

  const chatbotHeaderTitleText = document.createElement("span");
  chatbotHeaderTitleText.id = "buildship-chat-widget__title_text";
  chatbotHeaderTitleText.textContent = config.widgetTitle;
  const chatbotHeaderTitle = document.getElementById(
    "buildship-chat-widget__title"
  )!;
  chatbotHeaderTitle.appendChild(chatbotHeaderTitleText);

  const chatbotHeader = document.getElementById(
    "buildship-chat-widget__header"
  );

  if (config.addClearChat && chatbotHeader) {
    let clearButton = document.getElementById(
      WIDGET_CLEAR_BUTTON_ID
    ) as HTMLButtonElement | null;

    if (!clearButton) {
      clearButton = document.createElement("button");
      clearButton.id = WIDGET_CLEAR_BUTTON_ID;
      clearButton.type = "button";
      clearButton.textContent = "Clear";
      clearButton.setAttribute("aria-label", "Clear conversation");
    } else {
      clearButton.removeEventListener("click", handleClearButtonClick);
    }

    if (clearButton && !clearButton.parentElement) {
      chatbotHeader.appendChild(clearButton);
    }

    clearButton?.addEventListener("click", handleClearButtonClick);
  } else {
    document.getElementById(WIDGET_CLEAR_BUTTON_ID)?.remove();
  }

  // Add widget container in DOM
  const target = (e?.target as HTMLElement) || document.body;
  cleanup = autoUpdate(target, containerElement, () => {
    computePosition(target, containerElement, {
      placement: "top-start",
      middleware: [flip(), shift({ crossAxis: true, padding: 0 })],
      strategy: "fixed",
    }).then(({ x, y }) => {
      Object.assign(containerElement.style, {
        right: `${x}px`,
        top: `${y}px`,
      });
    });
  });

  trap.activate();

  // Add message history to chatbot body
  const chatbotBody = document.getElementById("buildship-chat-widget__body")!;
  chatbotBody.prepend(messagesHistory);
  // Add greating message to message history
  if (config.greetingMessage && messagesHistory.children.length === 0) {
    createNewMessageEntry(config.greetingMessage, Date.now(), "system");
  }
  // Inject prefetched thread history to message history
  await injectPrefetchedThreadMessages();
  
  if (config.closeOnOutsideClick) {
    document
      .getElementById(WIDGET_BACKDROP_ID)!
      .addEventListener("click", close);
  }

  formElement?.addEventListener("submit", submit);
}

// Close the widget and clean up
function close() {
  trap.deactivate();

  containerElement.innerHTML = "";

  containerElement.remove();
  optionalBackdrop.remove();
  cleanup();
  cleanup = () => {};
  handleWidgetClosed();
}

// Create a new message entry in the chat history
async function createNewMessageEntry(
  message: string,
  timestamp: number,
  from: "system" | "user"
) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("buildship-chat-widget__message");
  messageElement.classList.add(`buildship-chat-widget__message--${from}`);
  messageElement.id = `buildship-chat-widget__message--${from}--${timestamp}`;

  const messageText = document.createElement("p");
  messageText.innerHTML = await marked(message, { renderer });
  messageElement.appendChild(messageText);

  const messageTimestamp = document.createElement("p");
  messageTimestamp.classList.add("buildship-chat-widget__message-timestamp");
  messageTimestamp.textContent =
    ("0" + new Date(timestamp).getHours()).slice(-2) + // Hours (padded with 0 if needed)
    ":" +
    ("0" + new Date(timestamp).getMinutes()).slice(-2); // Minutes (padded with 0 if needed)
  messageElement.appendChild(messageTimestamp);

  messagesHistory.prepend(messageElement);

}

/*
// Handle standard (non-streamed) response
const handleStandardResponse = async (res: Response) => {
  if (res.ok) {
    const {
      message: responseMessage,
      threadId: responseThreadId,
    }: {
      message: string | undefined;
      threadId: string | undefined;
    } = await res.json();

    if (typeof responseThreadId !== "string") {
      console.error("BuildShip Chat Widget: Server error", res);
      if (!config.disableErrorAlert)
        alert(
          `Received an OK response but "threadId" was of incompatible type (expected 'string', received '${typeof responseThreadId}'). Please make sure the API response is configured correctly.

You can learn more here: https://github.com/rowyio/buildship-chat-widget?tab=readme-ov-file#connecting-the-widget-to-your-buildship-workflow`
        );
      return;
    }

    if (typeof responseMessage !== "string") {
      console.error("BuildShip Chat Widget: Server error", res);
      if (!config.disableErrorAlert)
        alert(
          `Received an OK response but "message" was of incompatible type (expected 'string', received '${typeof responseMessage}'). Please make sure the API response is configured correctly.

You can learn more here: https://github.com/rowyio/buildship-chat-widget?tab=readme-ov-file#connecting-the-widget-to-your-buildship-workflow`
        );
      return;
    }

    if (!responseMessage && responseMessage !== "") {
      console.error("BuildShip Chat Widget: Server error", res);
      if (!config.disableErrorAlert)
        alert(
          `Received an OK response but no message was found. Please make sure the API response is configured correctly. You can learn more here:\n\nhttps://github.com/rowyio/buildship-chat-widget?tab=readme-ov-file#connecting-the-widget-to-your-buildship-workflow`
        );
      return;
    }

    await createNewMessageEntry(responseMessage, Date.now(), "system");
    config.threadId = config.threadId ?? responseThreadId ?? null;
	
    if (config.threadId) {
      markChatAsActive();
      // Set threadId from config to session cookie
	    setSessionCookie(config.threadId); 
      // Add new message to thread history cache
      await appendToThreadHistoryRaw(
        {
          message: responseMessage,
          timestamp: Date.now(),
          from: "system",
        },
        true
      ); 
    }
	
  } else {
    console.error("BuildShip Chat Widget: Server error", res);
    if (!config.disableErrorAlert)
      alert(`Could not send message: ${res.statusText}`);
  }
};
*/

function sanitizeResponseMessage(message: string) {
  return message.replace(/【[^】]*】/g, "");
}

// Stream response to existing or new message entry
async function streamResponseToMessageEntry(
  message: string,
  timestamp: number,
  from: "system" | "user"
) {
  const existingMessageElement = messagesHistory.querySelector(
    `#buildship-chat-widget__message--${from}--${timestamp}`
  );
  if (existingMessageElement) {
    // If the message element already exists, update the text
    const messageText = existingMessageElement.querySelector("p")!;
    messageText.innerHTML = await marked(
      sanitizeResponseMessage(message),
      { renderer }
    );
    return;
  } else {
    // If the message element doesn't exist yet, create a new one
    await createNewMessageEntry(
      sanitizeResponseMessage(message),
      timestamp,
      from
    );
  }
}

// Handle streamed response
const handleStreamedResponse = async (res: Response) => {
  if (!res.body) {
    console.error("BuildShip Chat Widget: Streamed response has no body", res);
    if (!config.disableErrorAlert)
      alert(
        `Received a streamed response but no body was found. Please make sure the API response is configured correctly.`
      );
    return;
  }

  const threadIdFromHeader = res.headers.get("x-thread-id");
  const reader = res.body.getReader();
  let responseMessage = "";
  let responseThreadId = "";
  let responseMessageComplete = false;
  let ts = Date.now();

  while (true) {
    const { value, done } = await reader.read(); 
    if (done || value === undefined) {
      break;
    }
    const decoded = new TextDecoder().decode(value);

    if (decoded.includes("\x1f")) {
      // If the chunk contains the separator character, that marks the end of the message
      // and the beginning of the threadId
      const [message, threadId] = decoded.split("\x1f");
      responseMessage += message;
      responseThreadId += threadId;

      responseMessageComplete = true;
    } else {
      if (responseMessageComplete) {
        // If the message is complete, the chunk will be part of the threadId
        responseThreadId += decoded;
      } else {
        // If the message is not complete yet, the chunk will be part of the message
        responseMessage += decoded;
      }
    }
    await streamResponseToMessageEntry(responseMessage, ts, "system");
  }

  const fallbackResponseMessage = "Sorry, ich konnte deine Anfrage nicht vollständig verarbeiten. Probiere es bitte später erneut.";
  let finalResponseMessage = responseMessage;
  if (!finalResponseMessage.trim()) {
    finalResponseMessage = fallbackResponseMessage;
    await streamResponseToMessageEntry(finalResponseMessage, ts, "system");
  }

  config.threadId =
    config.threadId ??
    threadIdFromHeader ?? // If the threadId isn't set, use the one from the header
    (responseThreadId !== "" ? responseThreadId : null); // If the threadId isn't set and one isn't included in the header, use the one from the response
	
  
  if (config.threadId) {
    markChatAsActive();
    // Set threadId from config to session cookie
	  setSessionCookie(config.threadId);  
      // Add new message to thread history cache
    await appendToThreadHistoryRaw(
      {
        message: finalResponseMessage,
        timestamp: ts,
        from: "system",
      },
      true
    );
  }
};

// Handle form submission
async function submit(e: Event) {
  e.preventDefault();
  const target = e.target as HTMLFormElement;

  if (!config.url) {
    console.error("BuildShip Chat Widget: No URL provided");
    if (!config.disableErrorAlert)
      alert("Could not send chat message: No URL provided");
    return;
  }

  const submitElement = document.getElementById(
    "buildship-chat-widget__submit"
  )!;
  submitElement.setAttribute("disabled", "");

  const requestHeaders = new Headers();
  requestHeaders.append("Content-Type", "application/json");

  const data = {
    ...config.user,
    message: (target.elements as any).message.value,
    threadId: config.threadId,
    timestamp: Date.now(),
  };

  await createNewMessageEntry(data.message, data.timestamp, "user");
  markChatAsActive();
  
  // Add new message to thread history cache (don't update server)
  await appendToThreadHistoryRaw(
    {
      message: data.message,
      timestamp: data.timestamp,
      from: "user",
    },
    false
  );
  target.reset();
  const messageField = (target.elements as any)
    .message as HTMLTextAreaElement | undefined;
  if (messageField) {
    messageField.style.height = "";
    messageField.dispatchEvent(new Event("input"));
  }
  messagesHistory.prepend(thinkingBubble);

  try {
    let response = await fetch(config.url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(data),
    });
    thinkingBubble.remove();

    if (config.responseIsAStream) {
      await handleStreamedResponse(response);
    } /*else {
      await handleStandardResponse(response);
    }*/
  } catch (e: any) {
    thinkingBubble.remove();
    console.error("BuildShip Chat Widget:", e);
    if (!config.disableErrorAlert) {
      alert(`Could not send message: ${e.message}`);
    }
  }

  submitElement.removeAttribute("disabled");
  return false;
}

const buildShipChatWidget = { open, close, config, init };
(window as any).buildShipChatWidget = buildShipChatWidget;
declare global {
  interface Window {
    buildShipChatWidget: typeof buildShipChatWidget;
  }
}

export default buildShipChatWidget;
