import test from "node:test";
import assert from "node:assert/strict";

import {
  appendThreadHistoryEntry,
  convertToThreadHistoryRawEntry,
  mapPrefetchedThreadMessages,
  normalizeThreadHistoryRaw,
} from "../src/threadHistory.ts";

test("normalizeThreadHistoryRaw ensures the expected object structure", () => {
  const normalized = normalizeThreadHistoryRaw(null, "thread-1");

  assert.deepEqual(normalized.value?.data, []);
  assert.equal(normalized.threadId, "thread-1");
});

test("convertToThreadHistoryRawEntry maps widget messages to assistant thread messages", () => {
  const entry = convertToThreadHistoryRawEntry({
    message: "Hallo",
    timestamp: 1_700_000_000_000,
    from: "system",
  });

  assert.equal(entry.role, "assistant");
  assert.equal(entry.created_at, 1_700_000_000);
  assert.equal(entry.content[0].text.value, "Hallo");
});

test("appendThreadHistoryEntry prepends new entries to normalized thread history", () => {
  const updated = appendThreadHistoryEntry(
    { value: { data: [] } },
    {
      message: "Neu",
      timestamp: 1_700_000_000_000,
      from: "user",
    },
    "thread-2"
  );

  assert.equal(updated.threadId, "thread-2");
  assert.equal(Array.isArray(updated.value?.data), true);
  assert.equal(updated.value?.data?.length, 1);
});

test("mapPrefetchedThreadMessages keeps valid text entries in chronological order", () => {
  const mapped = mapPrefetchedThreadMessages([
    {
      role: "assistant",
      created_at: 2,
      content: [{ text: { value: "Zwei" } }],
    },
    {
      role: "user",
      created_at: 1,
      content: [{ text: { value: "Eins" } }],
    },
    {
      role: "assistant",
      created_at: 3,
      content: [{ text: {} }],
    },
  ]);

  assert.deepEqual(mapped, [
    { message: "Eins", timestamp: 1000, from: "user" },
    { message: "Zwei", timestamp: 2000, from: "system" },
  ]);
});
