import type { AccessibilityAnalysis, AccessibilityIssue, IssueSeverity } from "@/types/analysis";
import type { DomDocument, DomNode } from "@/types/dom";
import { deepText, describeNode } from "@/lib/parser/dom-parser";

const GENERIC_LINK_TEXT = new Set(["click here", "here", "read more", "more", "link", "learn more", "this", "continue", "click", "details", "go"]);
const LANDMARK_TAGS: Record<string, string> = { header: "banner", nav: "navigation", main: "main", footer: "contentinfo", aside: "complementary", form: "form" };

/**
 * Static accessibility heuristics. Score starts at 100 and is reduced per rule:
 *  - images without alt: up to -25 proportional to the share missing
 *  - unlabelled inputs: up to -20
 *  - unnamed buttons: up to -15
 *  - generic/empty link text: up to -10
 *  - missing lang: -10
 *  - heading order problems: -5 each (max -10)
 *  - positive tabindex: -3 each (max -6)
 *  - iframes without title: -2 each (max -6)
 */
export function analyzeAccessibility(dom: DomDocument): AccessibilityAnalysis {
  const issues: AccessibilityIssue[] = [];
  let seq = 0;
  const issue = (rule: string, message: string, node: DomNode | null, severity: IssueSeverity, evidence: string) =>
    issues.push({ id: `a11y-${++seq}`, rule, message, nodeId: node?.id ?? null, severity, evidence });

  const labelFor = new Set<string>();
  const idsWithAria = new Set<string>();
  for (const n of dom.nodes) {
    if (n.tag === "label" && n.attributes.for) labelFor.add(n.attributes.for);
    const lb = n.attributes["aria-labelledby"];
    if (lb) for (const id of lb.split(/\s+/)) idsWithAria.add(id);
  }

  const images = { total: 0, withAlt: 0, decorative: 0, missing: 0 };
  const forms = { inputs: 0, labelled: 0, unlabelled: 0 };
  const buttons = { total: 0, named: 0, unnamed: 0 };
  const links = { total: 0, meaningful: 0, generic: 0, empty: 0 };
  let ariaAttributes = 0, roles = 0, positiveTabindex = 0, iframesWithoutTitle = 0;
  const landmarks = new Set<string>();
  const headingOrder: string[] = [];
  const headingIssues: string[] = [];
  let lastLevel = 0;
  let h1Count = 0;

  const hasAccessibleName = (n: DomNode) => Boolean(n.attributes["aria-label"]?.trim() || n.attributes["aria-labelledby"] || n.attributes.title?.trim());
  const insideLabel = (n: DomNode) => {
    let cur = n.parent;
    while (cur !== null) {
      if (dom.nodes[cur].tag === "label") return true;
      cur = dom.nodes[cur].parent;
    }
    return false;
  };

  for (const n of dom.nodes) {
    const a = n.attributes;
    for (const key of Object.keys(a)) if (key.startsWith("aria-")) ariaAttributes++;
    if (a.role) {
      roles++;
      if (["banner", "navigation", "main", "contentinfo", "complementary", "search", "form", "region"].includes(a.role)) landmarks.add(a.role);
    }
    if (LANDMARK_TAGS[n.tag]) landmarks.add(LANDMARK_TAGS[n.tag]);
    if (a.tabindex && Number(a.tabindex) > 0) {
      positiveTabindex++;
      issue("positive-tabindex", `tabindex="${a.tabindex}" overrides natural focus order`, n, "suggestion", `<${describeNode(n)} tabindex="${a.tabindex}">`);
    }

    switch (n.tag) {
      case "img": {
        images.total++;
        if (a.alt === undefined) {
          if (a.role === "presentation" || a["aria-hidden"] === "true") images.decorative++;
          else {
            images.missing++;
            issue("img-alt", "Image has no alt attribute", n, "critical", `<img src="${(a.src ?? "").slice(0, 80)}">`);
          }
        } else if (a.alt.trim() === "") images.decorative++;
        else images.withAlt++;
        break;
      }
      case "input":
      case "select":
      case "textarea": {
        const type = (a.type ?? "text").toLowerCase();
        if (n.tag === "input" && ["hidden", "submit", "button", "reset", "image"].includes(type)) {
          if (type === "image" && !a.alt) issue("input-image-alt", "Image input has no alt", n, "warning", `<input type="image">`);
          break;
        }
        forms.inputs++;
        const labelled = (a.id && labelFor.has(a.id)) || hasAccessibleName(n) || insideLabel(n) || (a.placeholder && type === "search");
        if (labelled) forms.labelled++;
        else {
          forms.unlabelled++;
          issue("input-label", `Form control has no associated label${a.placeholder ? " (placeholder is not a label)" : ""}`, n, "warning", `<${n.tag}${a.type ? ` type="${a.type}"` : ""}${a.name ? ` name="${a.name}"` : ""}${a.id ? ` id="${a.id}"` : ""}>`);
        }
        break;
      }
      case "button": {
        buttons.total++;
        const text = deepText(dom, n.id, 80).trim();
        const hasImgAlt = n.children.some((c) => dom.nodes[c]?.tag === "img" && dom.nodes[c].attributes.alt?.trim());
        const hasSvgTitle = n.children.some((c) => dom.nodes[c]?.tag === "svg" && (dom.nodes[c].attributes["aria-label"] || dom.nodes[c].children.some((cc) => dom.nodes[cc]?.tag === "title")));
        if (text || hasAccessibleName(n) || hasImgAlt || hasSvgTitle || a.value) buttons.named++;
        else {
          buttons.unnamed++;
          issue("button-name", "Button has no accessible name", n, "critical", `<${describeNode(n)}>`);
        }
        break;
      }
      case "a": {
        if (a.href === undefined) break;
        links.total++;
        const text = deepText(dom, n.id, 80).trim();
        const hasImgAlt = n.children.some((c) => dom.nodes[c]?.tag === "img" && dom.nodes[c].attributes.alt?.trim());
        if (!text && !hasAccessibleName(n) && !hasImgAlt) {
          links.empty++;
          issue("link-name", "Link has no accessible text", n, "critical", `<a href="${(a.href ?? "").slice(0, 80)}">`);
        } else if (text && GENERIC_LINK_TEXT.has(text.toLowerCase().replace(/[.!»›>→]+$/g, "").trim())) {
          links.generic++;
          issue("link-generic", `Link text "${text}" is not descriptive out of context`, n, "suggestion", `<a href="${(a.href ?? "").slice(0, 80)}">${text}</a>`);
        } else links.meaningful++;
        break;
      }
      case "iframe":
        if (!a.title?.trim() && !hasAccessibleName(n)) {
          iframesWithoutTitle++;
          issue("iframe-title", "iframe has no title", n, "warning", `<iframe src="${(a.src ?? "").slice(0, 80)}">`);
        }
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Number(n.tag[1]);
        headingOrder.push(n.tag);
        if (level === 1) h1Count++;
        if (lastLevel && level > lastLevel + 1) {
          const msg = `Heading level skipped: <${n.tag}> follows <h${lastLevel}>`;
          headingIssues.push(msg);
          issue("heading-order", msg, n, "warning", `"${deepText(dom, n.id, 60)}"`);
        }
        lastLevel = level;
        break;
      }
      case "html":
        break;
    }
  }

  const lang = dom.nodes[dom.root]?.attributes.lang?.trim() || null;
  if (!lang) issue("html-lang", "The <html> element has no lang attribute", dom.nodes[dom.root] ?? null, "critical", "<html> without lang");
  if (headingOrder.length && headingOrder[0] !== "h1") {
    const msg = `First heading is <${headingOrder[0]}>, not <h1>`;
    headingIssues.push(msg);
  }
  if (h1Count === 0 && headingOrder.length) headingIssues.push("No <h1> heading present");
  if (h1Count > 1) headingIssues.push(`${h1Count} <h1> headings present`);
  if (!landmarks.has("main")) issue("landmark-main", "No <main> landmark found", null, "suggestion", "No <main> element or role=\"main\"");

  const scoring: string[] = [];
  let score = 100;
  const pen = (label: string, amount: number) => {
    const p = Math.round(amount);
    if (p > 0) {
      score -= p;
      scoring.push(`${label}: -${p}`);
    }
  };
  if (images.total) pen(`Images without alt (${images.missing}/${images.total})`, 25 * (images.missing / images.total));
  if (forms.inputs) pen(`Unlabelled inputs (${forms.unlabelled}/${forms.inputs})`, 20 * (forms.unlabelled / forms.inputs));
  if (buttons.total) pen(`Unnamed buttons (${buttons.unnamed}/${buttons.total})`, 15 * (buttons.unnamed / buttons.total));
  if (links.total) pen(`Empty or generic links (${links.empty + links.generic}/${links.total})`, 10 * ((links.empty + links.generic * 0.5) / links.total));
  if (!lang) pen("Missing lang attribute", 10);
  pen(`Heading order problems (${headingIssues.length})`, Math.min(10, headingIssues.length * 5));
  pen(`Positive tabindex (${positiveTabindex})`, Math.min(6, positiveTabindex * 3));
  pen(`iframes without title (${iframesWithoutTitle})`, Math.min(6, iframesWithoutTitle * 2));
  score = Math.max(0, Math.min(100, score));
  if (!scoring.length) scoring.push("No penalties applied");

  return { score, images, forms, buttons, links, lang, headingIssues, headingOrder, ariaAttributes, roles, landmarks: [...landmarks], positiveTabindex, iframesWithoutTitle, issues, scoring };
}
