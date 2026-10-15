import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url));
const nav=read('../assets/js/components/nav.js').toString();
const css=read('../assets/css/style.css').toString();
const original=read('../assets/images/brand/logo-donatello.webp');
const transparent=read('../assets/images/brand/logo-donatello-footer-transparent-v114.webp');

test('V114 preserves owner-supplied logo and adds a real transparent source',()=>{
 assert.equal(createHash('sha256').update(original).digest('hex'),'7c5ef473ef426815253ed527831f7eaf74ac92ea8abe3004297f09353e7ae12f');
 assert.ok(transparent.length>12000);
 assert.notDeepEqual(original,transparent);
 assert.match(nav,/logo-donatello-footer-transparent-v114\.webp/);
 assert.match(nav,/width="766" height="86"/);
 assert.match(nav,/alt="/);
 assert.match(nav,/logo-donatello-header\.webp/);
});
test('Footer logo occupies full-width centered grid row with measured mobile sizing',()=>{
 const footer=nav.split('export function renderSiteFooter()',2)[1]||'';
 assert.match(footer,/class="site-footer__inner"/);
 assert.match(footer,/class="site-footer__logo-row"/);
 assert.match(footer,/class="site-footer__logo"/);
 assert.ok(footer.indexOf('site-footer__logo-row')<footer.indexOf('site-footer__brand-block'));
 assert.match(css,/#site-footer \.site-footer__logo-row\{\s*grid-column:1\/-1/);
 assert.match(css,/justify-content:center/);
 assert.match(css,/#site-footer \.site-footer__logo-row \.site-footer__logo\{\s*display:block;\s*width:min\(460px,100%\)/);
 assert.match(css,/width:min\(340px,92vw\)/);
 assert.match(css,/background:transparent/);
 assert.match(css,/object-position:center center/);
});
test('No other footer content or original header logo is changed',()=>{
 const footer=nav.split('export function renderSiteFooter()',2)[1]||'';
 assert.match(footer,/site-footer__brand-block/);
 assert.match(footer,/Familiengeführt seit/);
 assert.match(footer,/site-footer__contact/);
 assert.match(footer,/site-footer__nav/);
 assert.match(footer,/site-footer__legal/);
 assert.match(footer,/Produktiv-Domain unverändert/);
 assert.match(nav,/site-header__logo/);
 assert.match(nav,/logo-donatello-header\.webp/);
});
