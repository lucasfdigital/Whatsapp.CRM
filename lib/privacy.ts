import { storage } from 'wxt/utils/storage';
import { findRuleSelectors } from './wa-dom';

/**
 * Privacy blur, like WhatsApp privacy extensions: chosen parts of the screen are
 * blurred until hovered. Native WhatsApp parts get rules on broad containers;
 * our own surfaces read the same choices through CSS variables on <html>
 * (custom properties inherit into shadow roots) and the `.wacrm-blur-*` classes
 * in the content style.
 */
export type BlurKey = 'messages' | 'previews' | 'media' | 'input' | 'photos' | 'names';
export type VeilKey = 'onLeave' | 'onIdle';

export interface PrivacySettings {
  blur: Record<BlurKey, boolean>;
  veil: Record<VeilKey, boolean>;
  /** Reveal instantly on hover instead of fading. */
  noTransition: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  blur: { messages: false, previews: false, media: false, input: false, photos: false, names: false },
  veil: { onLeave: false, onIdle: false },
  noTransition: false,
};

export const privacyItem = storage.defineItem<PrivacySettings>('local:privacy', { fallback: DEFAULT_PRIVACY });

/** Older or partial stored values: missing keys are off. */
export function normalizePrivacy(value: Partial<PrivacySettings> | null | undefined): PrivacySettings {
  return {
    blur: { ...DEFAULT_PRIVACY.blur, ...value?.blur },
    veil: { ...DEFAULT_PRIVACY.veil, ...value?.veil },
    noTransition: value?.noTransition ?? false,
  };
}

export const BLUR_OPTIONS: Array<{ key: BlurKey; label: string }> = [
  { key: 'messages', label: 'Mensagens da conversa' },
  { key: 'previews', label: 'Prévia da última mensagem' },
  { key: 'media', label: 'Fotos e vídeos nas mensagens' },
  { key: 'input', label: 'Campo de digitação' },
  { key: 'photos', label: 'Fotos de perfil' },
  { key: 'names', label: 'Nomes de contatos e grupos' },
];

export const VEIL_OPTIONS: Array<{ key: VeilKey; label: string }> = [
  { key: 'onLeave', label: 'Desfocar tudo quando o mouse sai da janela' },
  { key: 'onIdle', label: 'Desfocar tudo após 1 min sem uso' },
];

export const BLUR_PX = 8;
export const IDLE_MS = 60_000;

/**
 * WhatsApp parts per option. Broad containers first (one structural match is
 * sturdier than per-bubble classes); every selector is scoped to #app.
 */
export const NATIVE_SELECTORS: Record<BlurKey, string[]> = {
  messages: ['#main [role="application"]', '#main .message-in', '#main .message-out'],
  // Native list shows while searching / selecting chats: snippets live there.
  previews: [
    '#pane-side [role="gridcell"] span[dir="ltr"]',
    '#pane-side [role="gridcell"] span[dir="auto"]:not([title])',
  ],
  media: [
    '#main [role="row"] img:not(.emoji)',
    '#main [role="row"] video',
    '#main .message-in img:not(.emoji)',
    '#main .message-out img:not(.emoji)',
  ],
  input: ['#main footer [contenteditable="true"]'],
  photos: ['#app img[src*="pps.whatsapp.net"]', '#main header img', '#pane-side img:not(.emoji)'],
  names: ['#main header span[dir="auto"]', '#pane-side span[title][dir="auto"]'],
};

/** CSS for WhatsApp's own DOM; empty when nothing is on. */
/**
 * Selectors found at runtime: WhatsApp's message bubble and composer classes are
 * hashed per release, so they are looked up by the CSS variables they use (as
 * the theme does) and added to the fixed guesses above.
 */
export type DiscoveredSelectors = Partial<Record<BlurKey, string[]>>;

let discovered: DiscoveredSelectors = {};

export function discoverSelectors(): DiscoveredSelectors {
  const bubble = findRuleSelectors('--WAWeb-minimal-msg-bubble-shadow').map((s) => `#main ${s}`);
  const composer = findRuleSelectors('--chat-composer-background-color').map((s) => `#main footer ${s}`);
  return {
    messages: bubble,
    media: bubble.flatMap((s) => [`${s} img:not(.emoji)`, `${s} video`]),
    input: composer,
  };
}

const selectorsFor = (key: BlurKey, extra: DiscoveredSelectors) => [...NATIVE_SELECTORS[key], ...(extra[key] ?? [])];

export function buildPrivacyCss(settings: PrivacySettings, extra: DiscoveredSelectors = {}): string {
  const transition = settings.noTransition ? 'none' : 'filter 150ms ease';
  const rules: string[] = [];
  for (const { key } of BLUR_OPTIONS) {
    if (!settings.blur[key]) continue;
    const sels = selectorsFor(key, extra);
    rules.push(
      `${sels.join(', ')} { filter: blur(${BLUR_PX}px) !important; transition: ${transition} !important; }`,
      `${sels.map((s) => `${s}:hover`).join(', ')} { filter: none !important; }`,
    );
  }
  return rules.join('\n');
}

/** CSS variables on <html> read by our own surfaces (`.wacrm-blur-*`). */
export function privacyVars(settings: PrivacySettings): Record<string, string> {
  const vars: Record<string, string> = {
    '--wacrm-blur-transition': settings.noTransition ? '0s' : '150ms',
  };
  // The whole filter, so rows carry no filter at all while an option is off.
  for (const { key } of BLUR_OPTIONS) vars[`--wacrm-blur-${key}`] = settings.blur[key] ? `blur(${BLUR_PX}px)` : 'none';
  return vars;
}

export const activeCount = (s: PrivacySettings) =>
  Object.values(s.blur).filter(Boolean).length + Object.values(s.veil).filter(Boolean).length;

/** How many WhatsApp elements each enabled option currently matches (0 = selectors missed). */
export function nativeMatches(
  settings: PrivacySettings,
  root: ParentNode = document,
): Partial<Record<BlurKey, number>> {
  const out: Partial<Record<BlurKey, number>> = {};
  for (const { key } of BLUR_OPTIONS) {
    if (settings.blur[key]) out[key] = root.querySelectorAll(selectorsFor(key, discovered).join(', ')).length;
  }
  return out;
}

const STYLE_ID = 'wacrm-privacy';
const VEIL_ID = 'wacrm-privacy-veil';

/**
 * Applies the settings to the page and runs the whole-screen veil (mouse left
 * the window / idle). Returns the cleanup that restores WhatsApp untouched.
 */
export function startPrivacy(settings: PrivacySettings, zIndex: number): () => void {
  const html = document.documentElement;
  const vars = privacyVars(settings);
  for (const [name, value] of Object.entries(vars)) html.style.setProperty(name, value);
  let style: HTMLStyleElement | null = null;
  const render = () => {
    const css = buildPrivacyCss(settings, discovered);
    if (!css) return;
    style ??= document.head.appendChild(Object.assign(document.createElement('style'), { id: STYLE_ID }));
    if (style.textContent !== css) style.textContent = css;
  };
  // WhatsApp loads the conversation's CSS lazily: keep looking until bubble and composer show up.
  let discoverTimer: number | undefined;
  const discover = () => {
    discovered = discoverSelectors();
    render();
    if (discovered.messages?.length && discovered.input?.length) window.clearInterval(discoverTimer);
  };
  const wantsDiscovery = settings.blur.messages || settings.blur.media || settings.blur.input;
  if (wantsDiscovery) {
    discoverTimer = window.setInterval(discover, 3000);
    discover();
  } else render();

  // Veil: a fixed backdrop blur above everything (a filter on <body> would break fixed layers).
  let veil: HTMLDivElement | null = null;
  const offs: Array<() => void> = [];
  if (settings.veil.onLeave || settings.veil.onIdle) {
    veil = document.createElement('div');
    veil.id = VEIL_ID;
    veil.setAttribute('aria-hidden', 'true');
    veil.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${zIndex};backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);opacity:0;transition:opacity ${settings.noTransition ? '0s' : '150ms'} ease;`;
    document.body.append(veil);
    const show = (on: boolean) => veil && (veil.style.opacity = on ? '1' : '0');
    let idleTimer: number | undefined;
    const armIdle = () => {
      window.clearTimeout(idleTimer);
      if (settings.veil.onIdle) idleTimer = window.setTimeout(() => show(true), IDLE_MS);
    };
    const wake = () => {
      show(false);
      armIdle();
    };
    const listen = <K extends keyof DocumentEventMap>(target: Document | Window, type: K, fn: () => void) => {
      target.addEventListener(type, fn, true);
      offs.push(() => target.removeEventListener(type, fn, true));
    };
    for (const type of ['mousemove', 'keydown', 'mousedown', 'wheel', 'focus'] as const) listen(document, type, wake);
    if (settings.veil.onLeave) {
      const onOut = (e: Event) => {
        if (!(e as MouseEvent).relatedTarget) show(true);
      };
      document.addEventListener('mouseout', onOut);
      offs.push(() => document.removeEventListener('mouseout', onOut));
      listen(window, 'blur', () => show(true));
    }
    armIdle();
    offs.push(() => window.clearTimeout(idleTimer));
  }

  return () => {
    window.clearInterval(discoverTimer);
    offs.splice(0).forEach((off) => off());
    for (const name of Object.keys(vars)) html.style.removeProperty(name);
    style?.remove();
    veil?.remove();
  };
}
