(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./countries.js"), require("./rates.js"));
  } else {
    root.AcadexLocalization = factory(root.ACADEX_COUNTRIES, root.ACADEX_RATES);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (COUNTRIES, RATES) {
  "use strict";

  const SUPPORTED_LANGUAGES = ["ar", "fr", "en"];

  const ANCHORS = {
    TND: { essentiel: 150, plus: 249, complet: 299 },
    EUR: { essentiel: 59, plus: 99, complet: 129 },
    SAR: { essentiel: 249, plus: 399, complet: 499 },
    USD: { essentiel: 59, plus: 99, complet: 129 }
  };

  const OLD_RATIO = { plus: 450 / 249, complet: 600 / 299 };

  const MAGHREB = ["TN", "DZ", "MA", "LY", "MR"];
  const EUROPE = [
    "AD", "AL", "AM", "AT", "AX", "AZ", "BA", "BE", "BG", "BY", "CH", "CY",
    "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GE", "GR", "HR", "HU",
    "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT",
    "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SK", "SM", "TR",
    "UA", "VA", "XK"
  ];
  const GCC = ["SA", "AE", "QA", "KW", "BH", "OM"];

  function upper(code) {
    return typeof code === "string" ? code.trim().toUpperCase() : "";
  }

  function rateTable(rates) {
    return (rates || RATES || {}).units_per_usd || {};
  }

  function isSupportedCountry(code) {
    const key = upper(code);
    return key.length > 0 && Object.prototype.hasOwnProperty.call(COUNTRIES || {}, key);
  }

  function anchorCurrency(country) {
    const code = upper(country);
    if (MAGHREB.indexOf(code) !== -1) return "TND";
    if (EUROPE.indexOf(code) !== -1) return "EUR";
    if (GCC.indexOf(code) !== -1) return "SAR";
    return "USD";
  }

  function effectiveCurrency(country, rates) {
    const code = upper(country);
    const entry = (COUNTRIES || {})[code];
    const local = entry && entry.currency;
    const rate = local ? rateTable(rates)[local] : undefined;
    if (typeof rate === "number" && rate > 0) return local;
    return anchorCurrency(code);
  }

  function convertAmount(amount, from, to, rates) {
    const table = rateTable(rates);
    const fromRate = table[from];
    const toRate = table[to];
    if (!(typeof fromRate === "number" && fromRate > 0)) return null;
    if (!(typeof toRate === "number" && toRate > 0)) return null;
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;
    return (value / fromRate) * toRate;
  }

  function fractionDigits(currency) {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: currency
      }).resolvedOptions().maximumFractionDigits;
    } catch (error) {
      return 2;
    }
  }

  function magnitudeStep(value) {
    if (value >= 1e6) return 1e5;
    if (value >= 1e5) return 1e4;
    if (value >= 1e4) return 1e3;
    if (value >= 1e3) return 100;
    if (value >= 100) return 10;
    if (value >= 10) return 5;
    return 1;
  }

  function clean(value) {
    return Math.round(value * 1e6) / 1e6;
  }

  function roundAmount(value, currency) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    const digits = fractionDigits(currency);

    if (digits === 0) {
      const step = magnitudeStep(Math.abs(amount));
      return Math.round(Math.round(amount / step) * step);
    }
    if (digits === 3 && amount < 10) {
      return clean(Math.round(amount * 2) / 2);
    }
    if (amount < 10) {
      return clean(Math.round(amount));
    }
    const step = magnitudeStep(amount);
    return clean(Math.round(amount / step) * step);
  }

  function isSupportedLocale(locale) {
    if (!locale) return false;
    try {
      return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0;
    } catch (error) {
      return false;
    }
  }

  function candidateLocales(lang, country) {
    const locales = [];
    const language = typeof lang === "string" ? lang.toLowerCase() : "";
    const region = upper(country);

    if (language && region && isSupportedLocale(language + "-" + region)) {
      locales.push(language + "-" + region);
    }
    if (language && isSupportedLocale(language)) locales.push(language);
    if (locales.indexOf("en") === -1) locales.push("en");
    return locales;
  }

  function formatMoney(amount, currency, lang, country) {
    const value = Number(amount);
    const safeValue = Number.isFinite(value) ? value : 0;
    const digits = fractionDigits(currency);
    const options = { minimumFractionDigits: 0, maximumFractionDigits: digits };

    let amountText = String(safeValue);
    let formatted = amountText + " " + currency;
    let currencyText = currency;

    const locales = candidateLocales(lang, country);
    for (let i = 0; i < locales.length; i += 1) {
      try {
        const numberFormat = new Intl.NumberFormat(locales[i], options);
        const currencyFormat = new Intl.NumberFormat(locales[i], {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
          style: "currency",
          currency: currency
        });
        amountText = numberFormat.format(safeValue);
        formatted = currencyFormat.format(safeValue);
        const parts = currencyFormat.formatToParts(safeValue);
        const currencyPart = parts.find(function (part) {
          return part.type === "currency";
        });
        currencyText = currencyPart ? currencyPart.value : currency;
        break;
      } catch (error) {
        // Try the next locale candidate; the last resort keeps the raw text.
      }
    }

    return {
      amount: safeValue,
      currency: currency,
      amountText: amountText,
      currencyText: currencyText,
      formatted: formatted,
      amountMinor: Math.round(safeValue * Math.pow(10, digits))
    };
  }

  function buildPack(anchorAmount, currency, anchorCurrencyCode, lang, country, rates, ratio) {
    let amount = anchorAmount;
    if (currency !== anchorCurrencyCode) {
      const converted = convertAmount(anchorAmount, anchorCurrencyCode, currency, rates);
      if (converted === null) {
        currency = anchorCurrencyCode;
      } else {
        amount = roundAmount(converted, currency);
      }
    }

    const money = formatMoney(amount, currency, lang, country);
    const pack = {
      amount: money.amount,
      currency: money.currency,
      amountText: money.amountText,
      currencyText: money.currencyText,
      formatted: money.formatted,
      amountMinor: money.amountMinor,
      oldAmount: null,
      oldAmountText: null,
      oldFormatted: null
    };

    if (ratio) {
      let oldAmount = anchorAmount * ratio;
      if (currency !== anchorCurrencyCode) {
        const convertedOld = convertAmount(oldAmount, anchorCurrencyCode, currency, rates);
        if (convertedOld === null) {
          oldAmount = anchorAmount * ratio;
          currency = anchorCurrencyCode;
        } else {
          oldAmount = convertedOld;
        }
      }
      const oldMoney = formatMoney(roundAmount(oldAmount, currency), currency, lang, country);
      pack.oldAmount = oldMoney.amount;
      pack.oldAmountText = oldMoney.amountText;
      pack.oldFormatted = oldMoney.formatted;
    }

    return pack;
  }

  function priceTable(country, lang, rates) {
    const code = upper(country);
    const anchor = anchorCurrency(code);
    const anchorAmounts = ANCHORS[anchor];
    const local = effectiveCurrency(code, rates);
    const currency = local;

    return {
      essentiel: buildPack(anchorAmounts.essentiel, currency, anchor, lang, code, rates, null),
      plus: buildPack(anchorAmounts.plus, currency, anchor, lang, code, rates, OLD_RATIO.plus),
      complet: buildPack(anchorAmounts.complet, currency, anchor, lang, code, rates, OLD_RATIO.complet)
    };
  }

  function countryFromBrowser(languages) {
    if (!languages) return null;
    const list = typeof languages === "string" ? [languages] : languages;
    if (typeof list.length !== "number") return null;

    for (let i = 0; i < list.length; i += 1) {
      const tag = list[i];
      if (typeof tag !== "string" || tag.length === 0) continue;

      let region = null;
      try {
        const locale = new Intl.Locale(tag);
        region = locale.region || null;
      } catch (error) {
        const parts = tag.split(/[-_]/);
        const match = parts.slice(1).find(function (part) {
          return /^[A-Za-z]{2}$/.test(part);
        });
        region = match ? match.toUpperCase() : null;
      }

      if (region && isSupportedCountry(region)) return upper(region);
    }
    return null;
  }

  function resolveLanguage(options) {
    const input = options || {};
    const saved = typeof input.saved === "string" ? input.saved.toLowerCase() : "";
    if (SUPPORTED_LANGUAGES.indexOf(saved) !== -1) return saved;

    const languages = Array.isArray(input.languages) ? input.languages : [];
    for (let i = 0; i < languages.length; i += 1) {
      const tag = languages[i];
      if (typeof tag !== "string" || tag.length === 0) continue;
      const prefix = tag.toLowerCase().split(/[-_]/)[0];
      if (SUPPORTED_LANGUAGES.indexOf(prefix) !== -1) return prefix;
    }

    const entry = (COUNTRIES || {})[upper(input.country)];
    if (entry && SUPPORTED_LANGUAGES.indexOf(entry.lang) !== -1) return entry.lang;

    return "fr";
  }

  function countryName(code, lang) {
    const key = upper(code);
    if (!isSupportedCountry(key)) return code;
    try {
      const locale = SUPPORTED_LANGUAGES.indexOf(lang) !== -1 ? lang : "fr";
      const names = new Intl.DisplayNames([locale], { type: "region" });
      return names.of(key) || code;
    } catch (error) {
      return code;
    }
  }

  return {
    SUPPORTED_LANGUAGES: SUPPORTED_LANGUAGES,
    ANCHORS: ANCHORS,
    anchorCurrency: anchorCurrency,
    effectiveCurrency: effectiveCurrency,
    convertAmount: convertAmount,
    fractionDigits: fractionDigits,
    roundAmount: roundAmount,
    formatMoney: formatMoney,
    priceTable: priceTable,
    countryFromBrowser: countryFromBrowser,
    resolveLanguage: resolveLanguage,
    countryName: countryName,
    isSupportedCountry: isSupportedCountry
  };
});
