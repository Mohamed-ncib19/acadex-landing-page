// Acadex landing page — behaviour of a pre-rendered language page.
//
// Every text of the page is already in the HTML, in the page's language
// (/ar/, /fr/, /en/ are built by scripts/build.mjs). This script only handles
// what depends on the visitor: the country and its prices, the order form,
// the demo video, the menus.

const SUPPORTED_LANGS = ["ar", "fr", "en"];
const currentLang = SUPPORTED_LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : "fr";
let currentCountry = "US";
let countryChosenByVisitor = false;

/** The texts this script writes itself (order form, prices), in the page's language. */
const dict = (() => {
  try { return JSON.parse(document.getElementById("acadex-i18n").textContent); } catch { return {}; }
})();

const PACKS = {
  essentiel: { label: "Essentiel" },
  plus: { label: "Plus" },
  complet: { label: "Complet" },
};
const PACK_KEYS = ["essentiel", "plus", "complet"];
const packKey = (key) => PACK_KEYS.indexOf(key) !== -1 ? key : "complet";
const FIELD_ERRORS = {
  contact_name: "od_err_name",
  phone: "od_err_phone",
  country: "od_err_country",
  currency: "od_err_country",
  amount_minor: "od_err_country",
};

const orderDialog = document.getElementById("order-dialog");
const orderForm = document.getElementById("order-form");
const orderError = document.getElementById("od-error");
const orderSubmit = document.getElementById("od-submit");
const orderSubmitLabel = document.getElementById("od-submit-label");
let orderBusy = false;
/** The last order shown on the "received" or "fallback" step. */
let orderShown = null;

/** The visitor's saved country, when it was picked manually. */
function savedCountry() {
  try {
    const code = localStorage.getItem("acadex_country");
    return code && AcadexLocalization.isSupportedCountry(code) ? code : null;
  } catch { return null; }
}

function initLocalization() {
  const saved = savedCountry();
  const languages = navigator.languages || [navigator.language || ""];
  currentCountry = saved
    || AcadexLocalization.countryFromBrowser(languages)
    || "US";
  countryChosenByVisitor = Boolean(saved);
  renderPrices();
  populateOrderCountries();
  if (!saved) confirmCountryFromGeo();
}

async function confirmCountryFromGeo() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch("/api/geo", { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (countryChosenByVisitor) return;
    if (!data || !AcadexLocalization.isSupportedCountry(data.country)) return;
    currentCountry = data.country;
    renderPrices();
    document.dispatchEvent(new CustomEvent("acadex:country"));
  } catch {
    /* Offline, file://, or no geo endpoint: the browser guess stands. */
  } finally {
    clearTimeout(timer);
  }
}

/** A text of the page's language, with {name} placeholders filled in. */
function tr(key, vars) {
  let text = dict[key] ?? key;
  for (const name in vars || {}) text = text.split(`{${name}}`).join(vars[name]);
  return text;
}

// Language links are plain links to /ar/, /fr/, /en/. A click remembers the
// choice and carries the current anchor (#plans, #order-plus…) to the other page.
document.querySelectorAll(".lang-btn[data-lang]").forEach(link => {
  link.addEventListener("click", () => {
    try { localStorage.setItem("acadex_lang", link.getAttribute("data-lang")); } catch { /* storage unavailable */ }
    if (location.hash) link.setAttribute("href", link.getAttribute("href").split("#")[0] + location.hash);
  });
});

// ── Price rendering in the visitor's currency ────────────────
function priceFor(pack) {
  return AcadexLocalization.priceTable(currentCountry, currentLang, window.ACADEX_RATES)[pack];
}

function renderPrices() {
  const table = AcadexLocalization.priceTable(currentCountry, currentLang, window.ACADEX_RATES);
  document.querySelectorAll("[data-price]").forEach((el) => {
    const price = table[el.getAttribute("data-price")];
    if (price) el.textContent = price.amountText;
  });
  document.querySelectorAll("[data-price-full]").forEach((el) => {
    const price = table[el.getAttribute("data-price-full")];
    if (price) el.textContent = price.formatted;
  });
  document.querySelectorAll("[data-old-price]").forEach((el) => {
    const price = table[el.getAttribute("data-old-price")];
    el.hidden = !(price && price.oldAmount != null);
    if (!el.hidden) el.textContent = price.oldAmountText;
  });
  document.querySelectorAll("[data-old-price-full]").forEach((el) => {
    const price = table[el.getAttribute("data-old-price-full")];
    el.hidden = !(price && price.oldAmount != null);
    if (!el.hidden) el.textContent = price.oldFormatted;
  });
  document.querySelectorAll("[data-currency]").forEach((el) => {
    el.textContent = table.essentiel.currencyText;
  });
  const diff = table.complet.amount - table.plus.amount;
  const diffText = AcadexLocalization.formatMoney(diff, table.complet.currency, currentLang, currentCountry).formatted;
  document.querySelectorAll("[data-price-template]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const kind = el.getAttribute("data-price-template");
    if (kind === "all") el.textContent = tr(key, { p1: table.essentiel.formatted, p2: table.plus.formatted, p3: table.complet.formatted });
    else if (kind === "diff") el.textContent = tr(key, { diff: diffText });
    else if (kind === "complet") el.textContent = tr(key, { price: table.complet.formatted });
  });
  renderCountryChip();
  renderPricingLocationHint();
  renderOrderHead();
}

function renderPricingLocationHint() {
  const hint = document.getElementById("pricing-loc-hint");
  const text = document.getElementById("pricing-loc-text");
  if (!hint || !text) return;
  if (countryChosenByVisitor) {
    hint.hidden = true;
    return;
  }
  const name = AcadexLocalization.countryName(currentCountry, currentLang);
  const currency = AcadexLocalization.effectiveCurrency(currentCountry, window.ACADEX_RATES);
  text.textContent = tr("pricing_loc_hint", { country: name, currency });
  hint.hidden = false;
}

function renderCountryChip() {
  const chip = document.getElementById("country-chip");
  if (!chip) return;
  const name = AcadexLocalization.countryName(currentCountry, currentLang);
  const currency = AcadexLocalization.effectiveCurrency(currentCountry, window.ACADEX_RATES);
  document.getElementById("country-chip-name").textContent = name;
  document.getElementById("country-chip-code").textContent = currentCountry;
  document.getElementById("country-chip-currency").textContent = currency;
  chip.setAttribute("aria-label", tr("country_chip_aria"));
  chip.title = `${name} · ${currency}`;
}

function countryOptions() {
  let display = null;
  let displayCurrency = null;
  try { display = new Intl.DisplayNames([currentLang], { type: "region" }); } catch {}
  try { displayCurrency = new Intl.DisplayNames([currentLang], { type: "currency" }); } catch {}
  return Object.keys(window.ACADEX_COUNTRIES)
    .map((code) => {
      const entry = window.ACADEX_COUNTRIES[code];
      const currency = entry.currency;
      let currencyName = "";
      try { currencyName = displayCurrency ? (displayCurrency.of(currency) || "") : ""; } catch {}
      return {
        code,
        name: (display && display.of(code)) || code,
        currency,
        currencyName,
        dial: entry.dial || "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, currentLang));
}

function renderCountryList(query = "") {
  const q = query.trim().toLowerCase();
  const items = countryOptions().filter((o) =>
    !q
    || o.name.toLowerCase().includes(q)
    || o.code.toLowerCase().includes(q)
    || o.currency.toLowerCase().includes(q)
    || (o.currencyName && o.currencyName.toLowerCase().includes(q))
    || (o.dial && (o.dial.includes(q) || ("+" + o.dial).includes(q))));
  const list = document.getElementById("country-list");
  list.replaceChildren(...items.map((o) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cd-item";
    btn.dataset.country = o.code;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", o.code === currentCountry ? "true" : "false");
    const name = document.createElement("span");
    name.textContent = o.name;
    const cur = document.createElement("span");
    cur.className = "cd-item-cur";
    cur.textContent = o.currency;
    btn.append(name, cur);
    li.append(btn);
    return li;
  }));
  document.getElementById("country-empty").hidden = items.length > 0;
}

function setCountry(code, persist = false) {
  if (!AcadexLocalization.isSupportedCountry(code)) return;
  currentCountry = code;
  countryChosenByVisitor = true;
  if (persist) {
    try { localStorage.setItem("acadex_country", code); } catch {}
  }
  renderPrices();
  document.dispatchEvent(new CustomEvent("acadex:country"));
}


const countryDialog = document.getElementById("country-dialog");
const countrySearch = document.getElementById("country-search");
function openCountryDialog() {
  countrySearch.value = "";
  renderCountryList("");
  if (typeof countryDialog.showModal === "function") countryDialog.showModal();
  else countryDialog.setAttribute("open", "");
  countrySearch.focus();
}
document.getElementById("country-chip").addEventListener("click", openCountryDialog);
const pricingLocChange = document.getElementById("pricing-loc-change");
if (pricingLocChange) pricingLocChange.addEventListener("click", openCountryDialog);
countrySearch.addEventListener("input", () => renderCountryList(countrySearch.value));
document.getElementById("country-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-country]");
  if (!btn) return;
  setCountry(btn.dataset.country, true);
  if (typeof countryDialog.close === "function") countryDialog.close();
  else countryDialog.removeAttribute("open");
});
countryDialog.querySelectorAll("[data-country-close]").forEach((btn) => btn.addEventListener("click", () => countryDialog.close()));
countryDialog.addEventListener("click", (e) => { if (e.target === countryDialog) countryDialog.close(); });

initLocalization();

// Scroll reveal: only what is below the fold when the script starts is hidden,
// then shown as it scrolls into view. Above the fold, nothing moves.
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  const fold = window.innerHeight;
  document.querySelectorAll(".reveal").forEach(el => {
    if (el.getBoundingClientRect().top < fold) return;
    el.classList.add("pre");
    observer.observe(el);
  });
}

// FAQ Accordion
document.querySelectorAll(".faq-card").forEach(card => {
  const btn = card.querySelector(".faq-btn");
  btn.addEventListener("click", () => {
    const isOpen = card.classList.contains("active");
    document.querySelectorAll(".faq-card").forEach(c => c.classList.remove("active"));
    if (!isOpen) card.classList.add("active");
  });
});

// Mobile menu
const navToggle = document.getElementById("nav-toggle");
const navLinks = document.getElementById("nav-links");
const setMenu = (open) => {
  navLinks.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
};
navToggle.addEventListener("click", () => setMenu(!navLinks.classList.contains("open")));
navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// Comparison Table Mobile Tabs
const cmpBox = document.getElementById("cmp-box");
const cmpScrollHint = document.getElementById("cmp-scroll-hint");
const cmpTabs = document.querySelectorAll(".cmp-tab-btn");

cmpTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-cmp-tab");
    cmpTabs.forEach(b => b.classList.toggle("active", b === btn));
    if (cmpBox) {
      cmpBox.setAttribute("data-pack-view", tab);
      if (tab !== "all" && cmpScrollHint) {
        cmpScrollHint.classList.add("is-hidden");
      } else if (tab === "all" && cmpScrollHint) {
        cmpScrollHint.classList.remove("is-hidden");
      }
    }
  });
});

if (cmpBox && cmpScrollHint) {
  cmpBox.addEventListener("scroll", () => {
    if (Math.abs(cmpBox.scrollLeft) > 15) {
      cmpScrollHint.classList.add("is-hidden");
    }
  }, { passive: true });
}

// ── Hero Demo Video Controls & Performance Observer ──────────
const heroVideo = document.getElementById("hero-demo-video");
const playToggle = document.getElementById("mockup-play-toggle");
const centerPlay = document.getElementById("mockup-center-play");
const fullscreenBtn = document.getElementById("mockup-fullscreen");
const videoWrap = document.getElementById("mockup-video-wrap");

// ── Cinematic Video Theater Modal Elements ──────────────────
const theaterOverlay = document.getElementById("theater-overlay");
const theaterBackdrop = document.getElementById("theater-backdrop");
const theaterCloseBtn = document.getElementById("theater-close-btn");
const theaterCloseDot = document.getElementById("theater-close-dot");
const theaterStage = document.getElementById("theater-stage");
const theaterVideo = document.getElementById("theater-video");
const theaterCenterPlay = document.getElementById("theater-center-play");
const theaterPlayToggle = document.getElementById("theater-play-toggle");
const theaterMuteToggle = document.getElementById("theater-mute-toggle");
const theaterProgressWrap = document.getElementById("theater-progress-wrap");
const theaterProgressBar = document.getElementById("theater-progress-bar");
const theaterTime = document.getElementById("theater-time");
const theaterNativeFs = document.getElementById("theater-native-fs");

const formatSec = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
};

let idleTimer = null;
const resetTheaterIdle = () => {
  if (!theaterStage) return;
  theaterStage.classList.remove("is-idle");
  theaterStage.classList.add("controls-visible");
  clearTimeout(idleTimer);
  if (theaterVideo && !theaterVideo.paused) {
    idleTimer = setTimeout(() => {
      theaterStage.classList.remove("controls-visible");
      theaterStage.classList.add("is-idle");
    }, 2500);
  }
};

const updateTheaterPlayState = (isPlaying) => {
  if (!theaterPlayToggle) return;
  const pPause = theaterPlayToggle.querySelector(".th-pause");
  const pPlay = theaterPlayToggle.querySelector(".th-play");
  if (pPause) pPause.style.display = isPlaying ? "block" : "none";
  if (pPlay) pPlay.style.display = isPlaying ? "none" : "block";
  if (theaterCenterPlay) theaterCenterPlay.style.display = isPlaying ? "none" : "grid";
  if (theaterStage) theaterStage.classList.toggle("playing", isPlaying);
};

const openTheater = () => {
  if (!theaterOverlay || !theaterVideo) return;
  theaterOverlay.classList.add("open");
  theaterOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  if (heroVideo) {
    try {
      theaterVideo.currentTime = heroVideo.currentTime || 0;
      heroVideo.pause();
    } catch {}
  }
  theaterVideo.play().catch(() => {});
  updateTheaterPlayState(true);
  resetTheaterIdle();
};

const closeTheater = () => {
  if (!theaterOverlay || !theaterVideo) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  theaterOverlay.classList.remove("open");
  theaterOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  if (heroVideo) {
    try {
      heroVideo.currentTime = theaterVideo.currentTime || 0;
      heroVideo.play().catch(() => {});
    } catch {}
  }
  theaterVideo.pause();
  updateTheaterPlayState(false);
};

if (theaterCloseBtn) theaterCloseBtn.addEventListener("click", closeTheater);
if (theaterCloseDot) theaterCloseDot.addEventListener("click", closeTheater);
if (theaterBackdrop) theaterBackdrop.addEventListener("click", closeTheater);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && theaterOverlay && theaterOverlay.classList.contains("open")) {
    if (!document.fullscreenElement) {
      closeTheater();
    }
  }
});

const toggleTheaterPlay = () => {
  if (!theaterVideo) return;
  if (theaterVideo.paused) {
    theaterVideo.play().catch(() => {});
    updateTheaterPlayState(true);
    resetTheaterIdle();
  } else {
    theaterVideo.pause();
    updateTheaterPlayState(false);
    resetTheaterIdle();
  }
};

if (theaterPlayToggle) theaterPlayToggle.addEventListener("click", (e) => { e.stopPropagation(); toggleTheaterPlay(); });
if (theaterCenterPlay) theaterCenterPlay.addEventListener("click", (e) => { e.stopPropagation(); toggleTheaterPlay(); });

if (theaterVideo) {
  theaterVideo.addEventListener("click", toggleTheaterPlay);
  theaterVideo.addEventListener("play", () => updateTheaterPlayState(true));
  theaterVideo.addEventListener("pause", () => updateTheaterPlayState(false));
  theaterVideo.addEventListener("timeupdate", () => {
    const cur = theaterVideo.currentTime || 0;
    const dur = theaterVideo.duration || 0;
    if (theaterProgressBar && dur > 0) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      theaterProgressBar.style.width = `${pct}%`;
    }
    if (theaterTime) {
      theaterTime.textContent = `${formatSec(cur)} / ${formatSec(dur)}`;
    }
  });
  theaterVideo.addEventListener("loadedmetadata", () => {
    if (theaterTime) {
      theaterTime.textContent = `0:00 / ${formatSec(theaterVideo.duration || 0)}`;
    }
  });
}

// Scrub bar interaction (click & drag)
if (theaterProgressWrap && theaterVideo) {
  const seekTheater = (e) => {
    const rect = theaterProgressWrap.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (theaterVideo.duration) {
      theaterVideo.currentTime = ratio * theaterVideo.duration;
    }
  };
  let isDraggingTheater = false;
  theaterProgressWrap.addEventListener("mousedown", (e) => {
    isDraggingTheater = true;
    seekTheater(e);
    resetTheaterIdle();
  });
  window.addEventListener("mousemove", (e) => {
    if (isDraggingTheater) {
      seekTheater(e);
      resetTheaterIdle();
    }
  });
  window.addEventListener("mouseup", () => {
    isDraggingTheater = false;
  });
  theaterProgressWrap.addEventListener("touchstart", (e) => {
    isDraggingTheater = true;
    seekTheater(e);
    resetTheaterIdle();
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (isDraggingTheater) seekTheater(e);
  }, { passive: true });
  window.addEventListener("touchend", () => {
    isDraggingTheater = false;
  });
}

// Mute / Unmute
if (theaterMuteToggle && theaterVideo) {
  theaterMuteToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    theaterVideo.muted = !theaterVideo.muted;
    const unmuted = theaterMuteToggle.querySelector(".th-unmuted");
    const muted = theaterMuteToggle.querySelector(".th-muted");
    if (unmuted) unmuted.style.display = theaterVideo.muted ? "none" : "block";
    if (muted) muted.style.display = theaterVideo.muted ? "block" : "none";
    resetTheaterIdle();
  });
}

// OS Fullscreen toggle on theaterStage
if (theaterNativeFs && theaterStage) {
  theaterNativeFs.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      if (theaterStage.requestFullscreen) theaterStage.requestFullscreen().catch(() => {});
      else if (theaterVideo.requestFullscreen) theaterVideo.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    resetTheaterIdle();
  });
}

if (theaterStage) {
  theaterStage.addEventListener("mousemove", resetTheaterIdle);
  theaterStage.addEventListener("touchstart", resetTheaterIdle, { passive: true });
}

if (heroVideo) {
  const iconPause = playToggle ? playToggle.querySelector(".icon-pause") : null;
  const iconPlay = playToggle ? playToggle.querySelector(".icon-play") : null;

  const updatePlayState = (isPlaying) => {
    if (iconPause) iconPause.style.display = isPlaying ? "block" : "none";
    if (iconPlay) iconPlay.style.display = isPlaying ? "none" : "block";
    if (centerPlay) centerPlay.style.display = isPlaying ? "none" : "grid";
  };

  const togglePlay = () => {
    if (heroVideo.paused) {
      heroVideo.play().catch(() => {});
      updatePlayState(true);
    } else {
      heroVideo.pause();
      updatePlayState(false);
    }
  };

  if (playToggle) playToggle.addEventListener("click", (e) => { e.stopPropagation(); togglePlay(); });
  if (videoWrap) {
    videoWrap.addEventListener("click", togglePlay);
    videoWrap.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      openTheater();
    });
  }

  heroVideo.addEventListener("play", () => updatePlayState(true));
  heroVideo.addEventListener("pause", () => updatePlayState(false));

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTheater();
    });
  }

  if ("IntersectionObserver" in window) {
    const videoObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !heroVideo.paused && (!theaterOverlay || !theaterOverlay.classList.contains("open"))) {
        heroVideo.pause();
      } else if (entry.isIntersecting && heroVideo.paused && (!theaterOverlay || !theaterOverlay.classList.contains("open"))) {
        heroVideo.play().catch(() => {});
      }
    }, { threshold: 0.15 });
    videoObserver.observe(heroVideo);
  }
}

// Sticky mobile call-to-action: on screen from the first view, WhatsApp first.
const mobileCta = document.getElementById("mobile-cta");
if (mobileCta) mobileCta.classList.add("show");

// ── Ordering a pack, on the page ─────────────────────────────
// The form posts to the same Cloudflare Worker that serves the download:
// no server of ours to keep running. If the worker cannot take the order
// (offline, not deployed yet), the visitor is handed their order as a text
// to send directly — an order is never lost in a failed request.
const showOrderStep = (name) => {
  orderDialog.querySelectorAll(".od-step").forEach(el => el.classList.toggle("active", el.dataset.step === name));
  orderDialog.querySelector(".od-body").scrollTop = 0;
};

const clearOrderError = () => {
  orderError.classList.remove("show");
  orderError.textContent = "";
  orderForm.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
};

const showOrderError = (message, field) => {
  orderError.textContent = message;
  orderError.classList.add("show");
  const input = field && orderForm.elements[field];
  if (input && input.classList) {
    input.classList.add("invalid");
    input.focus();
  }
};

/**
 * The form asks a name and a phone, nothing else: the pack is the one whose
 * button was clicked, and the heading says which, at what price, paid once.
 */
function syncPackSelector(key) {
  const selector = document.getElementById("od-packs-selector");
  if (!selector) return;
  selector.querySelectorAll(".od-pack-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.getAttribute("data-pack") === key);
  });
}

function renderOrderHead() {
  const key = packKey(orderForm.elements.pack.value);
  const pack = PACKS[key];
  orderDialog.dataset.pack = key;
  syncPackSelector(key);
  document.getElementById("od-title").textContent = tr("od_title", { pack: pack.label });
  const terms = document.getElementById("od-terms");
  const packPrice = priceFor(key);
  const price = document.createElement("b");
  price.textContent = packPrice.formatted;
  if (packPrice.oldFormatted) {
    const old = document.createElement("del");
    old.className = "od-old-price";
    old.textContent = packPrice.oldFormatted;
    terms.replaceChildren(old, " ", price, ` · ${tr("od_terms")}`);
  } else {
    terms.replaceChildren(price, ` · ${tr("od_terms")}`);
  }
}

const packSelector = document.getElementById("od-packs-selector");
if (packSelector) {
  packSelector.querySelectorAll(".od-pack-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = packKey(btn.getAttribute("data-pack"));
      orderForm.elements.pack.value = key;
      renderOrderHead();
    });
  });
}

function openOrder(pack) {
  orderForm.elements.pack.value = packKey(pack);
  renderOrderHead();
  clearOrderError();
  orderShown = null;
  showOrderStep("form");
  if (typeof orderDialog.showModal === "function") {
    if (!orderDialog.open) orderDialog.showModal();
  } else {
    orderDialog.setAttribute("open", "");
  }
  const firstEmpty = ["contact_name", "phone"].map(n => orderForm.elements[n]).find(el => !el.value.trim());
  (firstEmpty || orderSubmit).focus();
}

const closeOrder = () => {
  if (typeof orderDialog.close === "function") orderDialog.close();
  else orderDialog.removeAttribute("open");
};

document.querySelectorAll("[data-order-pack]").forEach(btn => {
  btn.addEventListener("click", () => openOrder(btn.getAttribute("data-order-pack")));
});
orderDialog.querySelectorAll("[data-od-close]").forEach(btn => btn.addEventListener("click", closeOrder));
// A click on the dimmed backdrop lands on the dialog element itself.
orderDialog.addEventListener("click", (e) => { if (e.target === orderDialog && !orderBusy) closeOrder(); });
orderDialog.addEventListener("cancel", (e) => { if (orderBusy) e.preventDefault(); });
orderForm.addEventListener("input", (e) => {
  if (e.target.classList && e.target.classList.contains("invalid")) clearOrderError();
});

// ── Phone Input: the dial prefix belongs to the chosen country ─
const phoneInput = document.getElementById("od-phone");

/** Digits only; Tunisia keeps its familiar xx xxx xxx, others group by three. */
const formatPhoneNumber = (val, country) => {
  let digits = String(val || "").replace(/\D/g, "").slice(0, 15);
  if (country === "TN") {
    if (digits.startsWith("00216") && digits.length >= 13) digits = digits.slice(5);
    else if (digits.startsWith("216") && digits.length >= 11) digits = digits.slice(3);
    digits = digits.slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }
  return (digits.match(/\d{1,3}/g) || []).join(" ");
};

function updateOrderDial() {
  const dial = (window.ACADEX_COUNTRIES[currentCountry] || {}).dial || "";
  const el = document.getElementById("od-dial");
  if (el) el.textContent = dial ? `+${dial}` : "";
}

function populateOrderCountries() {
  const select = document.getElementById("od-country");
  if (select) {
    select.replaceChildren(...countryOptions().map((o) => {
      const opt = document.createElement("option");
      opt.value = o.code;
      opt.textContent = `+${window.ACADEX_COUNTRIES[o.code].dial} · ${o.name}`;
      return opt;
    }));
    select.value = currentCountry;
  }
  updateOrderDial();
}

const odCountrySelect = document.getElementById("od-country");
if (odCountrySelect) odCountrySelect.addEventListener("change", (e) => {
  setCountry(e.target.value, true);
});
document.addEventListener("acadex:country", () => {
  const select = document.getElementById("od-country");
  if (select) select.value = currentCountry;
  updateOrderDial();
  if (phoneInput && phoneInput.value) phoneInput.value = formatPhoneNumber(phoneInput.value, currentCountry);
});

if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatPhoneNumber(phoneInput.value, currentCountry);
  });
  phoneInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text") || "";
    phoneInput.value = formatPhoneNumber(text, currentCountry);
    if (phoneInput.classList.contains("invalid")) clearOrderError();
  });
  phoneInput.addEventListener("keydown", (e) => {
    if (
      ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter"].includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  });
}

function readOrder() {
  const data = new FormData(orderForm);
  const value = (name) => String(data.get(name) || "").trim();
  const name = value("contact_name");
  const pack = PACKS[value("pack")] ? value("pack") : "complet";
  const country = currentCountry;
  const dial = (window.ACADEX_COUNTRIES[country] || {}).dial || "";
  const national = value("phone");
  const price = priceFor(pack);
  return {
    pack,
    billing: "once",
    contact_name: name,
    school_name: name,
    phone: AcadexOrder.normalizePhone(dial, national) || national,
    country,
    currency: price.currency,
    amount_minor: price.amountMinor,
    quote: price,
    website: value("website"),
    lang: currentLang,
  };
}

/** The same rules the worker applies, so most mistakes are caught before the request. */
function invalidOrderField(order) {
  if (order.contact_name.length < 2) return "contact_name";
  const digits = order.phone.replace(/\D/g, "");
  if (!order.phone.startsWith("+") || digits.length < 8 || digits.length > 15) return "phone";
  return null;
}


function renderOrderOutcome() {
  if (!orderShown) return;
  const { order, reference } = orderShown;
  const pack = PACKS[order.pack] || PACKS.complet;
  if (!reference) return;
  document.getElementById("od-ref").textContent = reference;
  document.getElementById("od-next2").textContent = tr("od_next2", { phone: order.phone });
  document.getElementById("od-next3").textContent = tr("od_next3", { pack: pack.label });
}

const setOrderBusy = (busy) => {
  orderBusy = busy;
  orderSubmit.disabled = busy;
  orderSubmit.classList.toggle("busy", busy);
  orderSubmitLabel.textContent = tr(busy ? "od_sending" : "od_submit");
};

orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (orderBusy) return;
  clearOrderError();
  const order = readOrder();
  const bad = invalidOrderField(order);
  if (bad) return showOrderError(tr(FIELD_ERRORS[bad]), bad);

  const payload = AcadexOrder.buildOrderPayload({
    pack: order.pack,
    contactName: order.contact_name,
    phone: order.phone,
    country: order.country,
    currency: order.currency,
    amountMinor: order.amount_minor,
    lang: order.lang,
    website: order.website,
  });
  if (!payload) return showOrderError(tr("od_err_phone"), "phone");

  setOrderBusy(true);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12000);

  let saved = false;
  let finalRef = null;

  try {
    const res = await fetch("/api/order-notion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, amount_text: priceFor(order.pack).formatted }),
      signal: abort.signal,
    });
    const answer = await res.json().catch(() => ({}));
    if (res.status === 201 && answer.reference) {
      saved = true;
      finalRef = answer.reference;
    } else if (res.status === 400 && FIELD_ERRORS[answer.field]) {
      clearTimeout(timer);
      setOrderBusy(false);
      return showOrderError(tr(FIELD_ERRORS[answer.field]), answer.field);
    } else if (res.status === 429) {
      clearTimeout(timer);
      setOrderBusy(false);
      return showOrderError(tr("od_err_rate"));
    }
  } catch {
    // Notion endpoint offline or not responding
  } finally {
    clearTimeout(timer);
  }

  setOrderBusy(false);

  if (saved) {
    orderShown = { order, reference: finalRef };
    renderOrderOutcome();
    showOrderStep("done");
  } else {
    orderShown = { order, reference: null };
    renderOrderOutcome();
    showOrderStep("fallback");
  }
});

// A link can open the form directly (…/#order-complet): for a message, an ad, a QR code.
const orderHash = /^#order(?:-(essentiel|plus|complet))?$/.exec(location.hash);
if (orderHash) openOrder(orderHash[1] || "complet");
else renderOrderHead();

document.getElementById("od-fb-retry").addEventListener("click", () => {
  orderShown = null;
  showOrderStep("form");
});

document.getElementById("od-copy").addEventListener("click", async (e) => {
  const button = e.currentTarget;
  try {
    await navigator.clipboard.writeText(document.getElementById("od-ref").textContent);
    button.textContent = tr("od_copied");
    setTimeout(() => { button.textContent = tr("od_copy"); }, 1800);
  } catch {
    /* no clipboard permission: the reference stays on screen to be read */
  }
});

// Dynamic live version check from Cloudflare update feed
let versionLabel = null;
function setVersionLabel(label) {
  if (label) versionLabel = label;
  if (!versionLabel) return;
  document.querySelectorAll("[data-version]").forEach((el) => {
    el.textContent = el.textContent.replace(/Acadex d+.d+/, `Acadex ${versionLabel}`);
  });
}
(async () => {
  try {
    const res = await fetch("https://acadex-backup.zglm.workers.dev/updates/latest.yml", { cache: "no-store" });
    if (!res.ok) return;
    const text = await res.text();
    const match = text.match(/^version:\s*(.+)$/m);
    if (match) {
      const v = match[1].trim();
      // One label everywhere: a published non-alpha build moves every
      // "Acadex X.Y" on the page together (hero badge, demo window, footer).
      const parts = /^(d+).(d+)./.exec(v);
      if (parts && !/alpha|beta|rc/i.test(v)) setVersionLabel(`${parts[1]}.${parts[2]}`);
    }
  } catch {}
})();
