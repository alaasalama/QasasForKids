export default {
  async fetch(request, env, ctx) {
    // Serve static assets first
    const res = await env.ASSETS.fetch(request);

    // Only consider HTML responses for GA injection
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return res;

    // If no GA ID configured, return as-is
    const GA_ID = env.GA_ID;
    if (!GA_ID) return res;

    // Build an idempotent GA loader snippet; avoids duplication if already in page
    const snippet = `\n<script>(function(w,d){\n  if(w._gaInjected) return; w._gaInjected = true;\n  if(!d.getElementById('ga-gtag-js')){\n    var s=d.createElement('script'); s.id='ga-gtag-js'; s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';\n    (d.head||d.documentElement).appendChild(s);\n  }\n  w.dataLayer=w.dataLayer||[];\n  function gtag(){w.dataLayer.push(arguments);}\n  if(!w._gaInit){ gtag('js', new Date()); gtag('config', '${GA_ID}'); w._gaInit=true; }\n})(window,document);</script>\n`;

    // Inject before </head>
    const rewritten = new HTMLRewriter()
      .on('head', {
        element(el) {
          el.append(snippet, { html: true });
        }
      })
      .transform(res);

    return rewritten;
  }
};

