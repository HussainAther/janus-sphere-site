# Janus Sphere Site Setup

This folder is a static site for `janus-sphere.com`.

Files:

- `index.html`
- `styles.css`
- `script.js`
- `assets/`

## Recommended path

Use a static host for this exact HTML/CSS/JS package, then point the domain to it.

Good choices:

- Cloudflare Pages
- Netlify
- Vercel

The clean domain layout is:

- `janus-sphere.com` for the public company/research site
- `demo.janus-sphere.com` for the RBYRCT WebGL demo later

## Cloudflare Pages path

1. Create a Cloudflare account.
2. Go to Workers & Pages.
3. Create a Pages project.
4. Upload this folder as a direct upload project.
5. Add the custom domain `janus-sphere.com`.
6. Cloudflare will show DNS records to add or nameserver changes to make.
7. In Squarespace, update DNS exactly as Cloudflare instructs.

Do not delete Google Workspace records:

- MX `smtp.google.com`
- TXT `v=spf1 include:_spf.google.com ~all`
- TXT `google._domainkey`
- TXT `_dmarc`

## Netlify path

1. Create a Netlify account.
2. Drag this folder into Netlify's deploy dropzone.
3. Add custom domain `janus-sphere.com`.
4. Netlify will give DNS records.
5. Add those records in Squarespace DNS.

Do not edit the Google Workspace email records.

## Squarespace-native path

If you want to keep using the Squarespace page builder instead of hosting this
static package directly:

1. Create a new page for Home.
2. Use the copy in `index.html` as your page text.
3. Upload the images from `assets/`.
4. Recreate sections in this order:
   - Hero
   - Research signals
   - RBYRCT explanation
   - Three-step method
   - Evidence panel
   - Demo section
   - Contact
5. Add `sha@janus-sphere.com` as the primary contact link.

Squarespace is convenient, but it usually will not accept a full custom static
site as a single upload. Use Cloudflare Pages, Netlify, or Vercel if you want
this exact code live.

## After publishing

Send yourself a test email from `sha@janus-sphere.com` again after DNS changes.
Confirm SPF, DKIM, and DMARC still pass.
