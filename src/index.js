export default {
  async fetch() {
    return new Response("PIPELINE TEST 3 ✅ Branch → Pull Request → main → Cloudflare funktioniert.", {
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  }
};
