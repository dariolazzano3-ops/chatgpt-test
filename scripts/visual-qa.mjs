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

    await page.screenshot({
      path: path.join(outDir, `${viewport.name}.png`),
      fullPage: true
    });

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const viewportWidth = root.clientWidth;
      const overflow = Math.max(root.scrollWidth, body?.scrollWidth || 0) - viewportWidth;
      const h1 = document.querySelector("h1");
      const main = document.querySelector("main");
      const visibleSections = [...document.querySelectorAll("main section")].filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }).length;

      const overflowElements = [...document.querySelectorAll("body *")]
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const rightOverflow = Math.max(0, rect.right - viewportWidth);
          const leftOverflow = Math.max(0, -rect.left);
          const amount = Math.max(rightOverflow, leftOverflow);
          if (amount <= 1 || rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") return null;
          const id = el.id ? `#${el.id}` : "";
          const classes = typeof el.className === "string" && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).join(".")}`
            : "";
          return {
            selector: `${el.tagName.toLowerCase()}${id}${classes}`,
            left: Math.round(rect.left * 10) / 10,
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            overflowPx: Math.round(amount * 10) / 10
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.overflowPx - a.overflowPx)
        .slice(0, 12);

      return {
        title: document.title,
        hasH1: Boolean(h1 && h1.textContent.trim()),
        hasMain: Boolean(main),
        visibleSections,
        horizontalOverflowPx: Math.max(0, overflow),
        overflowElements,
        bodyTextLength: (body?.innerText || "").trim().length
      };
    });

    const failures = [];
    if (status < 200 || status >= 400) failures.push(`HTTP status ${status}`);
    if (!metrics.hasH1) failures.push("missing visible h1");
    if (!metrics.hasMain) failures.push("missing main element");
    if (metrics.visibleSections < 2) failures.push(`only ${metrics.visibleSections} visible main sections`);
    if (metrics.horizontalOverflowPx > 4) failures.push(`horizontal overflow ${metrics.horizontalOverflowPx}px`);
    if (metrics.bodyTextLength < 80) failures.push("page contains too little visible text");
    if (pageErrors.length) failures.push(`${pageErrors.length} page error(s)`);

    results.push({
      viewport,
      status,
      metrics,
      consoleErrors: consoleErrors.slice(0, 20),
      pageErrors: pageErrors.slice(0, 20),
      failures
    });

    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  version: 2,
  url,
  generated_at: new Date().toISOString(),
  ok: results.every((result) => result.failures.length === 0),
  results
};

await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
