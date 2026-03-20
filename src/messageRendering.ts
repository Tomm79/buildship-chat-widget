import type { ChatRole } from "./threadHistory";

export function getMessageElementId(from: ChatRole, timestamp: number) {
  return `chat-widget__message--${from}--${timestamp}`;
}

export function formatMessageTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  return `${`0${date.getHours()}`.slice(-2)}:${`0${date.getMinutes()}`.slice(
    -2
  )}`;
}
