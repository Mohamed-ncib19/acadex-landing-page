"use strict";

function countryFromHeader(value) {
  if (typeof value !== "string") return null;
  const country = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) return country;
  return null;
}

function handler(req, res) {
  const country = countryFromHeader(req.headers["x-vercel-ip-country"]);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ country: country }));
}

module.exports = handler;
module.exports.countryFromHeader = countryFromHeader;
