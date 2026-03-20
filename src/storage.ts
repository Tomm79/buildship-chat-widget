export const THREAD_ID_COOKIE_NAME = "chatThreadID";

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
  cookieName = THREAD_ID_COOKIE_NAME
) {
  if (value) {
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; path=/`;
  }
}

export function clearSessionCookie(cookieName = THREAD_ID_COOKIE_NAME) {
  document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
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

export function readBooleanFromStorage(key: string) {
  return getStorageItem(key) === "true";
}

export function setBooleanInStorage(key: string, value: boolean) {
  if (value) {
    setStorageItem(key, "true");
  } else {
    removeStorageItem(key);
  }
}
