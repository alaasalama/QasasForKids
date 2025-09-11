export default {
  async fetch(request, env, ctx) {
    // Serve static assets first
    const res = await env.ASSETS.fetch(request);

    // Only consider HTML responses for GA injection
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return res;

    // If no GA ID configured, return as-is
    const GA_ID = env.GA_ID;
    const CONTACT_EMAIL = env.CONTACT_EMAIL;

    const rewriter = new HTMLRewriter();

    // Inject GA snippet if configured
    if (GA_ID) {
      const snippet = `\n<script>(function(w,d){\n  if(w._gaInjected) return; w._gaInjected = true;\n  if(!d.getElementById('ga-gtag-js')){\n    var s=d.createElement('script'); s.id='ga-gtag-js'; s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';\n    (d.head||d.documentElement).appendChild(s);\n  }\n  w.dataLayer=w.dataLayer||[];\n  function gtag(){w.dataLayer.push(arguments);}\n  if(!w._gaInit){ gtag('js', new Date()); gtag('config', '${GA_ID}'); w._gaInit=true; }\n})(window,document);</script>\n`;
      rewriter.on('head', { element(el) { el.append(snippet, { html: true }); } });
    }

    // Inject contact email into contact form as data attribute (keeps it out of repo)
    if (CONTACT_EMAIL) {
      rewriter.on('form#contact-form', {
        element(el) {
          if (!el.getAttribute('data-email')) el.setAttribute('data-email', CONTACT_EMAIL);
        }
      });
    }

    const transformed = rewriter.transform(res);
    // Add lightweight debug headers to help validate in Network tab (non-secret)
    const headers = new Headers(transformed.headers);
    headers.set('x-worker-active', '1');
    headers.set('x-ga-configured', GA_ID ? '1' : '0');
    headers.set('x-contact-configured', CONTACT_EMAIL ? '1' : '0');
    return new Response(transformed.body, { status: transformed.status, statusText: transformed.statusText, headers });
  }
};
