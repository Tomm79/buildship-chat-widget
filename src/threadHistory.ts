export type ChatRole = "system" | "user";

export type PrefetchedThreadMessage = {
  message: string;
  timestamp: number;
  from: ChatRole;
};

export type ThreadHistoryRawMessage = {
  message: string;
  timestamp: number;
  from: ChatRole;
};

export type ThreadHistoryRaw = {
  value?: {
    data?: unknown[];
  };
  [key: string]: unknown;
};

export function normalizeThreadHistoryRaw(
  raw: ThreadHistoryRaw | null | undefined,
  threadId?: string | null
): ThreadHistoryRaw {
  const normalized =
    raw && typeof raw === "object" ? raw : { value: { data: [] } };

  if (!normalized.value || typeof normalized.value !== "object") {
    normalized.value = { data: [] };
  }

  if (!Array.isArray(normalized.value.data)) {
    normalized.value.data = [];
  }

  if (threadId) {
    normalized.threadId = threadId;
  }

  return normalized;
}

export function convertToThreadHistoryRawEntry({
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

export function appendThreadHistoryEntry(
  raw: ThreadHistoryRaw | null | undefined,
  entry: ThreadHistoryRawMessage,
  threadId?: string | null
): ThreadHistoryRaw {
  const normalized = normalizeThreadHistoryRaw(raw, threadId);
  normalized.value!.data!.unshift(convertToThreadHistoryRawEntry(entry));
  return normalized;
}

export function mapChatRole(role: unknown): ChatRole {
  return role === "user" ? "user" : "system";
}

export function normalizeTimestamp(input: unknown): number {
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

export function mapPrefetchedThreadMessages(
  rawMessages: unknown[]
): PrefetchedThreadMessage[] {
  return rawMessages
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
    .filter((entry): entry is PrefetchedThreadMessage => entry !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}
