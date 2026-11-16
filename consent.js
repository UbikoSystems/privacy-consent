/*!
 * ubk-consent v0.1.2 — consent banner for Loi 25 / Google Consent Mode v2 (Basic).
 * Needs the head snippet (head-snippet.html) to run first: it sets the config and the "denied" defaults.
 * The banner lives in a Shadow DOM: site CSS can't break it and it can't break the site.
 * Theme it from the site CSS with custom properties, e.g. :root { --consent-accent: #1F272E; }
 */
(function () {
  "use strict";
  if (window.ubkConsent) return; // loaded twice

  var CFG = window.ubkConsentConfig || {};
  var VERSION = CFG.version || 1;
  var COOKIE = "ubk_consent";
  var MAX_AGE = 60 * 60 * 24 * 365; // 12 months (plan D4)
  var CATS = (CFG.categories || ["analytics", "marketing"]).filter(function (c) {
    return c === "analytics" || c === "marketing";
  });
  // First-party cookies removed when a category is withdrawn.
  var CLEANUP = {
    analytics: [/^_ga($|_)/, /^_gid$/, /^_gat/],
    marketing: [/^_gcl_/, /^_fbp$/, /^_fbc$/]
  };

  // ---------- Texts (client-facing; FR-CA + EN drafts, David validates) ----------
  var TEXTS = {
    fr: {
      region: "Préférences de témoins",
      titleA: "Votre vie privée, ",
      titleB: "vos choix",
      body: "Nous utilisons des témoins pour mesurer la fréquentation du site et, avec votre accord, pour vous présenter des publicités pertinentes. Aucun témoin non essentiel n’est activé sans votre consentement.",
      policy: "Politique de confidentialité",
      customize: "Personnaliser mes choix",
      reject: "Tout refuser",
      accept: "Tout accepter",
      save: "Enregistrer mes choix",
      alwaysOn: "Toujours actifs",
      necessary: ["Essentiels", "Nécessaires au fonctionnement et à la sécurité du site : mémoriser vos choix, protéger les formulaires contre les pourriels."],
      analytics: ["Mesure d’audience", "Nous aident à comprendre comment le site est utilisé, de façon agrégée (Google Analytics)."],
      marketing: ["Marketing", "Mesurent nos publicités et vous en présentent de plus pertinentes (Meta, Google Ads)."]
    },
    en: {
      region: "Cookie preferences",
      titleA: "Your privacy, ",
      titleB: "your choices",
      body: "We use cookies to measure site traffic and, with your consent, to show you relevant ads. No non-essential cookie is turned on without your consent.",
      policy: "Privacy policy",
      customize: "Customize my choices",
      reject: "Reject all",
      accept: "Accept all",
      save: "Save my choices",
      alwaysOn: "Always on",
      necessary: ["Essential", "Needed for the site to work and stay secure: remembering your choices, protecting forms from spam."],
      analytics: ["Audience measurement", "Help us understand how the site is used, in aggregate (Google Analytics)."],
      marketing: ["Marketing", "Measure our ads and show you more relevant ones (Meta, Google Ads)."]
    }
  };

  function lang() {
    var l = (document.documentElement.lang || "").toLowerCase();
    if (l.indexOf("en") === 0) return "en";
    if (l.indexOf("fr") === 0) return "fr";
    return CFG.defaultLang === "en" ? "en" : "fr";
  }
  function texts() {
    var l = lang();
    var t = {}, k, o = (CFG.texts && CFG.texts[l]) || {};
    for (k in TEXTS[l]) t[k] = TEXTS[l][k];
    for (k in o) t[k] = o[k]; // per-site overrides
    return t;
  }
  function policyUrl() {
    var p = CFG.policyUrl;
    if (!p) return null;
    return typeof p === "string" ? p : p[lang()] || p.fr || p.en || null;
  }

  // ---------- Cookie ----------
  function domainCandidates() {
    // "www.aurea.com" -> ["aurea.com", "www.aurea.com"]; "localhost" -> []
    var parts = location.hostname.split(".");
    var out = [];
    if (parts.length < 2 || /^\d+$/.test(parts[parts.length - 1])) return out;
    for (var i = parts.length - 2; i >= 0; i--) out.push(parts.slice(i).join("."));
    return out;
  }
  var ROOT_DOMAIN = (function () {
    // Widest domain the browser accepts (public suffixes like webflow.io are refused).
    var c = domainCandidates();
    for (var i = 0; i < c.length; i++) {
      document.cookie = "ubk_t=1; path=/; domain=" + c[i];
      if (document.cookie.indexOf("ubk_t=1") > -1) {
        document.cookie = "ubk_t=; path=/; domain=" + c[i] + "; max-age=0";
        return c[i];
      }
    }
    return null;
  })();

  function read() {
    try {
      var m = document.cookie.match(/(?:^|; )ubk_consent=([^;]*)/);
      var c = m && JSON.parse(decodeURIComponent(m[1]));
      return c && c.v === VERSION ? c : null;
    } catch (e) { return null; }
  }
  function write(choice) {
    var val = encodeURIComponent(JSON.stringify({ v: VERSION, ts: Date.now(), a: !!choice.analytics, m: !!choice.marketing }));
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = COOKIE + "=" + val + "; path=/; max-age=" + MAX_AGE + "; SameSite=Lax" + secure +
      (ROOT_DOMAIN ? "; domain=" + ROOT_DOMAIN : "");
  }
  function cleanup(cat) {
    var names = document.cookie.split("; ").map(function (s) { return s.split("=")[0]; });
    var doms = domainCandidates();
    names.forEach(function (n) {
      if (!CLEANUP[cat].some(function (re) { return re.test(n); })) return;
      document.cookie = n + "=; path=/; max-age=0";
      doms.forEach(function (d) {
        document.cookie = n + "=; path=/; max-age=0; domain=" + d;
        document.cookie = n + "=; path=/; max-age=0; domain=." + d;
      });
    });
  }

  // ---------- Google Consent Mode + dataLayer ----------
  function gtagSafe() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
  function signal(choice) {
    var mk = choice.marketing ? "granted" : "denied";
    gtagSafe("consent", "update", {
      analytics_storage: choice.analytics ? "granted" : "denied",
      ad_storage: mk, ad_user_data: mk, ad_personalization: mk
    });
    window.dataLayer.push({
      event: "consent_update",
      consent_analytics: choice.analytics ? "granted" : "denied",
      consent_marketing: mk
    });
  }

  // ---------- Scripts / iframes blocked outside GTM ----------
  // <script type="text/plain" data-consent-category="analytics" data-src="…"> or inline body
  // <iframe data-consent-category="marketing" data-consent-src="…">
  function unblock(choice) {
    var nodes = document.querySelectorAll('script[type="text/plain"][data-consent-category],iframe[data-consent-src]');
    Array.prototype.forEach.call(nodes, function (el) {
      var cat = el.getAttribute("data-consent-category");
      if (cat && cat !== "necessary" && !choice[cat]) return;
      if (el.tagName === "IFRAME") {
        el.src = el.getAttribute("data-consent-src");
        el.removeAttribute("data-consent-src");
        return;
      }
      var s = document.createElement("script");
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name === "type" || a.name === "data-src") continue;
        s.setAttribute(a.name, a.value);
      }
      if (el.getAttribute("data-src")) s.src = el.getAttribute("data-src");
      else s.text = el.text;
      el.parentNode.replaceChild(s, el);
    });
  }

  // ---------- Banner ----------
  var CSS = [
    "*{box-sizing:border-box;margin:0}",
    "[hidden]{display:none!important}",
    ".card{",
    " --_bg:var(--consent-bg,#fff);--_text:var(--consent-text,#1f272e);--_border:var(--consent-border,#ddd9d2);",
    " --_accent:var(--consent-accent,#1f272e);--_on-accent:var(--consent-on-accent,#fff);",
    " --_soft:var(--consent-accent-soft,#e6eaee);--_off:var(--consent-toggle-off,#8a8f93);",
    " position:fixed;right:var(--consent-offset,1.5rem);bottom:var(--consent-offset,1.5rem);z-index:var(--consent-z,2147483000);",
    " width:min(35rem,calc(100vw - 2 * var(--consent-offset,1.5rem)));max-height:calc(100dvh - 2 * var(--consent-offset,1.5rem));",
    " display:flex;flex-direction:column;background:var(--_bg);color:var(--_text);",
    " border-radius:var(--consent-radius,0.5rem);box-shadow:var(--consent-shadow,0 1.5rem 3rem rgba(15,20,24,.28));",
    " font-family:var(--consent-font,inherit);font-size:0.875rem;line-height:1.375rem;",
    " -webkit-font-smoothing:antialiased;overflow-wrap:anywhere;text-align:left;",
    " font-style:normal;font-weight:400;letter-spacing:normal;word-spacing:normal;text-transform:none;text-indent:0;white-space:normal;visibility:visible;direction:ltr}",
    ".scroll{position:relative;overflow-y:auto;overscroll-behavior:contain;padding:2.25rem 2.25rem 0;display:flex;flex-direction:column;gap:1.25rem}",
    ".fade{position:sticky;bottom:0;height:2.25rem;margin-top:-2.25rem;flex-shrink:0;pointer-events:none;background:linear-gradient(to bottom,transparent,var(--_bg));opacity:0;transition:opacity .2s}",
    ".card[data-overflow] .fade{opacity:1}",
    ".text{display:flex;flex-direction:column;gap:0.75rem}",
    ".title{font-family:var(--consent-font-heading,inherit);font-size:1.625rem;line-height:2rem;font-weight:var(--consent-heading-weight,400)}",
    ".title em{font-family:var(--consent-font-accent,inherit);font-style:var(--consent-title-accent-style,normal);font-size:var(--consent-accent-size,1em)}",
    ".text a{color:inherit;font-weight:600;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:0.15em}",
    ".prefs{display:flex;flex-direction:column}",
    ".cat{display:flex;align-items:flex-start;gap:1.5rem;padding-block:1rem;border-top:1px solid var(--_border)}",
    ".cat-last{border-bottom:1px solid var(--_border)}",
    ".cat-text{flex:1 1 0;display:flex;flex-direction:column;gap:0.375rem;min-width:0}",
    ".cat-name{font-size:1rem;line-height:1.5rem;font-weight:600}",
    ".cat-desc{font-size:0.8125rem;line-height:1.25rem}",
    ".cat-ctrl{flex-shrink:0;display:flex;justify-content:flex-end;padding-top:0.125rem}",
    ".always{font-size:0.8125rem;line-height:1.25rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}",
    ".switch{appearance:none;-webkit-appearance:none;position:relative;width:3rem;height:1.75rem;border-radius:1rem;border:1.5px solid var(--_off);background:var(--_bg);cursor:pointer;flex-shrink:0;transition:background .15s,border-color .15s}",
    ".switch::after{content:'';position:absolute;top:50%;left:0.1875rem;width:1.25rem;height:1.25rem;border-radius:50%;background:var(--_off);transform:translateY(-50%);transition:transform .15s,background .15s}",
    ".switch:checked{background:var(--_accent);border-color:var(--_accent)}",
    ".switch:checked::after{background:var(--_bg);transform:translate(1.25rem,-50%)}",
    ".save-wrap{padding-top:1.25rem;padding-bottom:0.25rem}",
    ".footer{flex-shrink:0;display:flex;flex-direction:column;gap:0.75rem;padding:1rem 2.25rem 2rem}",
    ".card[data-state=expanded] .footer{border-top:1px solid var(--_border)}",
    ".card[data-state=collapsed] .footer{padding-top:1.75rem}",
    ".card[data-state=collapsed] .toggle{border-top:1px solid var(--_border);padding-top:1rem}",
    "button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}",
    ".toggle{display:flex;align-items:center;justify-content:space-between;gap:0.5rem;width:100%;padding:0 0 0.25rem;text-align:left}",
    ".label{font-size:0.875rem;line-height:1.125rem;font-weight:var(--consent-button-weight,500);letter-spacing:.0375em;text-transform:var(--consent-button-case,uppercase)}",
    ".toggle .label{font-weight:600}",
    ".toggle svg{width:1.25rem;height:1.25rem;flex-shrink:0;transition:transform .2s}",
    ".card[data-state=expanded] .toggle svg{transform:rotate(180deg)}",
    ".buttons{display:flex;gap:0.75rem}",
    ".btn{flex:1 1 0;display:flex;justify-content:center;padding:0.8125rem 1.25rem;border-radius:var(--consent-radius-button,3rem);border:1px solid var(--_text);min-width:0}",
    ".btn-solid{background:var(--_accent);border-color:var(--_accent);color:var(--_on-accent)}",
    ".btn-soft{width:100%;background:var(--_soft);border-color:var(--_soft);color:var(--_text);padding-block:0.875rem}",
    "button:focus-visible,.switch:focus-visible,a:focus-visible{outline:2px solid var(--consent-focus,currentColor);outline-offset:2px}",
    "@media (hover:hover){.btn:hover,.toggle:hover .label{opacity:.85}}",
    "@media (max-width:36rem){",
    " .card{--consent-offset:0.75rem}",
    " .scroll{padding:1.25rem 1.25rem 0;gap:1rem}",
    " .footer{padding:0.75rem 1.25rem 1.25rem}",
    " .card[data-state=collapsed] .footer{padding-top:1.25rem}",
    " .title{font-size:1.375rem;line-height:1.75rem}",
    " .buttons{gap:0.5rem}",
    " .btn{padding-inline:0.75rem}",
    "}",
    "@media (prefers-reduced-motion:reduce){*{transition:none!important}}"
  ].join("\n");

  var CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  var host, root, card, lastFocus;

  function build() {
    var t = texts();
    var url = policyUrl();
    var cat = function (key, ctrl) {
      var last = key === CATS[CATS.length - 1] || (!CATS.length && key === "necessary");
      return '<div class="cat' + (last ? " cat-last" : "") + '"><div class="cat-text"><p class="cat-name" id="ubk-n-' + key + '">' + esc(t[key][0]) +
        '</p><p class="cat-desc">' + esc(t[key][1]) + '</p></div><div class="cat-ctrl">' + ctrl + "</div></div>";
    };
    var html =
      '<style>' + CSS + '</style>' +
      '<section class="card" role="region" aria-label="' + esc(t.region) + '" data-state="collapsed" hidden>' +
      '<div class="scroll" tabindex="-1">' +
      '<div class="text"><p class="title">' + esc(t.titleA) + "<em>" + esc(t.titleB) + "</em></p>" +
      "<p>" + esc(t.body) + (url ? ' <a href="' + esc(url) + '">' + esc(t.policy) + "</a>" : "") + "</p></div>" +
      '<div class="prefs" id="ubk-prefs" hidden>' +
      cat("necessary", '<span class="always">' + esc(t.alwaysOn) + "</span>") +
      CATS.map(function (k) {
        return cat(k, '<input type="checkbox" role="switch" class="switch" data-cat="' + k + '" aria-labelledby="ubk-n-' + k + '">');
      }).join("") +
      '<div class="save-wrap"><button type="button" class="btn btn-soft" data-act="save"><span class="label">' + esc(t.save) + "</span></button></div>" +
      "</div>" +
      '<div class="fade" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="footer">' +
      '<button type="button" class="toggle" data-act="toggle" aria-expanded="false" aria-controls="ubk-prefs"><span class="label">' + esc(t.customize) + "</span>" + CHEVRON + "</button>" +
      '<div class="buttons">' +
      '<button type="button" class="btn" data-act="reject"><span class="label">' + esc(t.reject) + "</span></button>" +
      '<button type="button" class="btn btn-solid" data-act="accept"><span class="label">' + esc(t.accept) + "</span></button>" +
      "</div></div></section>";

    host = document.createElement("div");
    host.id = "ubk-consent";
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    root.innerHTML = html;
    document.body.appendChild(host);
    card = root.querySelector(".card");

    root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "toggle") setExpanded(card.getAttribute("data-state") !== "expanded", true);
      else if (act === "accept") choose(all(true));
      else if (act === "reject") choose(all(false));
      else if (act === "save") choose(fromSwitches());
    });
    root.querySelector(".scroll").addEventListener("scroll", updateOverflow);
    window.addEventListener("resize", updateOverflow);
  }

  function all(v) { var o = {}; CATS.forEach(function (c) { o[c] = v; }); return o; }
  function fromSwitches() {
    var o = all(false);
    Array.prototype.forEach.call(root.querySelectorAll(".switch"), function (s) { o[s.getAttribute("data-cat")] = s.checked; });
    return o;
  }
  function setSwitches(choice) {
    Array.prototype.forEach.call(root.querySelectorAll(".switch"), function (s) { s.checked = !!(choice && choice[s.getAttribute("data-cat")]); });
  }
  function updateOverflow() {
    if (!card || card.hidden) return;
    var s = root.querySelector(".scroll");
    var more = s.scrollHeight - s.clientHeight - s.scrollTop > 4;
    if (more) card.setAttribute("data-overflow", ""); else card.removeAttribute("data-overflow");
  }
  function setExpanded(open, moveFocus) {
    card.setAttribute("data-state", open ? "expanded" : "collapsed");
    root.querySelector("#ubk-prefs").hidden = !open;
    root.querySelector(".toggle").setAttribute("aria-expanded", String(open));
    if (open && moveFocus) {
      var first = root.querySelector(".switch");
      (first || root.querySelector("[data-act=save]")).focus();
    }
    updateOverflow();
  }
  function show(expanded) {
    if (!host) build();
    var c = read();
    setSwitches(c ? { analytics: c.a, marketing: c.m } : null);
    card.hidden = false;
    setExpanded(!!expanded, !!expanded);
  }
  function hide() {
    if (!card) return;
    card.hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function choose(choice) {
    var prev = read();
    write(choice);
    signal(choice);
    unblock(choice);
    hide();
    // Withdrawal: remove the category's cookies and reload so already-running tags stop.
    var withdrawn = prev && CATS.filter(function (c) { return prev[c === "analytics" ? "a" : "m"] && !choice[c]; });
    if (withdrawn && withdrawn.length) {
      withdrawn.forEach(cleanup);
      if (CFG.reloadOnWithdraw !== false) location.reload();
    }
  }

  // ---------- Reopen link: [data-consent="open-prefs"] or href="#cookie-preferences" ----------
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest('[data-consent="open-prefs"],a[href="#cookie-preferences"]');
    if (!el) return;
    e.preventDefault();
    lastFocus = el;
    show(true);
  });

  // ---------- Start ----------
  function start() {
    var c = read();
    if (c) {
      // Head snippet already sent the consent update; run blocked scripts.
      unblock({ analytics: c.a, marketing: c.m });
    } else {
      show(false);
    }
  }

  window.ubkConsent = {
    version: "0.1.2",
    open: function () { show(true); },
    get: function () { var c = read(); return c ? { analytics: c.a, marketing: c.m, ts: c.ts, v: c.v } : null; },
    reset: function () {
      document.cookie = COOKIE + "=; path=/; max-age=0" + (ROOT_DOMAIN ? "; domain=" + ROOT_DOMAIN : "");
      document.cookie = COOKIE + "=; path=/; max-age=0";
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
