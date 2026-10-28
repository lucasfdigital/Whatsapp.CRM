import { useEffect, useState, type ReactNode } from 'react';
import { RiGroupLine, RiUser3Line } from '@remixicon/react';
import { Avatar } from '@/components/base/avatar/avatar';
import type { ChipProps } from '@/components/base/badges/chip';
import type { ChatKind } from '@/lib/bridge/protocol';
import { initials } from '@/lib/format';
import type { Stage } from '@/lib/repo/schema';
import { cx } from '@/utils/cx';
import { useCrm, type CrmStore } from '../store';

/** Root of every injected surface: BoardUI dark theme + blue accent, isolated from WhatsApp. */
export function Surface({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('dark font-sans text-text-primary antialiased [color-scheme:dark]', className)}>{children}</div>
  );
}

export function ChatAvatar({
  name,
  kind,
  pic,
  size = 'md',
}: {
  name: string;
  kind: ChatKind;
  /** Photo URL; shown only once it loads (expired URLs keep the initials). */
  pic?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!pic) return;
    const img = new Image();
    img.onload = () => setLoaded(pic);
    img.src = pic;
    return () => {
      img.onload = null;
    };
  }, [pic]);
  return (
    <Avatar
      size={size}
      color={kind === 'group' ? 'blue' : 'neutral'}
      src={loaded && loaded === pic ? loaded : undefined}
      initials={
        initials(name) === '?' ? (
          // No letters (a phone number): a person/group glyph instead of digits.
          kind === 'group' ? (
            <RiGroupLine className="size-1/2" />
          ) : (
            <RiUser3Line className="size-1/2" />
          )
        ) : (
          initials(name)
        )
      }
      aria-hidden
    />
  );
}

/** Photo for one chat: the thumbnail WhatsApp already has, else fetched once (memory only). */
export function useChatPic(store: CrmStore, jid: string, cached?: string | null): string | null | undefined {
  const fetched = useCrm(store, (s) => s.pics[jid]);
  useEffect(() => {
    if (!cached) store.requestPic(jid);
  }, [store, jid, cached]);
  return cached ?? fetched;
}

export const STAGE_CHIP: Record<Stage['color'], NonNullable<ChipProps['color']>> = {
  blue: 'blue',
  green: 'lime',
  orange: 'orange',
  red: 'rose',
  purple: 'purple',
  gray: 'gray',
};

/** z-index for fixed CRM overlays. Must sit on the fixed element itself (the shadow host is reset). */
export const OVERLAY_Z = 2147483000;
