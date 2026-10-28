import { storage } from 'wxt/utils/storage';

/**
 * "Nova versão disponível": the installed version (manifest, from package.json) against the
 * latest GitHub Release. The extension is loaded unpacked, so it can't install anything
 * itself: the notice only links to the release to download.
 */

/** Public repo the releases are published on. */
export const REPO = 'lucasfdigital/Whatsapp.CRM';
/** GitHub allows 60 unauthenticated requests per hour per IP, shared by a whole office. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export interface UpdateState {
  /** Newest released version seen on GitHub ("0.2.0"); null while there is none. */
  latest: string | null;
  /** Last time GitHub was asked, failures included, so errors don't retry in a loop. */
  checkedAt: number;
}

export const updateItem = storage.defineItem<UpdateState>('local:update', {
  fallback: { latest: null, checkedAt: 0 },
});

/** "v0.2.0" or "0.2.0" → [0, 2, 0]. Pre-releases and anything else → null (no notice). */
export function parseVersion(tag: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The version to offer, if the stored release is newer than the installed one. */
export const availableUpdate = (state: UpdateState, current: string): string | null =>
  state.latest && isNewer(state.latest, current) ? state.latest : null;

/**
 * Page of the latest release, built here rather than taken from the API response. Same release
 * the API reports (both skip drafts and pre-releases), whether the tag has a "v" or not.
 */
export const LATEST_RELEASE_URL = `https://github.com/${REPO}/releases/latest`;

/** Latest release version on GitHub. No release yet (404), rate limit (403), offline: null. */
export async function fetchLatestRelease(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const tag = (body as { tag_name?: unknown } | null)?.tag_name;
    const version = typeof tag === 'string' ? parseVersion(tag) : null;
    return version ? version.join('.') : null;
  } catch {
    return null;
  }
}

/** Asks GitHub again once the stored answer is older than CHECK_EVERY_MS. */
export async function checkForUpdate(now = Date.now(), fetchFn?: typeof fetch): Promise<UpdateState> {
  const state = await updateItem.getValue();
  // 0: never asked. A future time (clock moved back) counts as stale too.
  if (state.checkedAt > 0 && state.checkedAt <= now && now - state.checkedAt < CHECK_EVERY_MS) return state;
  const latest = await fetchLatestRelease(fetchFn);
  // A failed check keeps the release already known: a 403 shouldn't hide a real update.
  const next: UpdateState = { latest: latest ?? state.latest, checkedAt: now };
  await updateItem.setValue(next);
  return next;
}

/** Message the UI sends (sidebar mount, popup open) so the background checks when stale. */
export const UPDATE_CHECK_MESSAGE = 'wacrm:update-check';
