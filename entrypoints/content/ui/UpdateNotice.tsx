import { RiDownloadLine } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { LATEST_RELEASE_URL, UPDATE_CHECK_MESSAGE, availableUpdate, updateItem, type UpdateState } from '@/lib/update';
import { cx } from '@/utils/cx';

/** Newer release on GitHub than the installed version, if any. Asks the background to check when stale. */
export function useAvailableUpdate(): string | null {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    void updateItem.getValue().then(setState);
    try {
      browser.runtime.sendMessage(UPDATE_CHECK_MESSAGE).catch(() => {});
    } catch {
      // Extension reloaded under this page: the old script just stays quiet.
    }
    return updateItem.watch(setState);
  }, []);
  return state ? availableUpdate(state, browser.runtime.getManifest().version) : null;
}

/**
 * "Nova versão" row (sidebar footer, toolbar popup). The extension is loaded unpacked and can't
 * update itself: the row opens the release page, whose notes say how to install it.
 */
export function UpdateNotice({ className }: { className?: string }) {
  const version = useAvailableUpdate();
  if (!version) return null;
  return (
    <a
      href={LATEST_RELEASE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        // Inset ring, not a border: icon and label stay on the sidebar rows' columns.
        'flex w-full items-center gap-2 rounded-2lg bg-background-tertiary-default p-2 ring-1 ring-border-button-default ring-inset',
        'outline-none transition-[background-color] duration-150 hover:bg-background-tertiary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring',
        className,
      )}
    >
      <RiDownloadLine className="size-5 shrink-0 text-accent-400" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="text-body-medium truncate text-text-primary">Nova versão {version}</span>
        <span className="text-caption-1-regular truncate text-text-tertiary">Baixar no GitHub</span>
      </span>
    </a>
  );
}
