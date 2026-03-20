import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSessionCookieString,
  getCookieValueFromString,
  getStorageItem,
  getStorageItemWithExpiry,
  readBooleanFromStorage,
  setBooleanInStorage,
  setStorageItem,
  setStorageItemWithExpiry,
  touchBooleanInStorage,
} from "../src/storage.ts";

type LocalStorageMap = Record<string, string>;

function createMockLocalStorage(initial: LocalStorageMap = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

function setupWindowWithStorage(protocol = "https:", initial: LocalStorageMap = {}) {
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = {
    localStorage: createMockLocalStorage(initial),
    location: { protocol },
  };
  return () => {
    (globalThis as any).window = previousWindow;
  };
}

function withMockedNow(nowMs: number) {
  const originalDateNow = Date.now;
  Date.now = () => nowMs;
  return () => {
    Date.now = originalDateNow;
  };
}

test("getCookieValueFromString extracts and decodes matching cookie values", () => {
  const cookies = "foo=bar; chatThreadID=abc%20123; baz=qux";

  assert.equal(getCookieValueFromString(cookies, "chatThreadID"), "abc 123");
  assert.equal(getCookieValueFromString(cookies, "missing"), null);
});

test("buildSessionCookieString sets SameSite and Secure on https", () => {
  const cookie = buildSessionCookieString(
    "abc 123",
    "chatThreadID",
    "https:",
    2_592_000
  );
  assert.equal(
    cookie,
    "chatThreadID=abc%20123; path=/; SameSite=Lax; Max-Age=2592000; Secure"
  );
});

test("buildSessionCookieString omits Secure on http", () => {
  const cookie = buildSessionCookieString(
    "abc 123",
    "chatThreadID",
    "http:",
    2_592_000
  );
  assert.equal(
    cookie,
    "chatThreadID=abc%20123; path=/; SameSite=Lax; Max-Age=2592000"
  );
});

test("buildSessionCookieString omits Max-Age for invalid ttl", () => {
  const cookie = buildSessionCookieString("abc 123", "chatThreadID", "https:", 0);
  assert.equal(cookie, "chatThreadID=abc%20123; path=/; SameSite=Lax; Secure");
});

test("getStorageItemWithExpiry returns active value before expiration", () => {
  const restoreWindow = setupWindowWithStorage();
  const restoreTimeSet = withMockedNow(1_000);
  setStorageItemWithExpiry("chat-widget:pinned-open", "true", 1_000);
  restoreTimeSet();

  const restoreTimeRead = withMockedNow(1_500);
  assert.equal(getStorageItemWithExpiry("chat-widget:pinned-open"), "true");
  restoreTimeRead();
  restoreWindow();
});

test("getStorageItemWithExpiry deletes expired values", () => {
  const restoreWindow = setupWindowWithStorage();
  const restoreTimeSet = withMockedNow(1_000);
  setStorageItemWithExpiry("chat-widget:active-chat", "true", 1_000);
  restoreTimeSet();

  const restoreTimeRead = withMockedNow(2_100);
  assert.equal(getStorageItemWithExpiry("chat-widget:active-chat"), null);
  assert.equal(getStorageItem("chat-widget:active-chat"), null);
  restoreTimeRead();
  restoreWindow();
});

test("readBooleanFromStorage keeps compatibility with legacy true values", () => {
  const restoreWindow = setupWindowWithStorage();
  setStorageItem("chat-widget:legacy", "true");
  assert.equal(readBooleanFromStorage("chat-widget:legacy"), true);
  restoreWindow();
});

test("readBooleanFromStorage cleans up malformed ttl entries", () => {
  const restoreWindow = setupWindowWithStorage();
  setStorageItem("chat-widget:broken", "{not-valid-json");
  assert.equal(readBooleanFromStorage("chat-widget:broken"), false);
  assert.equal(getStorageItem("chat-widget:broken"), null);
  restoreWindow();
});

test("setBooleanInStorage stores ttl payload and removes false values", () => {
  const restoreWindow = setupWindowWithStorage();
  const restoreTimeSet = withMockedNow(500);
  setBooleanInStorage("chat-widget:flag", true, 2_000);
  restoreTimeSet();

  const stored = getStorageItem("chat-widget:flag");
  assert.notEqual(stored, null);
  const parsed = JSON.parse(stored!);
  assert.equal(parsed.value, "true");
  assert.equal(parsed.expiresAt, 2_500);

  setBooleanInStorage("chat-widget:flag", false, 2_000);
  assert.equal(getStorageItem("chat-widget:flag"), null);
  restoreWindow();
});

test("touchBooleanInStorage renews ttl for active expiring value", () => {
  const restoreWindow = setupWindowWithStorage();
  const restoreSetTime = withMockedNow(1_000);
  setStorageItemWithExpiry("chat-widget:active-chat", "true", 1_000);
  restoreSetTime();

  const restoreTouchTime = withMockedNow(1_500);
  assert.equal(touchBooleanInStorage("chat-widget:active-chat", 2_000), true);
  const stored = getStorageItem("chat-widget:active-chat");
  assert.notEqual(stored, null);
  const parsed = JSON.parse(stored!);
  assert.equal(parsed.value, "true");
  assert.equal(parsed.expiresAt, 3_500);
  restoreTouchTime();
  restoreWindow();
});

test("touchBooleanInStorage removes expired values and returns false", () => {
  const restoreWindow = setupWindowWithStorage();
  const restoreSetTime = withMockedNow(1_000);
  setStorageItemWithExpiry("chat-widget:launcher-forced", "true", 1_000);
  restoreSetTime();

  const restoreTouchTime = withMockedNow(2_100);
  assert.equal(touchBooleanInStorage("chat-widget:launcher-forced", 2_000), false);
  assert.equal(getStorageItem("chat-widget:launcher-forced"), null);
  restoreTouchTime();
  restoreWindow();
});

test("touchBooleanInStorage migrates legacy true values to ttl format", () => {
  const restoreWindow = setupWindowWithStorage();
  setStorageItem("chat-widget:pinned-open", "true");

  const restoreTouchTime = withMockedNow(3_000);
  assert.equal(touchBooleanInStorage("chat-widget:pinned-open", 2_000), true);
  const stored = getStorageItem("chat-widget:pinned-open");
  assert.notEqual(stored, null);
  const parsed = JSON.parse(stored!);
  assert.equal(parsed.value, "true");
  assert.equal(parsed.expiresAt, 5_000);
  restoreTouchTime();
  restoreWindow();
});
