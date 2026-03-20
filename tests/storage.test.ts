import test from "node:test";
import assert from "node:assert/strict";

import { getCookieValueFromString } from "../src/storage.ts";

test("getCookieValueFromString extracts and decodes matching cookie values", () => {
  const cookies = "foo=bar; chatThreadID=abc%20123; baz=qux";

  assert.equal(getCookieValueFromString(cookies, "chatThreadID"), "abc 123");
  assert.equal(getCookieValueFromString(cookies, "missing"), null);
});
