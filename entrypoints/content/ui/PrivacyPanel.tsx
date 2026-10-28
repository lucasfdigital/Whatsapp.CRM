import { useEffect, useState, type ReactNode } from 'react';
import { Switch } from '@/components/base/switch/switch';
import {
  BLUR_OPTIONS,
  DEFAULT_PRIVACY,
  VEIL_OPTIONS,
  nativeMatches,
  normalizePrivacy,
  privacyItem,
  type BlurKey,
  type PrivacySettings,
} from '@/lib/privacy';
import { SELECTORS } from '@/lib/wa-dom';

/** Current privacy settings, live from storage. */
export function usePrivacy(): PrivacySettings {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  useEffect(() => {
    privacyItem.getValue().then((v) => setSettings(normalizePrivacy(v)));
    return privacyItem.watch((v) => setSettings(normalizePrivacy(v)));
  }, []);
  return settings;
}

/** Options that apply to the open conversation (no match is expected without one). */
const NEEDS_CHAT: readonly BlurKey[] = ['messages', 'media', 'input'];
/** Options also drawn by our own list: WhatsApp's list only matters while it shows (search, selecting chats). */
const OURS_TOO: readonly BlurKey[] = ['previews', 'photos', 'names'];
const nativeListShown = () => {
  const list = document.querySelector<HTMLElement>(SELECTORS.chatList);
  return !!list && list.getBoundingClientRect().height > 0 && getComputedStyle(list).display !== 'none';
};

/**
 * Privacy toggles, opened from the sidebar footer. Options whose WhatsApp
 * selectors match nothing are flagged, so a miss never looks like "hidden".
 */
/** Enabled options whose WhatsApp parts match nothing right now (also shown on the sidebar entry). */
export function usePrivacyMisses(settings: PrivacySettings): BlurKey[] {
  const [missing, setMissing] = useState<BlurKey[]>([]);
  useEffect(() => {
    const check = () => {
      const counts = nativeMatches(settings);
      const chatOpen = !!document.querySelector(SELECTORS.main);
      const next = (Object.keys(counts) as BlurKey[]).filter(
        (key) =>
          counts[key] === 0 &&
          (!OURS_TOO.includes(key) || nativeListShown()) &&
          (!NEEDS_CHAT.includes(key) || chatOpen),
      );
      setMissing((prev) => (prev.join() === next.join() ? prev : next));
    };
    check();
    const timer = window.setInterval(check, 2000);
    return () => window.clearInterval(timer);
  }, [settings]);
  return missing;
}

export function PrivacyPanel() {
  const settings = usePrivacy();
  const missing = usePrivacyMisses(settings);

  const save = (next: PrivacySettings) => privacyItem.setValue(next);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-button-default bg-background-secondary-default p-3">
      <Group title="Desfocar até passar o mouse">
        {BLUR_OPTIONS.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            isSelected={settings.blur[key]}
            onChange={(v) => save({ ...settings, blur: { ...settings.blur, [key]: v } })}
            warning={missing.includes(key) ? 'Não encontrei isso nesta versão do WhatsApp.' : undefined}
          />
        ))}
      </Group>
      <Group title="Tela inteira">
        {VEIL_OPTIONS.map(({ key, label }) => (
          <Row
            key={key}
            label={label}
            isSelected={settings.veil[key]}
            onChange={(v) => save({ ...settings, veil: { ...settings.veil, [key]: v } })}
          />
        ))}
        <Row
          label="Revelar sem animação"
          isSelected={settings.noTransition}
          onChange={(v) => save({ ...settings, noTransition: v })}
        />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption-1-semibold text-text-tertiary uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({
  label,
  isSelected,
  onChange,
  warning,
}: {
  label: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
  warning?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Switch
        size="sm"
        isSelected={isSelected}
        onChange={onChange}
        className="w-full flex-row-reverse justify-between gap-3"
      >
        <span className="text-body-2-regular">{label}</span>
      </Switch>
      {warning && <p className="text-caption-1-regular text-text-error-primary">{warning}</p>}
    </div>
  );
}
