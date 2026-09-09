import type { RobotsInfo } from "@/types/page";
import { USER_AGENT } from "./security";

/**
 * Parse robots.txt and decide whether `path` is allowed for a given agent.
 * Follows the standard longest-match rule between Allow and Disallow.
 */
export function isPathAllowed(robotsTxt: string, path: string, agent = "domscope"): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  const groups: { agents: string[]; rules: { type: "allow" | "disallow"; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ type: key, path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const agentLower = agent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agentLower.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  let best: { type: "allow" | "disallow"; len: number } | null = null;
  for (const g of applicable) {
    for (const rule of g.rules) {
      if (!rule.path) continue; // "Disallow:" empty = allow all
      if (matchRobotsPath(rule.path, path)) {
        if (!best || rule.path.length > best.len || (rule.path.length === best.len && rule.type === "allow")) {
          best = { type: rule.type, len: rule.path.length };
        }
      }
    }
  }
  return !best || best.type === "allow";
}

function matchRobotsPath(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const anchored = escaped.endsWith("\\$") ? `^${escaped.slice(0, -2)}$` : `^${escaped}`;
  try {
    return new RegExp(anchored).test(path);
  } catch {
    return false;
  }
}

/** Fetch robots.txt (best effort, small, short timeout) and report status. */
export async function checkRobots(target: URL): Promise<RobotsInfo> {
  const robotsUrl = `${target.protocol}//${target.host}/robots.txt`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": USER_AGENT, accept: "text/plain" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return { status: "unavailable", detail: `robots.txt returned HTTP ${res.status}` };
    const text = (await res.text()).slice(0, 200_000);
    const allowed = isPathAllowed(text, target.pathname + target.search);
    return allowed
      ? { status: "allowed", detail: "robots.txt does not disallow this path for DOMScope." }
      : { status: "disallowed", detail: "robots.txt disallows this path for crawlers; analysis is a single, non-recursive fetch." };
  } catch {
    return { status: "unavailable", detail: "robots.txt could not be retrieved." };
  } finally {
    clearTimeout(timer);
  }
}
