// Acadex landing page — measurement.
//
// One function, acadexTrack(name, props), and the listeners that call it. The
// events go to the provider named in site.config.json (Plausible, Umami or
// GA4). With no provider configured nothing leaves the browser: the events are
// only kept in window.acadexEvents, so each one can be checked from the console.
//
// The order form is watched from the outside (its dialog and its steps): its
// own code is not touched.
//
// Events (one naming scheme: object_action, lower case):
//   download_click        { location }
//   plan_request_open     { pack, trigger: "button" | "link", from } — from: the page whose link opened the form
//   file_download         { file }                                    — a file offered by an article
//   order_submit_success  { pack }
//   order_submit_failure  { pack, reason: "invalid_<field>" | "rejected" | "not_saved" }
//   whatsapp_click        { location }
//   phone_click           { location }
//   email_click           { location }
//   language_switch       { from, to }
//   demo_video_play       { player: "inline" | "fullscreen" }
// Every event also carries { lang } and, when the visit came from a campaign
// link, { utm_source, utm_medium, utm_campaign }.
(function () {
  "use strict";

  var script = document.currentScript;
  var config = (script && script.dataset) || {};
  var provider = config.provider || "";
  var lang = document.documentElement.lang || "";
  var events = (window.acadexEvents = []);

  // ── Where the visit comes from ───────────────────────────────
  // Read once per tab: a campaign link (utm_*), an ad click id, or the site
  // that linked here. Kept for the tab's session so it survives a language
  // switch; a later campaign link replaces it.
  var SOURCE_KEY = "acadex_source";
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function clean(value) {
    // Any script is kept (Arabic campaign names, Arabic page addresses); markup and control characters are not.
    return String(value).replace(/[\u0000-\u001f<>"'`\\]/g, "").slice(0, 80);
  }

  function readSource() {
    var found = {};
    try {
      var query = new URLSearchParams(location.search);
      UTM.forEach(function (key) {
        var value = query.get(key);
        if (value) found[key] = clean(value);
      });
      if (!found.utm_source) {
        if (query.get("fbclid")) found.utm_source = "facebook";
        else if (query.get("gclid")) found.utm_source = "google";
      }
    } catch (error) { /* no URLSearchParams: no campaign data */ }

    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SOURCE_KEY) || "null"); } catch (error) { saved = null; }
    if (found.utm_source || !saved) {
      if (!found.utm_source && document.referrer) {
        try {
          var host = new URL(document.referrer).hostname;
          if (host && host !== location.hostname) found.referrer = clean(host);
        } catch (error) { /* unreadable referrer */ }
      }
      try { sessionStorage.setItem(SOURCE_KEY, JSON.stringify(found)); } catch (error) { /* storage unavailable */ }
      return found;
    }
    return saved;
  }

  var source = readSource();
  /** The source of the visit, for whoever needs it (the order form, once the owner asks for it). */
  window.acadexSource = function () {
    var copy = {};
    for (var key in source) copy[key] = source[key];
    return copy;
  };

  // ── Sending ──────────────────────────────────────────────────
  var send = function () {};

  function load(src, attributes, onload) {
    var tag = document.createElement("script");
    tag.src = src;
    tag.defer = true;
    for (var name in attributes) tag.setAttribute(name, attributes[name]);
    if (onload) tag.addEventListener("load", onload);
    document.head.appendChild(tag);
  }

  if (provider === "plausible") {
    // Classic snippet (script + data-domain) or the newer per-site script.
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    window.plausible.init = window.plausible.init || function (options) { window.plausible.o = options || {}; };
    if (config.site) load(config.script || "https://plausible.io/js/script.js", { "data-domain": config.site });
    else { load(config.script, {}); window.plausible.init(); }
    send = function (name, props) { window.plausible(name, { props: props }); };
  } else if (provider === "umami") {
    var waiting = [];
    load(config.script || "https://cloud.umami.is/script.js", { "data-website-id": config.site }, function () {
      waiting.splice(0).forEach(function (entry) { window.umami.track(entry[0], entry[1]); });
    });
    send = function (name, props) {
      if (window.umami && window.umami.track) window.umami.track(name, props);
      else waiting.push([name, props]);
    };
  } else if (provider === "ga4") {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", config.site);
    load("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(config.site), {});
    send = function (name, props) { window.gtag("event", name, props); };
  }

  function track(name, props) {
    var data = { lang: lang };
    for (var key in props || {}) if (props[key] !== undefined && props[key] !== "") data[key] = String(props[key]);
    if (source.utm_source) data.utm_source = source.utm_source;
    if (source.utm_medium) data.utm_medium = source.utm_medium;
    if (source.utm_campaign) data.utm_campaign = source.utm_campaign;
    events.push({ name: name, props: data, at: Date.now() });
    if (events.length > 200) events.shift();
    try { send(name, data); } catch (error) { /* measuring must never break the page */ }
  }
  window.acadexTrack = track;

  // ── What is measured ─────────────────────────────────────────

  /** Where on the page an element sits: the header, a section, the order form… */
  function place(element) {
    var box = element.closest("dialog, .mobile-cta, .cp-cta, .cp-hero, .cp-body, .cp-faq, header, footer, section[id]");
    if (!box) return "page";
    if (box.matches(".mobile-cta")) return "mobile_bar";
    if (box.matches(".cp-cta")) return "cta";
    if (box.matches(".cp-hero")) return "hero";
    if (box.matches(".cp-body, .cp-faq")) return "text";
    if (box.id === "order-dialog") return "order_form";
    return box.id || box.tagName.toLowerCase();
  }

  /** The page of this site the visitor arrived from (a segment page, an article…), or "". */
  function cameFrom() {
    try {
      var previous = new URL(document.referrer);
      if (previous.origin !== location.origin || previous.pathname === location.pathname) return "";
      return clean(decodeURIComponent(previous.pathname));
    } catch (error) { return ""; }
  }

  var lastPackClick = 0;
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("a, button") : null;
    if (!target) return;
    if (target.hasAttribute("data-order-pack")) lastPackClick = Date.now();
    var href = target.getAttribute("href") || "";
    if (href === "/download") track("download_click", { location: place(target) });
    else if (href.indexOf("/assets/files/") === 0) track("file_download", { file: href.split("/").pop() });
    else if (href.indexOf("https://wa.me/") === 0) track("whatsapp_click", { location: place(target) });
    else if (href.indexOf("tel:") === 0) track("phone_click", { location: place(target) });
    else if (href.indexOf("mailto:") === 0) track("email_click", { location: place(target) });
    else if (target.matches(".lang-btn[data-lang]") && target.getAttribute("data-lang") !== lang) {
      track("language_switch", { from: lang, to: target.getAttribute("data-lang") });
    }
  }, true);

  // The order form: opened, sent, refused. Read from what the form shows.
  var dialog = document.getElementById("order-dialog");
  if (dialog && "MutationObserver" in window) {
    var wasOpen = dialog.hasAttribute("open");
    var step = "form";
    var errorShown = false;
    var errorBox = document.getElementById("od-error");
    var pack = function () { return dialog.getAttribute("data-pack") || ""; };

    new MutationObserver(function () {
      var open = dialog.hasAttribute("open");
      if (open && !wasOpen) {
        var byButton = Date.now() - lastPackClick < 1500;
        track("plan_request_open", { pack: pack(), trigger: byButton ? "button" : "link", from: byButton ? "" : cameFrom() });
      }
      wasOpen = open;

      var active = dialog.querySelector(".od-step.active");
      var current = active ? active.getAttribute("data-step") : step;
      if (current !== step) {
        step = current;
        if (step === "done") track("order_submit_success", { pack: pack() });
        else if (step === "fallback") track("order_submit_failure", { pack: pack(), reason: "not_saved" });
      }

      var shown = Boolean(errorBox && errorBox.classList.contains("show"));
      if (shown && !errorShown) {
        var field = dialog.querySelector(".invalid[name]");
        track("order_submit_failure", { pack: pack(), reason: field ? "invalid_" + field.getAttribute("name") : "rejected" });
      }
      errorShown = shown;
    }).observe(dialog, { attributes: true, attributeFilter: ["open", "class"], subtree: true });
  }

  // The demo video: the first time it plays on this page view.
  var played = false;
  [["hero-demo-video", "inline"], ["theater-video", "fullscreen"]].forEach(function (entry) {
    var video = document.getElementById(entry[0]);
    if (!video) return;
    video.addEventListener("play", function () {
      if (played) return;
      played = true;
      track("demo_video_play", { player: entry[1] });
    });
  });
})();
