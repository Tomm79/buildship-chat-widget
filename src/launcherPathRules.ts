export type LauncherPathVisibilityOptions = {
  enabled: boolean;
  launcherVisibilityForced: boolean;
  restrictToPaths: string[];
  hideOnPaths: string[];
  currentPath: string;
};

export function normalizeLauncherPathRules(paths: string[]) {
  return paths.map((path) => path.trim()).filter(Boolean);
}

export function normalizePath(path: string) {
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

export function pathMatchesRule(rule: string, currentPath: string) {
  const trimmedRule = rule.trim();
  if (!trimmedRule) {
    return false;
  }
  if (trimmedRule === "*") {
    return true;
  }
  const hasWildcard = trimmedRule.endsWith("*");
  const ruleWithoutWildcard = hasWildcard
    ? trimmedRule.slice(0, -1)
    : trimmedRule;
  const normalizedRule = normalizePath(ruleWithoutWildcard);
  const normalizedCurrentPath = normalizePath(currentPath);
  if (hasWildcard) {
    return normalizedCurrentPath.startsWith(normalizedRule);
  }
  return normalizedCurrentPath === normalizedRule;
}

export function pathMatchesAnyRule(rules: string[], currentPath: string) {
  return rules.some((rule) => pathMatchesRule(rule, currentPath));
}

export function shouldDisplayLauncherForPath({
  enabled,
  launcherVisibilityForced,
  restrictToPaths,
  hideOnPaths,
  currentPath,
}: LauncherPathVisibilityOptions) {
  if (!enabled) {
    return false;
  }
  if (launcherVisibilityForced) {
    return true;
  }
  if (hideOnPaths.length && pathMatchesAnyRule(hideOnPaths, currentPath)) {
    return false;
  }
  if (!restrictToPaths.length) {
    return true;
  }
  return pathMatchesAnyRule(restrictToPaths, currentPath);
}

export function isLauncherHiddenByPathFilters({
  enabled,
  launcherVisibilityForced,
  restrictToPaths,
  hideOnPaths,
  currentPath,
}: LauncherPathVisibilityOptions) {
  if (!enabled || launcherVisibilityForced) {
    return false;
  }
  if (hideOnPaths.length && pathMatchesAnyRule(hideOnPaths, currentPath)) {
    return true;
  }
  if (!restrictToPaths.length) {
    return false;
  }
  return !pathMatchesAnyRule(restrictToPaths, currentPath);
}
