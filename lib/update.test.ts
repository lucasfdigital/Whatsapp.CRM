import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CHECK_EVERY_MS,
  LATEST_RELEASE_URL,
  availableUpdate,
  checkForUpdate,
  fetchLatestRelease,
  isNewer,
  parseVersion,
  updateItem,
} from './update';

const respond = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe('versions', () => {
  it('compares each part as a number', () => {
    expect(isNewer('0.10.0', '0.9.0')).toBe(true);
    expect(isNewer('v0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('0.1.0', '0.2.0')).toBe(false);
  });

  it('ignores pre-releases and malformed tags', () => {
    expect(parseVersion('v0.2.0-beta')).toBeNull();
    expect(parseVersion('latest')).toBeNull();
    expect(isNewer('v1.0.0-rc1', '0.1.0')).toBe(false);
  });

  it('offers only a newer stored release, linking to its own page', () => {
    expect(availableUpdate({ latest: '0.2.0', checkedAt: 1 }, '0.1.0')).toBe('0.2.0');
    expect(availableUpdate({ latest: '0.1.0', checkedAt: 1 }, '0.1.0')).toBeNull();
    expect(availableUpdate({ latest: null, checkedAt: 1 }, '0.1.0')).toBeNull();
    expect(LATEST_RELEASE_URL).toBe('https://github.com/lucasfdigital/Whatsapp.CRM/releases/latest');
  });
});

describe('fetchLatestRelease', () => {
  it('reads the tag of the latest release', async () => {
    expect(await fetchLatestRelease(respond(200, { tag_name: 'v0.2.0', body: '<b>notes</b>' }))).toBe('0.2.0');
  });

  it('stays quiet without releases, when rate limited, offline or on odd tags', async () => {
    expect(await fetchLatestRelease(respond(404, { message: 'Not Found' }))).toBeNull();
    expect(await fetchLatestRelease(respond(403, { message: 'API rate limit exceeded' }))).toBeNull();
    expect(await fetchLatestRelease((async () => Promise.reject(new TypeError('offline'))) as typeof fetch)).toBeNull();
    expect(await fetchLatestRelease(respond(200, { tag_name: 'nightly' }))).toBeNull();
  });
});

describe('checkForUpdate', () => {
  beforeEach(() => fakeBrowser.reset());

  it('asks GitHub at most once per interval, failures included', async () => {
    let calls = 0;
    const counting = (status: number, body: unknown) =>
      (async () => {
        calls++;
        return new Response(JSON.stringify(body), { status });
      }) as typeof fetch;
    await checkForUpdate(1_000, counting(404, {}));
    await checkForUpdate(2_000, counting(200, { tag_name: 'v0.2.0' }));
    expect(calls).toBe(1);
    expect((await updateItem.getValue()).latest).toBeNull();
    await checkForUpdate(1_000 + CHECK_EVERY_MS, counting(200, { tag_name: 'v0.2.0' }));
    expect(calls).toBe(2);
    expect(await updateItem.getValue()).toEqual({ latest: '0.2.0', checkedAt: 1_000 + CHECK_EVERY_MS });
  });

  it('keeps a known release when a later check fails', async () => {
    await updateItem.setValue({ latest: '0.2.0', checkedAt: 0 });
    const state = await checkForUpdate(CHECK_EVERY_MS + 1, respond(403));
    expect(state.latest).toBe('0.2.0');
  });
});
