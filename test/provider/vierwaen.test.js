/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import * as similarityCache from '../../lib/services/similarity-check/similarityCache.js';
import { get } from '../mocks/mockNotification.js';
import { mockFredy, providerConfig } from '../utils.js';
import { expect } from 'vitest';
import * as provider from '../../lib/provider/vierwaen.js';

describe('#vierwaen testsuite()', () => {
  provider.init(providerConfig.vierwaen, [], []);

  it('should test vierwaen provider', async () => {
    const Fredy = await mockFredy();
    const mockedJob = {
      id: 'vierwaen',
      notificationAdapter: null,
      spatialFilter: null,
      specFilter: null,
    };

    const fredy = new Fredy(provider.config, mockedJob, provider.metaInformation.id, similarityCache, undefined);
    const listing = await fredy.execute();

    if (listing == null || listing.length === 0) {
      throw new Error('Listings is empty!');
    }

    expect(listing).toBeInstanceOf(Array);
    const notificationObj = get();
    expect(notificationObj).toBeTypeOf('object');
    expect(notificationObj.serviceName).toBe('vierwaen');
    notificationObj.payload.forEach((notify) => {
      expect(notify.id).toBeTypeOf('string');
      expect(notify.title).toBeTypeOf('string');
      expect(notify.link).toBeTypeOf('string');
      expect(notify.address).toBeTypeOf('string');
      expect(notify.title).not.toBe('');
      expect(notify.link).toContain('https://www.vierwaen.de/');
      expect(notify.address).not.toBe('');
    });
  });
});
