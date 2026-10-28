/**
 * Re-skins WhatsApp's native UI with BoardUI's dark/blue theme.
 *
 * WhatsApp's design system (WDS) exposes semantic CSS variables with stable
 * names (`--WDS-surface-default`, `--WDS-content-default`, ...). Their values
 * live on hashed StyleX theme classes that change every build, so we override
 * the variables on every element with !important. Values come from BoardUI's
 * tokens, read at runtime from one of our shadow roots (single source of truth).
 */

/** BoardUI token → WhatsApp variables that take its value. */
export const TOKEN_MAP: Record<string, string[]> = {
  // Ground around the cards (same as behind our sidebar).
  'background-full': ['--WDS-app-wash'],
  // Card surfaces: the sidebar's own color.
  'background-secondary-default': [
    '--WDS-surface-default',
    '--WDS-surface-elevated-default',
    '--WDS-background-wash-plain',
    '--WDS-background-wash-inset',
    '--WDS-background-elevated-wash-plain',
    '--WDS-background-elevated-wash-inset',
    '--WDS-systems-chat-background-wallpaper',
    '--WDS-systems-chat-foreground-wallpaper',
    '--WDS-systems-chat-surface-composer',
    '--WDS-components-surface-nav-bar',
  ],
  // Fields and incoming bubbles on a card: like the sidebar's search box.
  'background-tertiary-default': [
    '--WDS-surface-emphasized',
    '--WDS-surface-elevated-emphasized',
    '--WDS-systems-chat-surface-tray',
    '--WDS-systems-bubble-surface-incoming',
    '--WDS-systems-bubble-surface-system',
    '--WDS-components-badge-muted',
    // Toasts ("Adicionado(a) à sua lista de favoritos"): a raised card, not WhatsApp's light bubble.
    '--toast-background',
    '--toast-background-web',
  ],
  'background-tertiary-hover': ['--WDS-surface-highlight', '--WDS-components-active-list-row', '--WDS-surface-pressed'],
  'text-primary': ['--WDS-content-default', '--WDS-content-on-accent', '--toast-text-web'],
  'text-secondary': ['--WDS-content-deemphasized', '--WDS-systems-bubble-content-deemphasized'],
  'text-placeholder': ['--WDS-content-disabled'],
  // Missed calls, destructive menu entries: BoardUI's error red, not WhatsApp's.
  'text-error-primary': ['--WDS-secondary-negative'],
  'separator-border': ['--WDS-lines-divider'],
  'border-button-default': [
    '--WDS-lines-outline-default',
    '--WDS-lines-outline-deemphasized',
    '--toast-border-color',
    // Despite the name, also the 1px line around WhatsApp's dropdown menus (⋮).
    '--WDS-components-outline-profile-photo',
  ],
  'accent-400': [
    '--WDS-content-action-default',
    '--WDS-content-action-emphasized',
    '--WDS-content-external-link',
    '--WDS-content-read',
    '--WDS-systems-status-seen',
    '--text-action',
    '--icon-high-emphasis',
    '--toast-text-link',
  ],
  'accent-500': [
    '--WDS-accent',
    '--WDS-accent-emphasized',
    '--WDS-persistent-always-branded',
    '--WDS-persistent-activity-indicator',
    '--WDS-components-badge-muted-dot',
  ],
  'accent-600': ['--app-background-stripe'],
  'accent-800': ['--WDS-systems-bubble-surface-outgoing'],
  'accent-900': ['--WDS-accent-deemphasized', '--WDS-components-filter-surface-selected'],
};

export const FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const STYLE_ID = 'wacrm-boardui-theme';

/** CSS for the document. `read(token)` returns the resolved BoardUI value (e.g. "oklch(...)"). */
/** WhatsApp's hashed classes found at runtime (see findRuleSelectors in wa-dom). */
export interface NativeSelectors {
  /** Message bubbles: the rules painting --WAWeb-minimal-msg-bubble-shadow. */
  bubble: string[];
  /** Composer surface: the rules painting --chat-composer-background-color. */
  composer: string[];
}

export function buildThemeCss(
  read: (token: string) => string,
  native: NativeSelectors = { bubble: [], composer: [] },
): string {
  const decls: string[] = [];
  for (const [token, vars] of Object.entries(TOKEN_MAP)) {
    const value = read(token).trim();
    if (!value) continue;
    for (const v of vars) decls.push(`${v}:${value} !important;`);
  }
  const ground = read('background-full').trim();
  return [
    // Every element: WDS values sit on hashed theme classes deep in the tree.
    `:root, :root * { ${decls.join('')} }`,
    `#app, #app * { font-family: ${FONT_STACK} !important; }`,
    // Keep emoji glyphs on the platform emoji font.
    `#app img.emoji, #app [data-emoji] { font-family: inherit !important; }`,
    ground ? `html, body, #app { background: ${ground} !important; }` : '',
    // No visible scrollbars anywhere in WhatsApp; scrolling still works.
    `html, body, #app, #app * { scrollbar-width: none !important; }`,
    `#app *::-webkit-scrollbar { display: none !important; }`,
    // Toasts: 1px line and 12px corners like our menus; they start past our sidebar (its width is set on <html> by the sidebar).
    `:root, :root * { --toast-border-width: 1px !important; --toast-border-style: solid !important; --toast-corner-radius: 12px !important; }`,
    `#wds-toast-container { inset-inline-start: calc(var(--wacrm-sidebar-w, 0px) + 16px) !important; }`,
    ...tooltipCss(read),
    ...headerCss(read),
    ...illustrationCss(read),
    ...(ground
      ? [
          ...paneCardCss(ground, read('background-secondary-default').trim(), read('border-button-white').trim()),
          ...enterCss(),
        ]
      : []),
    ...chatCss(read, native),
  ].join('\n');
}

/**
 * Every list screen follows Ligações: title row (22px title, ⋮ and actions), search, then tabs.
 * Conversas keeps WhatsApp's header in place with "Conversas" instead of the wordmark (wa-dom
 * marks the title); Arquivadas and the other screens with a back arrow get the same title size
 * and 20px sides (the arrow's 40px box starts 8px further in, so its glyph lines up). Arquivadas
 * opens from the sidebar like Ligações, so its arrow goes.
 */
function headerCss(read: (token: string) => string): string[] {
  const text = read('text-primary').trim();
  const title = '[data-wacrm-spacer] [data-testid="drawer-title-body"] h2';
  const back = '[aria-label="Voltar"], [aria-label="Back"]';
  return [
    `[data-wacrm-hdrtitle] > * { display: none !important; }`,
    // Fixed light-gray hairlines (wa-dom markDividers) take the separator token.
    ...(read('separator-border').trim() ? [`[data-wacrm-divider] { background: ${read('separator-border').trim()} !important; }`] : []),
    `[data-wacrm-hdrtitle]::before { content: "Conversas"; display: block; white-space: nowrap; font: 420 22px/28px ${FONT_STACK};${text ? ` color: ${text};` : ''} }`,
    `[data-wacrm-spacer] header:has([data-testid="drawer-title-body"]) { padding-inline: 20px !important; }`,
    `[data-wacrm-spacer] header:has([data-testid="drawer-title-body"]):has(${back}) { padding-inline-start: 12px !important; }`,
    `${title}, ${title} * { font-size: 22px !important; line-height: 28px !important; }`,
    // Arquivadas is a sidebar item like Ligações: no back arrow (Conversas in the sidebar goes back).
    `[data-testid="archived-drawer"] header :is(${back}) { display: none !important; }`,
    // As specific as the back-arrow rule above, and after it: 20px wins.
    `[data-wacrm-spacer] [data-testid="archived-drawer"] header:has([data-testid="drawer-title-body"]) { padding-inline-start: 20px !important; }`,
  ];
}

/**
 * Entrance after our loading screen (Splash sets the attribute on <html> for a moment):
 * the cards rise in after the sidebar. `translate`, not `transform`: WhatsApp transforms the panes.
 */
function enterCss(): string[] {
  const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  return [
    `@keyframes wacrm-rise { from { opacity: 0; translate: 0 16px; } }`,
    `html[data-wacrm-enter] [data-wacrm-pane="left"] { animation: wacrm-rise 560ms ${ease} 120ms backwards !important; }`,
    `html[data-wacrm-enter] [data-wacrm-pane="right"] { animation: wacrm-rise 560ms ${ease} 220ms backwards !important; }`,
    `@media (prefers-reduced-motion: reduce) { html[data-wacrm-enter] [data-wacrm-pane] { animation: none !important; } }`,
  ];
}

/**
 * WhatsApp's hover hints ("Mais opções", "Nova ligação") paint with its inverse colors (light
 * bubble). Only inside tooltips, those take BoardUI's tooltip look: primary surface, 1px line,
 * 8px corners. Elsewhere the inverse colors stay WhatsApp's.
 */
function tooltipCss(read: (token: string) => string): string[] {
  const surface = read('background-primary-default').trim();
  const text = read('text-primary').trim();
  const line = read('border-button-default').trim();
  if (!surface || !text) return [];
  return [
    `[role="tooltip"], [role="tooltip"] * { --WDS-surface-inverse: ${surface} !important; --WDS-content-inverse: ${text} !important; }`,
    `[role="tooltip"] { border-radius: 8px !important;${line ? ` border: 1px solid ${line} !important;` : ''} }`,
  ];
}

/**
 * The empty-pane illustrations (no chat open, Ligações) have WhatsApp's green, mint and cream
 * baked into the svg attributes, as rgb() in one and hex in the other: they take the accent and
 * card tokens, the dark outlines the button line. Only svgs carrying that mint, which no icon uses.
 */
function illustrationCss(read: (token: string) => string): string[] {
  const attr = (name: string, rgb: string, hex: string) => `:is([${name}="rgb(${rgb})"], [${name}="${hex}" i])`;
  const svg = `#app svg:has(${attr('fill', '230,255,218', '#e6ffda')})`;
  const rules: Array<[string, string, string]> = [
    [attr('fill', '37,211,102', '#25d366'), 'fill', read('accent-500').trim()],
    [attr('fill', '230,255,218', '#e6ffda'), 'fill', read('background-tertiary-default').trim()],
    [attr('fill', '252,245,235', '#fcf5eb'), 'fill', read('background-quaternary-default').trim()],
    [attr('stroke', '17,27,33', '#111b21'), 'stroke', read('border-button-hover').trim()],
  ];
  return rules.filter(([, , value]) => value).map(([sel, prop, value]) => `${svg} ${sel} { ${prop}: ${value} !important; }`);
}

/**
 * Conversation in BoardUI's chat look (agent-chat): rounded 16px bubbles with
 * the card shadow and no tails, composer as a rounded card on the primary surface.
 */
function chatCss(read: (token: string) => string, native: NativeSelectors): string[] {
  const composerBg = read('background-primary-default').trim();
  const scoped = (sels: string[]) => sels.map((sel) => `#main ${sel}`).join(', ');
  return [
    `:root, :root * { --WAWeb-minimal-msg-bubble-shadow: 0 1px 1px 0 rgb(0 0 0 / 0.14) !important; --WAWeb-minimal-tail-shadow-opacity: 0 !important;${composerBg ? ` --chat-composer-background-color: ${composerBg} !important;` : ''} }`,
    `#main span[data-icon="tail-in"], #main span[data-icon="tail-out"] { display: none !important; }`,
    native.bubble.length ? `${scoped(native.bubble)} { border-radius: 16px !important; }` : '',
    native.composer.length
      ? `#main footer ${native.composer.join(', #main footer ')} { border-radius: 24px !important; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.18) !important; }`
      : '',
  ];
}

/**
 * Native panes (tagged by markPanes) drawn as BoardUI cards like our sidebar.
 * A border in the ground color makes the gaps without touching WhatsApp's
 * layout; horizontal radii include the side border so the inner corner stays
 * 24px.
 */
/** Chat list card width (border included). */
export const LIST_WIDTH = 400;

/** Ligações, Arquivadas…: the layer's spacer (list) and panel (details, when it has any) are cards like the panes below. */
const LAYER_LEFT = '[data-wacrm-layercard] > [data-wacrm-spacer]';
const LAYER_RIGHT = '[data-wacrm-layercard] > [data-wacrm-layerpanel][data-wacrm-layerfull]';
const LEFT = `[data-wacrm-pane="left"], ${LAYER_LEFT}`;
const RIGHT = `[data-wacrm-pane="right"], ${LAYER_RIGHT}`;
const ANY = `[data-wacrm-pane], ${LAYER_LEFT}, ${LAYER_RIGHT}`;
const ANY_AFTER = `[data-wacrm-pane]::after, ${LAYER_LEFT}::after, ${LAYER_RIGHT}::after`;

function paneCardCss(ground: string, card: string, line = ''): string[] {
  return [
    // Layers over the panes keep the list's old width as a spacer: follow our list width.
    `[data-wacrm-spacer] { flex: none !important; width: ${LIST_WIDTH}px !important; max-width: ${LIST_WIDTH}px !important; min-width: 0 !important; }`,
    `[data-wacrm-layerpanel] { border-inline-start-width: 0 !important; }`,
    `[data-wacrm-pane="left"] { position: relative !important; }`,
    // Behind the round corners: the ground, not WhatsApp's surface color.
    // Not on the layer: where it shows nothing (Arquivadas' empty panel) the panes below must show through.
    `[data-wacrm-panerow] { background: ${ground} !important; }`,
    `${ANY} { box-sizing: border-box !important; border: 0 solid ${ground} !important; overflow: hidden !important;${card ? ` background-color: ${card} !important;` : ''} }`,
    // WhatsApp's list/conversation divider would draw a line just inside the card's edge.
    `[data-wacrm-pane="left"] > *, [data-wacrm-pane="left"] #side, ${LAYER_LEFT} > * { border-inline-end-width: 0 !important; }`,
    `${LEFT} { border-width: 8px 4px 8px 0 !important; border-radius: 24px 28px 28px 24px / 32px !important; }`,
    // Three short tabs fit: the chat list doesn't need WhatsApp's wide column.
    // Width only (no flex-basis): in a vertical flex column flex-basis would set the height.
    `[data-wacrm-pane="left"] { flex: none !important; width: ${LIST_WIDTH}px !important; max-width: ${LIST_WIDTH}px !important; min-width: 0 !important; }`,
    `${RIGHT} { border-width: 8px 8px 8px 4px !important; border-radius: 28px 32px 32px 28px / 32px !important; }`,
    // Same 1px line as the sidebar card (border-button-white, 24px inner radius). An overlay,
    // since WhatsApp's own opaque children would cover an inset border or shadow.
    ...(line
      ? [
          // Positioned only where WhatsApp left the pane static (wa-dom marks it); never override its own.
          `[data-wacrm-pane][data-wacrm-static] { position: relative !important; }`,
          `${ANY} { isolation: isolate !important; }`,
          `${ANY_AFTER} { content: "" !important; position: absolute !important; inset: 0 !important; border: 1px solid ${line} !important; border-radius: 24px !important; pointer-events: none !important; z-index: 1000 !important; }`,
        ]
      : []),
  ];
}

export function applyTheme(css: string): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    (document.head ?? document.documentElement).append(style);
  }
  style.textContent = css;
}

export function removeTheme(): void {
  document.getElementById(STYLE_ID)?.remove();
}
