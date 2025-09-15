Qasas for Kids — Static Site

Short description (English)
- “Qasas for Kids” is a simple educational website that presents Quran stories to children in an accessible, engaging way. It shows the relevant verses for each story and allows listening to recitations, all using a fast, static setup (HTML/CSS/JavaScript).
- This repository intentionally contains only the static site files under `public/`. It’s meant to be minimal so anyone can clone and host the site as‑is, with no secrets included.

وصف موجز (Arabic)
- «قصص القرآن للأطفال» موقعٌ تعليمي بسيط يقرّب معاني القصص القرآنية للصغار بصورةٍ سهلة وممتعة، مع عرض مواضع الآيات وإتاحة الاستماع لتلاوتها. يعتمد على ملفاتٍ ثابتة وتقنيات الويب القياسية لسرعة وأداء أفضل.
- هذا المستودع يحتوي على الملفات الثابتة فقط داخل `public/` عمداً، ليكون بسيطاً وقابلاً للاستنساخ بدون أي أسرار أو إعدادات خاصة.

What’s in this repo
- `public/` — all static files (HTML, CSS, JS, data, images, icons).
- `README.md`, `LICENSE`, `.gitignore` — minimal documentation and housekeeping.

How to run locally
- Option 1: open `public/index.html` directly in your browser.
- Option 2: serve the `public/` folder with any static server, for example:
  - Python: `python3 -m http.server --directory public 8080`
  - Node (serve): `npx serve public`

About analytics/contact data
- The live site may include analytics or contact configuration that is injected during a private, local build step. Those secrets are not committed to this repository. Clones of this repo do not include any tracking or secrets by design.

License
- Licensed under the GPL-2.0-or-later. See `LICENSE` for details.

