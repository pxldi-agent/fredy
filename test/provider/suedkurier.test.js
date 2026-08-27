/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import * as similarityCache from '../../lib/services/similarity-check/similarityCache.js';
import { get } from '../mocks/mockNotification.js';
import { mockFredy, providerConfig } from '../utils.js';
import { expect } from 'vitest';
import * as provider from '../../lib/provider/suedkurier.js';

describe('#suedkurier testsuite()', () => {
  const runConfig = provider.createConfig(providerConfig.suedkurier, [], []);

  it('should test suedkurier provider', async () => {
    const Fredy = await mockFredy();
    const mockedJob = {
      id: 'suedkurier',
      notificationAdapter: null,
      spatialFilter: null,
      specFilter: null,
    };

    const fredy = new Fredy(runConfig, mockedJob, provider.metaInformation.id, similarityCache, undefined);
    const listing = await fredy.execute();

    if (listing == null || listing.length === 0) {
      throw new Error('Listings is empty!');
    }

    expect(listing).toBeInstanceOf(Array);
    const notificationObj = get();
    expect(notificationObj).toBeTypeOf('object');
    expect(provider.metaInformation.countries).toEqual(['de']);
    expect(notificationObj.serviceName).toBe('suedkurier');
    notificationObj.payload.forEach((notify) => {
      expect(notify.id).toBeTypeOf('string');
      expect(notify.title).toBeTypeOf('string');
      expect(notify.link).toBeTypeOf('string');
      expect(notify.address).toBeTypeOf('string');
      expect(notify.title).not.toBe('');
      expect(notify.link).toContain('https://anzeigen.suedkurier.de/');
      expect(notify.address).not.toBe('');
    });
  });
});
