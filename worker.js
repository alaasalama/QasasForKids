// Log any unhandled errors so they appear in tail/dashboard
addEventListener('unhandledrejection', (event) => {
  try {
    console.error('unhandledrejection', event?.reason || event);
  } catch {}
});

addEventListener('error', (event) => {
  try {
    console.error('error', event?.error || event?.message || event);
  } catch {}
});

export default {
  async fetch(request, env, ctx) {
    const reqId = crypto.randomUUID?.() || Date.now().toString();
    try {
      console.log('request:start', { id: reqId, url: request.url, method: request.method });

      // Serve static assets first
      const assetRes = await env.ASSETS.fetch(request);

      const GA_ID = env.GA_ID;
      const CONTACT_EMAIL = env.CONTACT_EMAIL;

      const ct = assetRes.headers.get('content-type') || '';

      // Always add marker headers so we can see Worker involvement, even for non-HTML
      const baseHeaders = new Headers(assetRes.headers);
      baseHeaders.set('x-worker-active', '1');
      baseHeaders.set('x-ga-configured', GA_ID ? '1' : '0');
      baseHeaders.set('x-contact-configured', CONTACT_EMAIL ? '1' : '0');

      if (!ct.includes('text/html')) {
        console.log('request:end', { id: reqId, status: assetRes.status });
        return new Response(assetRes.body, { status: assetRes.status, statusText: assetRes.statusText, headers: baseHeaders });
      }

      // HTML: optionally inject GA + contact email
      const rewriter = new HTMLRewriter();

      if (GA_ID) {
        const snippet = `\n<script>(function(w,d){\n  if(w._gaInjected) return; w._gaInjected = true;\n  if(!d.getElementById('ga-gtag-js')){\n    var s=d.createElement('script'); s.id='ga-gtag-js'; s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';\n    (d.head||d.documentElement).appendChild(s);\n  }\n  w.dataLayer=w.dataLayer||[];\n  function gtag(){w.dataLayer.push(arguments);}\n  if(!w._gaInit){ gtag('js', new Date()); gtag('config', '${GA_ID}'); w._gaInit=true; }\n})(window,document);</script>\n`;
        rewriter.on('head', { element(el) { el.append(snippet, { html: true }); } });
      }

      if (CONTACT_EMAIL) {
        rewriter.on('form#contact-form', {
          element(el) {
            if (!el.getAttribute('data-email')) el.setAttribute('data-email', CONTACT_EMAIL);
          }
        });
      }

      const transformed = rewriter.transform(assetRes);
      const headers = new Headers(transformed.headers);
      headers.set('x-worker-active', '1');
      headers.set('x-ga-configured', GA_ID ? '1' : '0');
      headers.set('x-contact-configured', CONTACT_EMAIL ? '1' : '0');

      console.log('request:end', { id: reqId, status: transformed.status });
      return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers });
    } catch (err) {
      // Log the stack so it shows up in tail/dashboard
      console.error('request:error', { id: reqId, url: request.url, message: err?.message || String(err), stack: err?.stack });
      return new Response('Internal Error', { status: 500, headers: { 'x-worker-active': '1' } });
    }
  }
};
