import test from "node:test";
import assert from "node:assert/strict";

import {
  isLauncherHiddenByPathFilters,
  normalizeLauncherPathRules,
  normalizePath,
  pathMatchesRule,
  shouldDisplayLauncherForPath,
} from "./launcherPathRules.ts";

test("normalizeLauncherPathRules trims values and removes empty entries", () => {
  assert.deepEqual(normalizeLauncherPathRules([" /docs/* ", "", "   ", "/foo"]), [
    "/docs/*",
    "/foo",
  ]);
});

test("normalizePath normalizes full URLs, missing leading slash, and trailing slash", () => {
  assert.equal(normalizePath("https://example.com/docs/guide/"), "/docs/guide");
  assert.equal(normalizePath("contact/"), "/contact");
  assert.equal(normalizePath("/"), "/");
});

test("pathMatchesRule supports exact, wildcard, and full-page matches", () => {
  assert.equal(pathMatchesRule("/contact", "/contact/"), true);
  assert.equal(pathMatchesRule("/docs/*", "/docs/private/intro"), true);
  assert.equal(pathMatchesRule("*", "/anything"), true);
  assert.equal(pathMatchesRule("/docs/*", "/blog/post"), false);
});

test("shouldDisplayLauncherForPath shows the launcher when no path lists are set", () => {
  assert.equal(
    shouldDisplayLauncherForPath({
      enabled: true,
      launcherVisibilityForced: false,
      restrictToPaths: [],
      hideOnPaths: [],
      currentPath: "/anywhere",
    }),
    true
  );
});

test("shouldDisplayLauncherForPath restricts launcher visibility to included paths", () => {
  assert.equal(
    shouldDisplayLauncherForPath({
      enabled: true,
      launcherVisibilityForced: false,
      restrictToPaths: ["/docs/*"],
      hideOnPaths: [],
      currentPath: "/docs/start",
    }),
    true
  );
  assert.equal(
    shouldDisplayLauncherForPath({
      enabled: true,
      launcherVisibilityForced: false,
      restrictToPaths: ["/docs/*"],
      hideOnPaths: [],
      currentPath: "/pricing",
    }),
    false
  );
});

test("hideOnPaths wins over restrictToPaths when both match", () => {
  assert.equal(
    shouldDisplayLauncherForPath({
      enabled: true,
      launcherVisibilityForced: false,
      restrictToPaths: ["/docs/*"],
      hideOnPaths: ["/docs/private/*"],
      currentPath: "/docs/private/secret",
    }),
    false
  );
});

test("launcherVisibilityForced keeps launcher visible even on excluded paths", () => {
  assert.equal(
    shouldDisplayLauncherForPath({
      enabled: true,
      launcherVisibilityForced: true,
      restrictToPaths: ["/docs/*"],
      hideOnPaths: ["/docs/private/*"],
      currentPath: "/docs/private/secret",
    }),
    true
  );
});

test("isLauncherHiddenByPathFilters mirrors exclusion logic for external triggers", () => {
  assert.equal(
    isLauncherHiddenByPathFilters({
      enabled: true,
      launcherVisibilityForced: false,
      restrictToPaths: [],
      hideOnPaths: ["/checkout"],
      currentPath: "/checkout",
    }),
    true
  );
  assert.equal(
    isLauncherHiddenByPathFilters({
      enabled: true,
      launcherVisibilityForced: false,
      restrictToPaths: ["/docs/*"],
      hideOnPaths: [],
      currentPath: "/pricing",
    }),
    true
  );
  assert.equal(
    isLauncherHiddenByPathFilters({
      enabled: true,
      launcherVisibilityForced: true,
      restrictToPaths: ["/docs/*"],
      hideOnPaths: ["/docs/private/*"],
      currentPath: "/docs/private/secret",
    }),
    false
  );
});
