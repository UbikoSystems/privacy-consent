# privacy-consent

A cookie consent banner for websites. It blocks analytics and marketing cookies until the visitor agrees (Québec Law 25), and it drives Google Consent Mode v2 in **Basic** mode. It doesn't depend on any platform (Webflow, Squarespace, plain HTML) and has no dependencies.

- **Demo and QA:** [demo page](https://ubikosystems.github.io/privacy-consent/demo/). You can change the theme and see the banner update live.
- **Maintained by** Ubiko. The internal docs and the per-site rollout live in a private repo (`privacy-system`).

## Install (2 steps)

**1. Head snippet.** Paste [`head-snippet.html`](head-snippet.html) at the **very top** of the site `<head>`, before Google Tag Manager. Edit the config object in it:

| Option | Example | What it does |
|---|---|---|
| `version` | `1` | Raising it asks every visitor again (e.g. a new tool or a new policy) |
| `defaultLang` | `"fr"` | Banner language when `<html lang>` is not `fr*`, `en*` or `es*` |
| `policyUrl` | `{ fr: "/politique-de-confidentialite", en: "/en/privacy-policy" }` | Privacy policy link, per language (or one string) |
| `categories` | `["analytics", "marketing"]` | Only the categories the site really uses. "Essential" is always shown. The intro text adapts (e.g. marketing only = no mention of traffic measurement) |
| `texts` | `{ en: { body: "…" } }` | Optional: overrides some texts per language |
| `reloadOnWithdraw` | `true` | Reload the page when a visitor withdraws consent (default `true`) |

The snippet loads the script from jsDelivr, pinned to a version:
```html
<script src="https://cdn.jsdelivr.net/gh/UbikoSystems/privacy-consent@0.1.7/consent.js" integrity="sha384-pB1PtIO+67iNcbCxFaVQ5bQbNJZDUduEAwlnONFIkE1P8fgBOX/vZVI4ySG1/cze" crossorigin="anonymous" defer></script>
```

**2. Reopen link.** Visitors need a way to change their choice. Put it in the footer (e.g. "Préférences de témoins" / "Cookie preferences"), either way:
```html
<a href="#cookie-preferences">Préférences de témoins</a>
<!-- or any element -->
<button data-consent="open-prefs">Cookie preferences</button>
```
Sites leaving Enzuzo can keep their existing `href="#manage_cookies"` link: it works too.

## Customize the look

The banner lives in a **Shadow DOM**: the site's CSS can't break it, and it can't break the site. You theme it with CSS variables in the site's own stylesheet. Each one is optional, and the [demo](https://ubikosystems.github.io/privacy-consent/demo/) generates this block for you:

```css
:root {
  --consent-bg: #F3ECE4;            /* card background */
  --consent-text: #1F272E;          /* text and outline button */
  --consent-border: #DDD9D2;        /* lines between sections */
  --consent-accent: #1F272E;        /* "Accept all" + switch on */
  --consent-on-accent: #F3ECE4;     /* text on the accent */
  --consent-accent-soft: #BACDE2;   /* "Save my choices" */
  --consent-radius: 0.5rem;         /* card corners */
  --consent-radius-button: 3rem;    /* button corners */
  --consent-font: "Open Sans", sans-serif;          /* default: inherits the site font */
  --consent-font-heading: "Tenor Sans", serif;      /* title */
  /* Optional title accent: the second part of the title ("vos choix") in another style */
  --consent-title-accent-style: italic;             /* default: normal (title looks even) */
  --consent-font-accent: "Arapey", serif;           /* default: same font as the title */
}
```

On a site with its own variables (e.g. Client-First), you can point to them: `--consent-accent: var(--brand-primary);`.

Other variables: `--consent-toggle-off`, `--consent-shadow`, `--consent-offset` (distance from the screen edge, default `1rem`), `--consent-width` (default `30rem`), `--consent-z` (z-index), `--consent-focus`, `--consent-heading-weight`, `--consent-accent-size`, `--consent-button-weight`, `--consent-button-case` (`uppercase` or `none`).

## What it does

- **First visit:** the banner shows; nothing non-essential runs. Google Consent Mode defaults are `denied`.
- **On a choice:** it stores the `ubk_consent` cookie (12 months, root domain) and sends `consent update`. It also pushes `{event: "consent_update", consent_analytics, consent_marketing}` to the dataLayer and runs any scripts that were blocked.
- **Returning visitor:** no banner. The head snippet applies the saved choice before GTM loads.
- **Withdrawal:** deletes `_ga*`, `_gid`, `_gat*` (analytics) or `_gcl_*`, `_fbp`, `_fbc` (marketing), then reloads.
- **Language:** FR-CA, EN or ES, chosen from `<html lang>`. If a translator changes `<html lang>` after load (e.g. Weglot), the banner rebuilds in the new language.

Categories map to Consent Mode like this: **analytics** → `analytics_storage`; **marketing** → `ad_storage`, `ad_user_data`, `ad_personalization`.

### Tags outside GTM
Block a script or an iframe until its category is accepted:
```html
<script type="text/plain" data-consent-category="analytics" data-src="https://example.com/tag.js"></script>
<iframe data-consent-category="marketing" data-consent-src="https://…"></iframe>
```

### JavaScript API
`ubkConsent.open()` · `ubkConsent.get()` → `{analytics, marketing, ts, v}` or `null` · `ubkConsent.reset()`

## Versions and integrity
Sites load a pinned tag (`@0.1.7`), so a change here never reaches a live site until that site's tag is updated. Every release gets a git tag, and tags are protected (they can't be moved or deleted). jsDelivr serves the file compressed (gzip/brotli).

The `integrity` attribute (SRI) makes the browser refuse the file if a single byte differs from the release. **Every release gets a new hash**; compute it from the CDN file and update it together with the version:
```sh
curl -s https://cdn.jsdelivr.net/gh/UbikoSystems/privacy-consent@<version>/consent.js | openssl dgst -sha384 -binary | openssl base64 -A
```
| Version | integrity |
|---|---|
| 0.1.7 | `sha384-pB1PtIO+67iNcbCxFaVQ5bQbNJZDUduEAwlnONFIkE1P8fgBOX/vZVI4ySG1/cze` |

## License
Proprietary. Copyright (c) 2026 Ubiko. All rights reserved. The code is public so the CDN can serve it to our clients' sites; that does not grant any right to use, copy or modify it. Use is limited to websites operated by Ubiko or its clients under a written agreement. See [LICENSE](LICENSE).
