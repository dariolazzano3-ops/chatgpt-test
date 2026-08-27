import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2];
const outDir = process.argv[3] || "visual-qa";

if (!url || !/^https:\/\//i.test(url)) {
  console.error("Usage: node scripts/visual-qa.mjs <https-url> [output-dir]");
  process.exit(2);
}

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const viewports = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 844 }
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const status = response?.status() || 0;

    await page.screenshot({ path: path.join(outDir, `${viewport.name}.png`), fullPage: true });

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const viewportWidth = root.clientWidth;
      const rootScrollWidth = root.scrollWidth;
      const bodyScrollWidth = body?.scrollWidth || 0;
      const scrollOverflow = Math.max(rootScrollWidth, bodyScrollWidth) - viewportWidth;
      const rootStyle = getComputedStyle(root);
      const bodyStyle = body ? getComputedStyle(body) : null;
      const h1 = document.querySelector("h1");
      const main = document.querySelector("main");
      const protectedLogin = document.title === "RIOSYSTEMS Login" || /dashboard access/i.test(h1?.textContent || "");

      const selectorFor = (el) => {
        const id = el.id ? `#${el.id}` : "";
        const classes = typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).join(".")}`
          : "";
        return `${el.tagName.toLowerCase()}${id}${classes}`;
      };

      const visibleSections = [...document.querySelectorAll("main section")].filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }).length;

      const visibleElementRects = [...document.querySelectorAll("body *")]
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") return null;
          return { el, rect, style };
        })
        .filter(Boolean);

      const overflowElements = visibleElementRects
        .map(({ el, rect, style }) => {
          const rightOverflow = Math.max(0, rect.right - viewportWidth);
          const leftOverflow = Math.max(0, -rect.left);
          const amount = Math.max(rightOverflow, leftOverflow);
          if (amount <= 1) return null;
          return {
            selector: selectorFor(el),
            tagName: el.tagName.toLowerCase(),
            display: style.display,
            position: style.position,
            whiteSpace: style.whiteSpace,
            textLength: (el.textContent || "").trim().length,
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            overflowPx: Math.round(amount * 10) / 10
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.overflowPx - a.overflowPx)
        .slice(0, 12);

      const geometricBounds = visibleElementRects.reduce((acc, { rect }) => ({
        minLeft: Math.min(acc.minLeft, rect.left),
        maxRight: Math.max(acc.maxRight, rect.right)
      }), { minLeft: 0, maxRight: viewportWidth });
      const geometricOverflow = Math.max(0, geometricBounds.maxRight - viewportWidth, -geometricBounds.minLeft);

      const pseudoCandidates = [...document.querySelectorAll("body, body *")]
        .flatMap((el) => ["::before", "::after"].map((pseudo) => {
          const style = getComputedStyle(el, pseudo);
          const content = style.content;
          if (!content || content === "none" || content === "normal") return null;
          const position = style.position;
          const potentiallyViewportAffecting = position === "absolute" || position === "fixed" || style.transform !== "none" || style.filter !== "none";
          if (!potentiallyViewportAffecting) return null;
          return {
            selector: `${selectorFor(el)}${pseudo}`,
            position,
            left: style.left,
            right: style.right,
            width: style.width,
            transform: style.transform,
            filter: style.filter,
            overflowX: style.overflowX
          };
        }))
        .filter(Boolean)
        .slice(0, 20);

      const scrollOnlyOverflow = scrollOverflow > 4 && geometricOverflow <= 4 && overflowElements.length === 0;
      const clippingPresent = rootStyle.overflowX === "hidden" || rootStyle.overflowX === "clip" || bodyStyle?.overflowX === "hidden" || bodyStyle?.overflowX === "clip";
      const overflowClassification = geometricOverflow > 4
        ? "geometric"
        : scrollOnlyOverflow && clippingPresent
          ? "scroll-only-clipped"
          : scrollOnlyOverflow
            ? "scroll-only-unclipped"
            : "none";

      return {
        title: document.title,
        protectedLogin,
        hasH1: Boolean(h1 && h1.textContent.trim()),
        hasMain: Boolean(main),
        visibleSections,
        horizontalOverflowPx: Math.max(0, scrollOverflow),
        scrollOverflowPx: Math.max(0, scrollOverflow),
        geometricOverflowPx: Math.round(geometricOverflow * 10) / 10,
        overflowClassification,
        documentWidths: {
          innerWidth: window.innerWidth,
          rootClientWidth: root.clientWidth,
          rootScrollWidth,
          bodyClientWidth: body?.clientWidth || 0,
          bodyScrollWidth,
          rootOverflowX: rootStyle.overflowX,
          bodyOverflowX: bodyStyle?.overflowX || null
        },
        overflowElements,
        pseudoCandidates,
        bodyTextLength: (body?.innerText || "").trim().length
      };
    });

    const failures = [];
    const warnings = [];
    const issues = [];
    const addFailure = (code, message, details = {}) => {
      failures.push(message);
      issues.push({ code, message, details });
    };

    if (status < 200 || status >= 400) addFailure("HTTP_STATUS", `HTTP status ${status}`, { status });
    if (!metrics.hasH1) addFailure("MISSING_H1", "missing visible h1");
    if (!metrics.hasMain) addFailure("MISSING_MAIN", "missing main element");
    if (!metrics.protectedLogin && metrics.visibleSections < 2) addFailure("TOO_FEW_SECTIONS", `only ${metrics.visibleSections} visible main sections`, { visibleSections: metrics.visibleSections });
    if (metrics.protectedLogin) warnings.push("protected preview detected; QA validated login gate and viewport safety");
    if (metrics.geometricOverflowPx > 4) {
      addFailure("GEOMETRIC_OVERFLOW", `geometric horizontal overflow ${metrics.geometricOverflowPx}px`, {
        overflowPx: metrics.geometricOverflowPx,
        overflowElements: metrics.overflowElements
      });
    } else if (metrics.overflowClassification === "scroll-only-unclipped") {
      addFailure("SCROLL_OVERFLOW", `unexplained scroll overflow ${metrics.scrollOverflowPx}px`, {
        overflowPx: metrics.scrollOverflowPx,
        overflowElements: metrics.overflowElements,
        pseudoCandidates: metrics.pseudoCandidates
      });
    } else if (metrics.overflowClassification === "scroll-only-clipped") {
      warnings.push(`clipped scroll-width overflow ${metrics.scrollOverflowPx}px without geometric overflow`);
    }
    if (!metrics.protectedLogin && metrics.bodyTextLength < 80) addFailure("TOO_LITTLE_TEXT", "page contains too little visible text", { bodyTextLength: metrics.bodyTextLength });
    if (pageErrors.length) addFailure("PAGE_ERROR", `${pageErrors.length} page error(s)`, { pageErrors: pageErrors.slice(0, 20) });

    results.push({
      viewport,
      status,
      metrics,
      consoleErrors: consoleErrors.slice(0, 20),
      pageErrors: pageErrors.slice(0, 20),
      warnings,
      failures,
      issues
    });

    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  version: 6,
  url,
  generated_at: new Date().toISOString(),
  ok: results.every((result) => result.failures.length === 0),
  results
};

await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
