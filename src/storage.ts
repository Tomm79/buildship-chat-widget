export const THREAD_ID_COOKIE_NAME = "chatThreadID";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const COOKIE_SAME_SITE = "Lax";

type ExpiringStorageValue = {
  value: string;
  expiresAt: number;
};

export function getCookieValueFromString(
  cookies: string,
  name: string
): string | null {
  const values = cookies ? cookies.split(";") : [];
  for (const cookie of values) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName.trim() === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function getCookieValue(
  name: string,
  cookieString = document.cookie
): string | null {
  return getCookieValueFromString(cookieString, name);
}

export function setSessionCookie(
  value: string,
  cookieName = THREAD_ID_COOKIE_NAME,
  protocol = window.location.protocol,
  maxAgeSeconds?: number
) {
  if (value) {
    document.cookie = buildSessionCookieString(
      value,
      cookieName,
      protocol,
      maxAgeSeconds
    );
  }
}

export function clearSessionCookie(cookieName = THREAD_ID_COOKIE_NAME) {
  document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
}

export function buildSessionCookieString(
  value: string,
  cookieName = THREAD_ID_COOKIE_NAME,
  protocol = window.location.protocol,
  maxAgeSeconds?: number
) {
  const cookieSegments = [
    `${cookieName}=${encodeURIComponent(value)}`,
    "path=/",
    `SameSite=${COOKIE_SAME_SITE}`,
  ];
  if (Number.isFinite(maxAgeSeconds) && (maxAgeSeconds as number) > 0) {
    cookieSegments.push(`Max-Age=${Math.floor(maxAgeSeconds as number)}`);
  }
  if (protocol === "https:") {
    cookieSegments.push("Secure");
  }
  return cookieSegments.join("; ");
}

export function getStorageItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function removeStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function serializeExpiringStorageValue(value: string, ttlMs: number) {
  const record: ExpiringStorageValue = {
    value,
    expiresAt: Date.now() + ttlMs,
  };
  return JSON.stringify(record);
}

function parseExpiringStorageValue(rawValue: string): ExpiringStorageValue | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<ExpiringStorageValue>;
    if (
      !parsed ||
      typeof parsed.value !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }
    return {
      value: parsed.value,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function setStorageItemWithExpiry(key: string, value: string, ttlMs: number) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    removeStorageItem(key);
    return;
  }
  setStorageItem(key, serializeExpiringStorageValue(value, ttlMs));
}

export function getStorageItemWithExpiry(key: string) {
  const rawValue = getStorageItem(key);
  if (rawValue === null) {
    return null;
  }
  const parsed = parseExpiringStorageValue(rawValue);
  if (!parsed) {
    removeStorageItem(key);
    return null;
  }
  if (parsed.expiresAt <= Date.now()) {
    removeStorageItem(key);
    return null;
  }
  return parsed.value;
}

export function readBooleanFromStorage(key: string) {
  const rawValue = getStorageItem(key);
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === null) {
    return false;
  }
  return getStorageItemWithExpiry(key) === "true";
}

export function touchBooleanInStorage(
  key: string,
  ttlMs = DAY_IN_MS
) {
  const rawValue = getStorageItem(key);
  if (rawValue === null) {
    return false;
  }

  if (rawValue === "true") {
    setBooleanInStorage(key, true, ttlMs);
    return Number.isFinite(ttlMs) && ttlMs > 0;
  }

  const parsed = parseExpiringStorageValue(rawValue);
  if (!parsed) {
    removeStorageItem(key);
    return false;
  }
  if (parsed.expiresAt <= Date.now()) {
    removeStorageItem(key);
    return false;
  }
  if (parsed.value !== "true") {
    removeStorageItem(key);
    return false;
  }

  setBooleanInStorage(key, true, ttlMs);
  return Number.isFinite(ttlMs) && ttlMs > 0;
}

export function setBooleanInStorage(
  key: string,
  value: boolean,
  ttlMs = DAY_IN_MS
) {
  if (value) {
    setStorageItemWithExpiry(key, "true", ttlMs);
  } else {
    removeStorageItem(key);
  }
}
