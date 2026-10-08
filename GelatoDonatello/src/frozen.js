import snapshot from "./index.js";

const IMAGE_ORIGIN = "https://gelato-donatello.de";

const FLAVOUR_ASSETS = {
  "/assets/images/eissorten/schokolade.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.45.25-500x500.jpeg",
  "/assets/images/eissorten/vanille.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.46.10-500x500.jpeg",
  "/assets/images/eissorten/sahne-kirsch.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.46.51-500x500.jpeg",
  "/assets/images/eissorten/buttermilch-sanddorn.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.47.40-500x500.jpeg",
  "/assets/images/eissorten/nutella.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.48.39-500x500.jpeg",
  "/assets/images/eissorten/walnuss-feige.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.49.09-500x500.jpeg",
  "/assets/images/eissorten/sahne-milchgries-aprikose.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.50.27-1-500x500.jpeg",
  "/assets/images/eissorten/joghurt-passionsfrucht.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.51.19-500x500.jpeg",
  "/assets/images/eissorten/amaretto.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.51.45-500x500.jpeg",
  "/assets/images/eissorten/raffaello.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.53.12-500x500.jpeg",
  "/assets/images/eissorten/quark-holunder.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.55.54-500x500.jpeg",
  "/assets/images/eissorten/omas-kaesekuchen.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.56.45-500x500.jpeg",
  "/assets/images/eissorten/magic-unicorn.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.58.05-500x500.jpeg",
  "/assets/images/eissorten/snickers.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.58.55-500x500.jpeg",
  "/assets/images/eissorten/stracciatella.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-13.59.33-500x500.jpeg",
  "/assets/images/eissorten/cookies.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.00.06-500x500.jpeg",
  "/assets/images/eissorten/haselnuss.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.00.35-500x500.jpeg",
  "/assets/images/eissorten/after-eight.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.01.27-500x500.jpeg",
  "/assets/images/eissorten/malaga.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.01.50-500x500.jpeg",
  "/assets/images/eissorten/tiramisu.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.02.18-500x500.jpeg",
  "/assets/images/eissorten/american-cheesecake.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.03.22-500x500.jpeg",
  "/assets/images/eissorten/quark-granatapfel.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.04.29-500x500.jpeg",
  "/assets/images/eissorten/salziges-erdnuss-karamell.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.06.05-500x500.jpeg",
  "/assets/images/eissorten/mocca.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.26.16-500x500.jpeg",
  "/assets/images/eissorten/bounty.jpeg":"/wp-content/uploads/2019/05/WhatsApp-Image-2019-05-06-at-14.27.41-500x500.jpeg"
};

function esc(s="") { return String(s).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

function legalShell(title, body) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4efe4"><title>${esc(title)} · Gelato Donatello</title><style>*{box-sizing:border-box}body{margin:0;background:#f4efe4;color:#15120f;font-family:Arial,Helvetica,sans-serif}.top{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:18px clamp(18px,5vw,70px);border-bottom:1px solid rgba(21,18,15,.18);background:rgba(244,239,228,.9);backdrop-filter:blur(14px)}.top a{text-decoration:none}.brand{font:500 23px Georgia,serif}.legal{max-width:900px;margin:auto;padding:80px 22px 120px}.legal h1{font:500 clamp(52px,8vw,92px)/.9 Georgia,serif;letter-spacing:-.055em;margin:0 0 45px}.legal h2{font:500 30px Georgia,serif;margin:42px 0 12px}.legal p,.legal li{font-size:16px;line-height:1.65}.back{display:inline-block;margin-top:48px;padding:11px 14px;border:1px solid #15120f;text-decoration:none;text-transform:uppercase;letter-spacing:.1em;font-size:11px}footer{padding:36px clamp(18px,5vw,70px);border-top:1px solid rgba(21,18,15,.18);font-size:12px;display:flex;gap:20px;flex-wrap:wrap}footer a{color:inherit}</style></head><body><header class="top"><a class="brand" href="/">Gelato Donatello</a><a href="/">Startseite</a></header><main class="legal"><h1>${esc(title)}</h1>${body}<a class="back" href="/">← Zurück</a></main><footer><span>© Gelato Donatello GmbH</span><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a></footer></body></html>`;
}

function impressum() {
  return legalShell("Impressum", `
    <h2>Angaben gemäß § 5 DDG</h2>
    <p><strong>Gelato Donatello GmbH</strong><br>Hauptstraße 4<br>66346 Püttlingen</p>
    <h2>Vertreten durch</h2><p>Geschäftsführer: Fabrizio Lazzano</p>
    <h2>Kontakt</h2><p>Telefon: <a href="tel:+4968069394980">06806 9394980</a><br>E-Mail: <a href="mailto:Fabrizio.lazzano@freenet.de">Fabrizio.lazzano@freenet.de</a></p>
    <h2>Registereintrag</h2><p>Amtsgericht Saarbrücken<br>Handelsregister: HRB 103261</p>
    <h2>Umsatzsteuer</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE 306 726 779</p>
    <p><small>Rechtliche Angaben wurden für den eigenständigen Snapshot aus dem vorhandenen Projektbestand übernommen und sollten vor einer endgültigen öffentlichen Freigabe nochmals intern bestätigt werden.</small></p>`);
}

function datenschutz() {
  return legalShell("Datenschutz", `
    <h2>1. Verantwortlicher</h2><p>Gelato Donatello GmbH, Hauptstraße 4, 66346 Püttlingen.<br>E-Mail: <a href="mailto:Fabrizio.lazzano@freenet.de">Fabrizio.lazzano@freenet.de</a></p>
    <h2>2. Bereitstellung der Website</h2><p>Die Website wird über Cloudflare bereitgestellt. Beim Aufruf können technisch erforderliche Verbindungsdaten wie IP-Adresse, Zeitpunkt, aufgerufene Ressource und Browserinformationen verarbeitet werden. Die Verarbeitung dient der sicheren und zuverlässigen Auslieferung der Website.</p>
    <h2>3. Cookies und Analyse</h2><p>Der aktuelle GelatoDonatello-Snapshot setzt selbst keine Marketing- oder Analyse-Cookies ein und verwendet keine eigene Besucher-Datenbank.</p>
    <h2>4. Externe Links</h2><p>Links zu Telefon, E-Mail und Google Maps werden erst aufgerufen, wenn du sie aktiv auswählst. Für die anschließende Datenverarbeitung gelten die Datenschutzbestimmungen des jeweiligen Anbieters.</p>
    <h2>5. Deine Rechte</h2><p>Du hast im Rahmen der gesetzlichen Voraussetzungen insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.</p>
    <h2>6. Kontakt</h2><p>Datenschutzanfragen kannst du an die oben genannte E-Mail-Adresse richten.</p>`);
}

async function serveImage(pathname) {
  let remotePath = FLAVOUR_ASSETS[pathname];
  if (pathname === "/assets/images/brand/gelato-donatello-logo.png") remotePath = "/wp-content/uploads/2019/07/LOGO-Donatello_Neu1.jpg";
  if (!remotePath) return null;
  const target = IMAGE_ORIGIN + remotePath;
  const r = await fetch(target, {cf:{cacheEverything:true,cacheTtl:604800}});
  const h = new Headers(r.headers);
  h.set("cache-control","public, max-age=604800, immutable");
  h.set("x-gelatodonatello-asset-source","official-site-snapshot");
  h.delete("set-cookie");
  return new Response(r.body,{status:r.status,headers:h});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;

    if (request.method === "GET" && (p === "/" || p === "/index.html")) {
      return snapshot.fetch(request, env, ctx);
    }

    if (request.method === "GET" && ["/impressum","/impressum/","/impressum.html"].includes(p)) {
      return new Response(impressum(), {headers:{"content-type":"text/html; charset=UTF-8","cache-control":"public, max-age=3600","x-gelatodonatello-frozen":"1"}});
    }

    if (request.method === "GET" && ["/datenschutz","/datenschutz/","/datenschutz.html"].includes(p)) {
      return new Response(datenschutz(), {headers:{"content-type":"text/html; charset=UTF-8","cache-control":"public, max-age=3600","x-gelatodonatello-frozen":"1"}});
    }

    if (request.method === "GET" && p.startsWith("/assets/images/")) {
      const image = await serveImage(p);
      if (image) return image;
    }

    return new Response("Not Found", {status:404,headers:{"content-type":"text/plain; charset=UTF-8","x-gelatodonatello-frozen":"1"}});
  }
};
