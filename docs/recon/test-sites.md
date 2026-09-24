# Test-site recon (24 Sep 2026, Claude) — for NEC-08

Three real test sites, all Flight clients. Resurrect into **private** `rip-*` datasets only. None goes in `showcase` without the client's OK.

| Site                                 | Platform                   | Why it's a good corpse                                                                              |
| ------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------- |
| https://pnjbuild.co.nz               | Durable (Next.js-rendered) | The one Taylor picked. Flight is already rebuilding it by hand, so the manual brief is ground truth |
| https://hewahihaumaru.org.nz         | WordPress 7.1.2            | Big site, a real WP sitemap index, custom post types                                                |
| https://targetcleaningsupplies.co.nz | Old static PHP             | Apex → `www.` 301, `/html/*.php` URLs, product catalogue. Flight is rebuilding it too               |

## pnjbuild.co.nz: what we found

1. **Durable ships its whole content model in `__NEXT_DATA__`.** Take `<script id="__NEXT_DATA__">` → `props.pageProps`:
   - `page.blocks[]`: typed blocks (`banner`, `about`, `services`, `quote`, `image-carousel`, `contact`) with `headline`, `content`, `items`, `buttons`, `image`.
   - `page.seo`: title/description/keywords. The HTML `<title>` is just "PNJ Build " (trailing space) and the HTML meta description is empty. **The structured seo is richer than the rendered HTML.**
   - `website`: `primaryColor`, `secondaryColor`, `colorPalette.Palette.colors[]` (e.g. accent `#2B6BE7`, text `#46494E`), `cornerRadius`, `fonts.head/body.family` ("Wix Madefor Display"), `favicon`, `Business.name`.

   → Build a **Durable adapter** in `packages/exhume`: when `durable` is detected, read `__NEXT_DATA__` instead of scraping DOM. Map `banner`→`hero`, `about`→`mediaText`, `services`→`cardGrid` + a candidate `service` collection, `quote`→`testimonial`, `image-carousel`→`gallery`, `contact`→`contactBlock`. Fall back to DOM when the shape is missing. Keep the generic HTML path for everything else.

2. **Privacy:** `pageProps` also has `ipAddress` (the _crawler's_ IP, echoed back), `captchaKey` and `apiUrl`. **Strip these before anything is stored.**
3. **Emails are Cloudflare-obfuscated** (`/cdn-cgi/l/email-protection`, disallowed in robots). Decode `data-cfemail` (hex; first byte is the XOR key) during extraction and don't crawl that path. That's why the manual brief says the email "needs confirming".
4. **Sitemap trap:** robots.txt says `Sitemap: https://pnjbuild.co.nz/sitemap`, and that's the real XML. `/sitemap.xml` returns **200 with an HTML page** (catch-all route). Validate that the content-type or body is XML before trusting a sitemap, and treat a 200 HTML answer as a soft 404.
5. Fingerprint hits on the home page: `cdn.durable.co` ×78, `_next/image` ×55, `x-powered-by: Next.js`, `server: cloudflare`.
6. `x-frame-options: ALLOWALL`, so the Rise before/after can iframe the old site live (check per site; most will block).
7. Pages: `/`, `/about`, `/services`, `/contact`. Phone 021 152 6894 appears twice on home.
8. Placeholder favicon from thenounproject: a nice "missing-info" interrogation question.

## Build-log / write-up angle

The manual PNJ brief (`~/Documents/Projects/pnjbuild/brief.md`) is a human-made exhumation of the same site. After NEC-09, compare Necromancer's anatomy and questions against it side by side. "What the machine found that we missed, and vice versa" is a strong, honest section for the DEV post.
