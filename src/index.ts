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
// end session cookie

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
  urlFetchThreadHistory: string | null;
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
  responseIsAStream: false,
  user: {},
  widgetTitle: "Chatbot",
  greetingMessage: null,
  disableErrorAlert: false,
  closeOnOutsideClick: true,
  openOnLoad: false,
  linkTarget: "self",
  urlFetchThreadHistory: null,
  ...(window as any).buildShipChatWidget?.config,
};

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
    const rawMessages: any[] = Array.isArray(payload?.value?.data)
      ? payload.value.data
      : [];

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
async function init() {
  const styleElement = document.createElement("style");
  styleElement.innerHTML = css;
console.log(config);
  document.head.insertBefore(styleElement, document.head.firstChild);

  // Slight delay to allow DOMContent to be fully loaded
  // (particularly for the button to be available in the `if (config.openOnLoad)` block below).
  await new Promise((resolve) => setTimeout(resolve, 500));

  document
    .querySelector("[data-buildship-chat-widget-button]")
    ?.addEventListener("click", open);

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

  if (config.openOnLoad) {
    if (prefetchedThreadMessagesPromise) {
      try {
        await prefetchedThreadMessagesPromise;
      } catch {
        // continue opening even if history failed to load
      }
    }
    const target = document.querySelector(
      "[data-buildship-chat-widget-button]"
    );
    await open({ target } as Event);
  }
}
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
  if (config.closeOnOutsideClick) {
    document.body.appendChild(optionalBackdrop);
  }

  document.body.appendChild(containerElement);
  containerElement.innerHTML = widgetHTML;
  containerElement.style.display = "block";

  const chatbotHeaderTitleText = document.createElement("span");
  chatbotHeaderTitleText.id = "buildship-chat-widget__title_text";
  chatbotHeaderTitleText.textContent = config.widgetTitle;
  const chatbotHeaderTitle = document.getElementById(
    "buildship-chat-widget__title"
  )!;
  chatbotHeaderTitle.appendChild(chatbotHeaderTitleText);

  const chatbotBody = document.getElementById("buildship-chat-widget__body")!;
  chatbotBody.prepend(messagesHistory);
  // Inject prefetched history before showing optional greeting.
  await injectPrefetchedThreadMessages();

  if (config.greetingMessage && messagesHistory.children.length === 0) {
    createNewMessageEntry(config.greetingMessage, Date.now(), "system");
  }

  const target = (e?.target as HTMLElement) || document.body;
  cleanup = autoUpdate(target, containerElement, () => {
    computePosition(target, containerElement, {
      placement: "top-start",
      middleware: [flip(), shift({ crossAxis: true, padding: 8 })],
      strategy: "fixed",
    }).then(({ x, y }) => {
      Object.assign(containerElement.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  });

  trap.activate();

  if (config.closeOnOutsideClick) {
    document
      .getElementById(WIDGET_BACKDROP_ID)!
      .addEventListener("click", close);
  }

  document
    .getElementById("buildship-chat-widget__form")!
    .addEventListener("submit", submit);
}

function close() {
  trap.deactivate();

  containerElement.innerHTML = "";

  containerElement.remove();
  optionalBackdrop.remove();
  cleanup();
  cleanup = () => {};
}

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
	
	// Set threadId from config to session cookie
    if (config.threadId) {
	    setSessionCookie(config.threadId);  
    }
	
  } else {
    console.error("BuildShip Chat Widget: Server error", res);
    if (!config.disableErrorAlert)
      alert(`Could not send message: ${res.statusText}`);
  }
};

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
    messageText.innerHTML = await marked(message, { renderer });
    return;
  } else {
    // If the message element doesn't exist yet, create a new one
    await createNewMessageEntry(message, timestamp, from);
  }
}

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

  config.threadId =
    config.threadId ??
    threadIdFromHeader ?? // If the threadId isn't set, use the one from the header
    (responseThreadId !== "" ? responseThreadId : null); // If the threadId isn't set and one isn't included in the header, use the one from the response
	
  // Set threadId from config to session cookie
  if (config.threadId) {
	  setSessionCookie(config.threadId);  
  }
};

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
  target.reset();
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
    } else {
      await handleStandardResponse(response);
    }
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
