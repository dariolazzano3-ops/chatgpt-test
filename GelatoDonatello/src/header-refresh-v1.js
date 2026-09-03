import frozen from "./frozen.js";

const HOME_PATHS = new Set(["/", "/index.html"]);

const HEADER_CSS = `
/* Gelato Donatello header refresh: preserve the original wordmark, crop only the right cone trio. */
.gelato-top{
  position:sticky;
  top:0;
  z-index:70;
  display:flex;
  align-items:center;
  gap:clamp(10px,2vw,24px);
  width:100%;
  padding:clamp(12px,1.8vw,18px) clamp(14px,3vw,42px);
  background:#000;
  border-bottom:1px solid rgba(232,196,106,.72);
  box-shadow:0 8px 28px rgba(0,0,0,.12);
  backdrop-filter:none;
}
.gelato-brand{
  flex:1 1 auto;
  min-width:0;
  display:flex;
  align-items:center;
  text-decoration:none;
}
.gelato-brand-crop{
  position:relative;
  display:block;
  width:min(100%,720px);
  aspect-ratio:6 / 1;
  overflow:hidden;
  background:#000;
}
.gelato-brand-crop img{
  width:100%;
  height:100%;
  max-width:none;
  display:block;
  object-fit:cover;
  object-position:left center;
}
.gelato-brand-crop::after{
  content:"";
  position:absolute;
  right:1.2%;
  top:9%;
  bottom:9%;
  width:2px;
  background:#e8c46a;
  pointer-events:none;
}
.gelato-header-actions{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  gap:clamp(8px,1.5vw,14px);
}
.gelato-icon-button{
  width:clamp(48px,5vw,62px);
  height:clamp(48px,5vw,62px);
  padding:0;
  border:1.5px solid #e8c46a;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:#000;
  color:#e8c46a;
  text-decoration:none;
  cursor:pointer;
  list-style:none;
  transition:background-color .18s ease,color .18s ease,transform .18s ease;
}
.gelato-icon-button::-webkit-details-marker{display:none}
.gelato-icon-button svg{width:46%;height:46%;display:block}
.gelato-icon-button:hover,.gelato-icon-button:focus-visible{
  background:#e8c46a;
  color:#000;
  outline:none;
  transform:translateY(-1px);
}
.gelato-menu{position:relative}
.gelato-menu[open]>.gelato-icon-button{background:#e8c46a;color:#000}
.gelato-menu-panel{
  position:absolute;
  top:calc(100% + 12px);
  right:0;
  min-width:178px;
  padding:8px;
  display:grid;
  gap:4px;
  background:#000;
  border:1px solid #e8c46a;
  box-shadow:0 16px 36px rgba(0,0,0,.28);
}
.gelato-menu-panel a{
  padding:11px 12px;
  color:#f4efe4;
  text-decoration:none;
  text-transform:uppercase;
  letter-spacing:.12em;
  font-size:11px;
}
.gelato-menu-panel a:hover,.gelato-menu-panel a:focus-visible{
  background:#e8c46a;
  color:#000;
  outline:none;
}
@media(max-width:620px){
  .gelato-top{gap:9px;padding:12px 12px;min-height:84px}
  .gelato-brand-crop{width:100%;aspect-ratio:6 / 1}
  .gelato-header-actions{gap:8px}
  .gelato-icon-button{width:48px;height:48px}
}
@media(max-width:380px){
  .gelato-top{gap:7px;padding-inline:10px}
  .gelato-icon-button{width:44px;height:44px}
  .gelato-header-actions{gap:6px}
}
`;

const HEADER_HTML = `<header class="top gelato-top"><a class="gelato-brand" href="/" aria-label="Gelato Donatello Startseite"><span class="gelato-brand-crop"><img src="/assets/images/brand/gelato-donatello-logo.png" alt="Gelato Donatello" decoding="async"></span></a><div class="gelato-header-actions"><a class="gelato-icon-button" href="tel:+4968069394980" aria-label="Gelato Donatello anrufen" title="Anrufen"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"></path></svg></a><details class="gelato-menu"><summary class="gelato-icon-button" aria-label="Menü öffnen" title="Menü"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg></summary><nav class="gelato-menu-panel" aria-label="Hauptnavigation"><a href="#sorten">Sorten</a><a href="#besuch">Besuch</a></nav></details></div></header>`;

function decorateHome(html) {
  const withCss = html.includes("</style>")
    ? html.replace("</style>", `${HEADER_CSS}</style>`)
    : html;

  return withCss.replace(/<header class="top">[\s\S]*?<\/header>/, HEADER_HTML);
}

export default {
  async fetch(request, env, ctx) {
    const response = await frozen.fetch(request, env, ctx);
    const url = new URL(request.url);
    const contentType = response.headers.get("content-type") || "";

    if (request.method !== "GET" || !HOME_PATHS.has(url.pathname) || !contentType.includes("text/html")) {
      return response;
    }

    const html = await response.text();
    const headers = new Headers(response.headers);
    headers.delete("content-length");

    return new Response(decorateHome(html), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
