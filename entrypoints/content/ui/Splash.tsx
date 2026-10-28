import { RiLockLine, RiWhatsappLine } from '@remixicon/react';
import { useEffect, useState } from 'react';
import { cx } from '@/utils/cx';
import { OVERLAY_Z, Surface } from './shared';

/** Set on <html> while the entrance plays: the theme and our sidebar animate in from it. */
export const ENTER_ATTR = 'data-wacrm-enter';
const EXIT_MS = 450;
const ENTER_MS = 1600;
/** No progress bar and no chat list for this long once the page loaded: another screen (QR code, error). */
const OTHER_SCREEN_MS = 1500;
const GIVE_UP_MS = 45_000;
/** Our list mounted but no cards drawn (narrow single-pane layout, changed DOM): reveal anyway after this. */
const NO_CARDS_MS = 500;
/** Chat list there but our list never mounted: don't hold WhatsApp hostage. */
const SIDE_ONLY_MS = 4000;
/** Shown at least this long, so a fast load doesn't flash it. */
const MIN_MS = 900;

type Phase = 'loading' | 'leaving';

/**
 * Our loading screen over WhatsApp's own: brand, a progress bar following
 * WhatsApp's, then an entrance into the cards once our layout is in place.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(false);
  const [pct, setPct] = useState(6);
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const started = Date.now();
    let otherSince: number | null = null;
    let mountedAt: number | null = null;
    let sideAt: number | null = null;
    let finished = false;
    const finish = (enter: boolean) => {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      setPct(100);
      setPhase('leaving');
      const html = document.documentElement;
      if (enter) html.setAttribute(ENTER_ATTR, '');
      window.setTimeout(onDone, EXIT_MS);
      window.setTimeout(() => html.removeAttribute(ENTER_ATTR), ENTER_MS);
    };
    const check = () => {
      const progress = document.querySelector('progress');
      const side = document.querySelector('#side');
      // Our tab bar mounted (status set by the main script) and the cards drawn: reveal.
      const now = Date.now();
      if (document.documentElement.dataset.wacrm === 'montado') mountedAt ??= now;
      if (side) sideAt ??= now;
      const cards = !!document.querySelector('[data-wacrm-pane]');
      if (now - started > MIN_MS && mountedAt !== null && (cards || now - mountedAt > NO_CARDS_MS)) {
        finish(cards);
        return;
      }
      if (sideAt !== null && now - sideAt > SIDE_ONLY_MS) {
        finish(false);
        return;
      }
      // WhatsApp's own progress sets the floor; in between, creep slowly so the bar never looks stuck.
      const floor = progress ? 10 + (Number(progress.value) / (Number(progress.max) || 100)) * 60 : side ? 85 : 10;
      const ceiling = floor < 70 ? 68 : floor < 85 ? 83 : 95;
      setPct((p) => Math.max(floor, Math.min(p + 0.3, ceiling)));
      // QR code, "phone not connected"… : nothing to dress up, get out of the way.
      if (!progress && !side && document.readyState === 'complete') {
        otherSince ??= Date.now();
        if (Date.now() - otherSince > OTHER_SCREEN_MS) finish(false);
      } else otherSince = null;
      if (Date.now() - started > GIVE_UP_MS) finish(false);
    };
    const timer = window.setInterval(check, 100);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, [onDone]);

  return (
    <Surface>
      <div
        role="status"
        aria-label="Carregando WhatsApp CRM"
        style={{ zIndex: OVERLAY_Z + 20 }}
        className={cx(
          'fixed inset-0 flex flex-col items-center justify-center bg-background-full transition-opacity duration-[450ms] ease-out motion-reduce:transition-none',
          phase === 'leaving' && 'pointer-events-none opacity-0',
        )}
      >
        <div
          className={cx(
            'flex flex-col items-center gap-6 transition duration-500 ease-out motion-reduce:transition-none',
            shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            phase === 'leaving' && 'scale-95 opacity-0',
          )}
        >
          <span className="flex size-16 items-center justify-center rounded-2xl border border-border-button-white bg-background-secondary-default shadow-sidebar">
            <RiWhatsappLine className="size-8 text-accent-400" aria-hidden />
          </span>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-title-3-semibold text-text-primary">WhatsApp CRM</p>
            <p className="text-body-2-regular text-text-tertiary">
              Reimagined by <span className="text-accent-400">Astruz</span>
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="h-1 w-50 overflow-hidden rounded-full bg-background-tertiary-default"
          >
            <div
              className="h-full rounded-full bg-accent-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <p className="absolute bottom-10 flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
          <RiLockLine className="size-3.5" aria-hidden />
          Protegida com a criptografia de ponta a ponta
        </p>
      </div>
    </Surface>
  );
}
