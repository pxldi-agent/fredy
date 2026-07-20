/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import * as cheerio from 'cheerio';
import { buildHash, isOneOf } from '../utils.js';
import checkIfListingIsActive from '../services/listings/listingActiveTester.js';
import { extractNumber } from '../utils/extract-number.js';
/** @import { ParsedListing } from '../types/listing.js' */
/** @import { ProviderConfig } from '../types/providerConfig.js' */

const BASE_URL = 'https://www.vierwaen.de';
const FEED_URL = `${BASE_URL}/rss_angebot.xml`;

let appliedBlackList = [];

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string|null|undefined} link
 * @returns {string|null}
 */
function toAbsoluteLink(link) {
  if (!link) return null;
  return link.startsWith('http') ? link : `${BASE_URL}/${link.replace(/^\//, '')}`;
}

/**
 * @param {string} link
 * @returns {string|null}
 */
function extractListingId(link) {
  return link.match(/\.A(\d+)\.html/i)?.[1] ?? null;
}

/**
 * @param {string} text
 * @returns {number|null}
 */
function extractRooms(text) {
  if (/WG Zimmer/i.test(text)) return 1;
  if (/mehr als 3 Zimmer/i.test(text)) return 4;
  return extractNumber(text.match(/(\d+(?:[,.]\d+)?)\s*Zimmer/i)?.[0]);
}

/**
 * @param {string} description
 * @returns {string|null}
 */
function extractAddress(description) {
  const location = description.match(/\bin\s+(.+?)(?:;\s*Miete:|;\s*Ab:|$)/i)?.[1];
  return cleanText(location) || null;
}

/**
 * @param {string} xml
 * @returns {any[]}
 */
function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $('item')
    .map((_, item) => ({
      title: cleanText($(item).find('title').first().text()),
      link: cleanText($(item).find('link').first().text()),
      description: cleanText($(item).find('description').first().text()),
      pubDate: cleanText($(item).find('pubDate').first().text()),
      guid: cleanText($(item).find('guid').first().text()),
    }))
    .get();
}

/**
 * @param {string} url
 * @returns {Promise<any[]>}
 */
async function getListings(url) {
  const response = await fetch(url);
  if (!response.ok) return [];
  return parseFeed(await response.text());
}

/**
 * @param {any} o
 * @returns {ParsedListing}
 */
function normalize(o) {
  const link = toAbsoluteLink(o.link || o.guid) || config.url;
  const listingId = extractListingId(link);
  const description = cleanText(o.description);

  return {
    id: buildHash(listingId || link),
    link,
    title: o.title || '',
    price: extractNumber(description.match(/Miete:\s*([^;]+)/i)?.[1]),
    size: null,
    rooms: extractRooms(`${o.title} ${description}`),
    address: extractAddress(description),
    image: null,
    description,
  };
}

/**
 * @param {ParsedListing} o
 * @returns {boolean}
 */
function applyBlacklist(o) {
  const titleNotBlacklisted = !isOneOf(o.title, appliedBlackList);
  const descNotBlacklisted = !isOneOf(o.description, appliedBlackList);
  return titleNotBlacklisted && descNotBlacklisted;
}

/** @type {ProviderConfig} */
const config = {
  requiredFieldNames: ['id', 'link', 'title', 'price', 'size', 'rooms', 'address', 'image', 'description'],
  url: null,
  sortByDateParam: null,
  crawlContainer: null,
  crawlFields: {},
  getListings,
  normalize,
  filter: applyBlacklist,
  activeTester: checkIfListingIsActive,
};

export const init = (sourceConfig, blacklist) => {
  config.enabled = sourceConfig.enabled;
  config.url = FEED_URL;
  appliedBlackList = blacklist || [];
};

export const metaInformation = {
  name: 'Vierwände',
  baseUrl: BASE_URL,
  id: 'vierwaen',
};

export { config };
