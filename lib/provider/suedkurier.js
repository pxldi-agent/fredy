/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import { buildHash, isOneOf } from '../utils.js';
import checkIfListingIsActive from '../services/listings/listingActiveTester.js';
import { extractNumber } from '../utils/extract-number.js';
/** @import { ParsedListing } from '../types/listing.js' */
/** @import { ProviderConfig } from '../types/providerConfig.js' */

const BASE_URL = 'https://anzeigen.suedkurier.de';

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
  if (link.startsWith('http')) return link;
  if (link.startsWith('//')) return `https:${link}`;
  return `${BASE_URL}/${link.replace(/^\//, '')}`;
}

/**
 * @param {string} text
 * @returns {number|null}
 */
function extractRooms(text) {
  return extractNumber(text.match(/(\d+(?:[,.]\d+)?)\s*(?:zimmer|zi\.?)/i)?.[0]);
}

/**
 * @param {string} text
 * @returns {number|null}
 */
function extractSize(text) {
  return extractNumber(text.match(/(\d+(?:[,.]\d+)?)\s*m²/i)?.[0]);
}

/**
 * @param {string|null|undefined} image
 * @returns {string|null}
 */
function normalizeImage(image) {
  if (!image || image.startsWith('data:')) return null;
  return toAbsoluteLink(image);
}

/**
 * @param {any} o
 * @returns {ParsedListing}
 */
function normalize(o) {
  const title = cleanText(o.title);
  const description = cleanText([o.description, o.tags].filter(Boolean).join(' '));
  const link = toAbsoluteLink(o.link) || config.url;
  const id = buildHash(o.id || link, o.price);

  return {
    id,
    link,
    title,
    price: extractNumber(o.price),
    size: extractSize(`${description} ${title}`),
    rooms: extractRooms(`${description} ${title}`),
    address: cleanText(o.address) || null,
    image: normalizeImage(o.image),
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
  crawlContainer: '.list-item-outer',
  sortByDateParam: null,
  waitForSelector: '.list-item-outer',
  crawlFields: {
    id: '@data-id',
    title: '.item-title a | trim',
    link: '.item-title a@href',
    price: '.item-price | trim',
    address: '.item-city | trim',
    image: 'img@src',
    description: '.item-desc | trim',
    tags: '.item-infobits | trim',
  },
  normalize,
  filter: applyBlacklist,
  activeTester: checkIfListingIsActive,
};

export const init = (sourceConfig, blacklist) => {
  config.enabled = sourceConfig.enabled;
  config.url = sourceConfig.url;
  appliedBlackList = blacklist || [];
};

export const metaInformation = {
  name: 'Südkurier Anzeigen',
  baseUrl: BASE_URL,
  id: 'suedkurier',
};

export { config };
