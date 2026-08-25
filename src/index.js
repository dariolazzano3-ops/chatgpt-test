export default {
  async fetch() {
    return new Response("LIVE TEST 2 ✅ ChatGPT hat GitHub geändert und Cloudflare sollte automatisch neu deployen.", {
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  }
};
