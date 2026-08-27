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
const ALGOLIA_APP_ID = 'MBAKOLYF0N';
const ALGOLIA_API_KEY = '28d59b079b4adb0556e7132c1d7243e3';
const ALGOLIA_INDEX = 'ep_mps_market_live_m:marketsk_advert_relevance-asc';

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
  return extractNumber(text.match(/(\d+(?:[,.]\d+)?)\s*(?:m²|qm)/i)?.[0]);
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractAddress(text) {
  return (
    cleanText(text.match(/\b\d{5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s*-\s*[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)?/u)?.[0]) || null
  );
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
 * @param {string} url
 * @returns {URLSearchParams}
 */
function buildAlgoliaParams(url) {
  const sourceUrl = new URL(url);
  const params = new URLSearchParams({
    hitsPerPage: '80',
  });
  const aroundLatLng = sourceUrl.searchParams.get('aLL')?.replace(/\s+/g, '');
  const aroundRadius = sourceUrl.searchParams.get('aR');

  if (aroundLatLng) params.set('aroundLatLng', aroundLatLng);
  if (aroundRadius) params.set('aroundRadius', aroundRadius);

  return params;
}

/**
 * @param {any} hit
 * @returns {boolean}
 */
function isRentalApartment(hit) {
  const categories = [
    ...(Array.isArray(hit.categories_plain) ? hit.categories_plain : []),
    hit.categories?.category_lvl_1?.title_de,
    hit.categories?.category_lvl_2?.title_de,
  ]
    .filter(Boolean)
    .join(' ');

  return hit.is_sale !== true && /Vermietungen/i.test(categories) && /Wohnung/i.test(categories);
}

/**
 * @param {string} url
 * @returns {Promise<any[]>}
 */
async function getListings(url) {
  const response = await fetch(
    `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${encodeURIComponent(ALGOLIA_INDEX)}/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-API-Key': ALGOLIA_API_KEY,
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      },
      body: JSON.stringify({ params: buildAlgoliaParams(url).toString() }),
    },
  );
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.hits) ? data.hits.filter(isRentalApartment) : [];
}

/**
 * @param {any} o
 * @returns {ParsedListing}
 */
function normalize(o) {
  const title = cleanText(o.title_de || o.title);
  const description = cleanText(
    [o.description_de, o.description, o.tags?.map?.((tag) => tag.title_de).join(', ')].filter(Boolean).join(' '),
  );
  const link = toAbsoluteLink(o.uri_de || o.link || `/advert/${o.id}`) || BASE_URL;
  const id = buildHash(String(o.id || o.objectID || link), String(o.price ?? ''));
  const city = Array.isArray(o.city) ? o.city[0] : o.city;
  const zip = Array.isArray(o.zip) ? o.zip[0] : o.zip;
  const address = extractAddress(description) || cleanText([zip, city].filter(Boolean).join(' '));
  const image = o.logo_url_data?.logo_url || o.images?.[0]?.src || o.image;

  return {
    id,
    link,
    title,
    price: extractNumber(o.price),
    size:
      extractNumber(Array.isArray(o.wohnflaeche_de) ? o.wohnflaeche_de[0] : null) ??
      extractSize(`${description} ${title}`),
    rooms: extractNumber(Array.isArray(o.zimmer_de) ? o.zimmer_de[0] : null) ?? extractRooms(`${description} ${title}`),
    address: address || null,
    image: normalizeImage(image),
    description,
  };
}

/**
 * @param {ParsedListing} o
 * @param {string[]} appliedBlackList
 * @returns {boolean}
 */
function applyBlacklist(o, appliedBlackList) {
  const titleNotBlacklisted = !isOneOf(o.title, appliedBlackList);
  const descNotBlacklisted = !isOneOf(o.description, appliedBlackList);
  return titleNotBlacklisted && descNotBlacklisted;
}

/** @type {ProviderConfig} */
const config = {
  requiredFieldNames: ['id', 'link', 'title', 'price', 'size', 'rooms', 'address', 'image', 'description'],
  url: null,
  crawlContainer: null,
  sortByDateParam: null,
  crawlFields: {},
  getListings,
  normalize,
  activityProbe: checkIfListingIsActive,
};

/**
 * Build a run-scoped provider configuration.
 *
 * @param {{url: string, enabled?: boolean}} sourceConfig
 * @param {string[]} [blacklist]
 * @returns {ProviderConfig}
 */
export const createConfig = (sourceConfig, blacklist = []) => ({
  ...config,
  enabled: sourceConfig.enabled,
  url: sourceConfig.url,
  filter: (listing) => applyBlacklist(listing, blacklist ?? []),
});

export const metaInformation = {
  countries: ['de'],
  name: 'Südkurier Anzeigen',
  baseUrl: BASE_URL,
  id: 'suedkurier',
};

export { config };
