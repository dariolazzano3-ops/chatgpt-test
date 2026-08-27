import { classifyQaReport, buildRepairCss } from './qa-repair-policy.mjs';

function report(issue) {
  return { version: 6, results: [{ viewport: { name: 'mobile' }, failures: [issue.message], issues: [issue] }] };
}

const media = classifyQaReport(report({ code: 'GEOMETRIC_OVERFLOW', message: 'geometric horizontal overflow 42px', details: { overflowElements: [{ selector: 'img.hero-art', tagName: 'img', whiteSpace: 'normal', textLength: 0 }] } }));
if (!media.fixable || media.repairProfiles[0]?.type !== 'MEDIA_CONTAINMENT') throw new Error('media overflow policy failed');
if (!buildRepairCss(media.repairProfiles).includes('img, video, canvas, svg')) throw new Error('media repair css missing');

const text = classifyQaReport(report({ code: 'GEOMETRIC_OVERFLOW', message: 'geometric horizontal overflow 31px', details: { overflowElements: [{ selector: 'p.hero-copy', tagName: 'p', whiteSpace: 'nowrap', textLength: 120 }] } }));
if (!text.fixable || text.repairProfiles[0]?.type !== 'TEXT_WRAP') throw new Error('text overflow policy failed');
const textCss = buildRepairCss(text.repairProfiles);
if (!textCss.includes('overflow-wrap: anywhere') || !textCss.includes('p.hero-copy')) throw new Error('text repair css missing');

const layout = classifyQaReport(report({ code: 'GEOMETRIC_OVERFLOW', message: 'geometric horizontal overflow 18px', details: { overflowElements: [{ selector: 'div.module-grid', tagName: 'div', whiteSpace: 'normal', textLength: 30 }] } }));
if (!layout.fixable || layout.repairProfiles[0]?.type !== 'LAYOUT_CONTAINMENT') throw new Error('layout overflow policy failed');
if (!buildRepairCss(layout.repairProfiles).includes('max-width: 100%')) throw new Error('layout repair css missing');

const scroll = classifyQaReport(report({ code: 'SCROLL_OVERFLOW', message: 'unexplained scroll overflow 96px', details: { overflowElements: [] } }));
if (!scroll.fixable || scroll.repairProfiles[0]?.type !== 'VIEWPORT_CONTAINMENT') throw new Error('scroll overflow policy failed');
if (!buildRepairCss(scroll.repairProfiles).includes('overflow-x: clip')) throw new Error('viewport repair css missing');

const unsafe = classifyQaReport(report({ code: 'PAGE_ERROR', message: '1 page error(s)', details: {} }));
if (unsafe.fixable) throw new Error('page errors must never auto-fix');

const mixed = { version: 6, results: [{ viewport: { name: 'mobile' }, failures: ['geometric horizontal overflow 20px', 'HTTP status 500'], issues: [
  { code: 'GEOMETRIC_OVERFLOW', message: 'geometric horizontal overflow 20px', details: { overflowElements: [{ selector: 'div.grid', tagName: 'div', whiteSpace: 'normal', textLength: 5 }] } },
  { code: 'HTTP_STATUS', message: 'HTTP status 500', details: { status: 500 } }
] }] };
if (classifyQaReport(mixed).fixable) throw new Error('mixed unsafe failures must stop auto-fix');

const legacy = classifyQaReport({ version: 5, results: [{ viewport: { name: 'mobile' }, failures: ['unexplained scroll overflow 12px'] }] });
if (!legacy.fixable || legacy.repairProfiles[0]?.type !== 'VIEWPORT_CONTAINMENT') throw new Error('legacy report compatibility failed');

console.log('QA repair policy smoke: structured classification and bounded repair profiles passed');
