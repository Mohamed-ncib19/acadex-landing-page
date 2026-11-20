(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AcadexOrder = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PACKS = ["essentiel", "plus", "complet"];

  function normalizePhone(dial, national) {
    let digits = String(national).replace(/[^0-9]/g, "");
    if (digits.slice(0, 2) === "00") {
      digits = digits.slice(2);
    }
    if (
      typeof dial === "string" && dial.length > 0 &&
      digits.slice(0, dial.length) === dial &&
      digits.length - dial.length >= 4
    ) {
      digits = digits.slice(dial.length);
    }
    if (digits.slice(0, 1) === "0") {
      digits = digits.slice(1);
    }
    if (typeof dial !== "string" || dial.length === 0) return null;
    if (digits.length < 4) return null;
    const total = dial.length + digits.length;
    if (total < 8 || total > 15) return null;
    return "+" + dial + digits;
  }

  function buildOrderPayload(input) {
    const args = input || {};
    const pack = args.pack;
    const contactName = args.contactName;
    const phone = args.phone;
    const country = args.country;
    const currency = args.currency;
    const amountMinor = args.amountMinor;
    const lang = args.lang;
    const website = args.website;

    if (PACKS.indexOf(pack) === -1) return null;
    if (typeof contactName !== "string" || contactName.trim().length < 2) return null;
    if (typeof phone !== "string" || phone.indexOf("+") !== 0) return null;
    if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) return null;
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return null;
    if (
      typeof amountMinor !== "number" ||
      !Number.isInteger(amountMinor) ||
      amountMinor < 0
    ) return null;

    return {
      pack: pack,
      billing: "once",
      school_name: contactName.trim(),
      contact_name: contactName.trim(),
      phone: phone,
      country: country,
      currency: currency,
      amount_minor: amountMinor,
      lang: lang,
      website: website || ""
    };
  }

  return {
    normalizePhone: normalizePhone,
    buildOrderPayload: buildOrderPayload
  };
});
