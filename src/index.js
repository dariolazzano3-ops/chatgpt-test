export default {
  async fetch() {
    return new Response("ChatGPT → GitHub → Cloudflare funktioniert ✅", {
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  }
};
