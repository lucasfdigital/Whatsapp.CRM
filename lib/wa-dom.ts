/**
 * Every WhatsApp DOM selector lives here. When WhatsApp changes its markup,
 * this is the only file to fix.
 */
export const SELECTORS = {
  /** Scrollable native chat list. Our tab bar is inserted right before it. */
  chatList: '#pane-side',
  /** Left column that contains search, filter chips and the chat list. */
  sidePanel: '#side',
  /** Open conversation pane and its header (contact name, call buttons). */
  main: '#main',
  mainHeader: '#main header',
  /** Native left-rail button for the chat list (pt-BR and en). */
  railChatsButton: '[aria-label="Conversas"], [aria-label="Chats"]',
} as const;

/** Left edge for full-screen CRM views: just right of the native rail. */
export function workspaceLeft(): number {
  return document.querySelector(SELECTORS.sidePanel)?.getBoundingClientRect().left ?? 0;
}

const HIDDEN_ATTR = 'data-wacrm-hidden';

/** Hides/shows WhatsApp's own chat list without touching its React tree. */
export function setNativeListHidden(hidden: boolean): void {
  const list = document.querySelector<HTMLElement>(SELECTORS.chatList);
  if (!list) return;
  if (hidden) {
    list.setAttribute(HIDDEN_ATTR, '');
    list.style.setProperty('display', 'none', 'important');
  } else if (list.hasAttribute(HIDDEN_ATTR)) {
    list.removeAttribute(HIDDEN_ATTR);
    list.style.removeProperty('display');
  }
}

const FILTERS_ATTR = 'data-wacrm-filters';

/**
 * Hides WhatsApp's filter chips (Tudo, Não lidas, custom lists…): our tabs
 * replace them. Found from the "Tudo"/"All" chip, widened to the row that
 * holds it but not the search box, the chat list or our tab bar.
 */
export function hideNativeFilters(): void {
  const side = document.querySelector<HTMLElement>(SELECTORS.sidePanel);
  if (!side || side.querySelector(`[${FILTERS_ATTR}]`)) return;
  // Runs every second: skip the (huge) chat list instead of scanning it.
  const walker = document.createTreeWalker(side, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (el) => ((el as Element).matches(SELECTORS.chatList) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let chip: HTMLElement | null = null;
  for (let node = walker.nextNode(); node && !chip; node = walker.nextNode()) {
    if (node instanceof HTMLElement && /^(tudo|all)$/i.test(node.textContent?.trim() ?? '')) chip = node;
  }
  if (!chip) return;
  // Stop before anything else the user still needs: search, list, our tabs, the ⋮ / + header.
  const keep = [findMenuButton(), findNewChatButton()].filter((el): el is HTMLElement => el !== null);
  const blocked = (el: Element) =>
    el === side ||
    !!el.querySelector(`${SELECTORS.chatList}, [contenteditable="true"], input, wacrm-tabs`) ||
    keep.some((k) => el.contains(k));
  let row: HTMLElement = chip;
  while (row.parentElement && !blocked(row.parentElement)) row = row.parentElement;
  // WhatsApp's own list still shows while searching / selecting: leave it unfiltered.
  chip.click();
  row.setAttribute(FILTERS_ATTR, '');
  row.style.setProperty('display', 'none', 'important');
}

export function showNativeFilters(): void {
  document.querySelectorAll<HTMLElement>(`[${FILTERS_ATTR}]`).forEach((el) => {
    el.removeAttribute(FILTERS_ATTR);
    el.style.removeProperty('display');
  });
}

/** Current text of WhatsApp's search box (null when the box isn't rendered). */
export function readSearchBox(): string | null {
  const box = findSearchBox();
  if (!box) return null;
  return box instanceof HTMLInputElement ? box.value : (box.textContent ?? '');
}

/** Text currently typed in WhatsApp's search box (empty when none). */
export function readSearchText(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const side = target.closest(SELECTORS.sidePanel);
  if (!side || target.closest(SELECTORS.chatList)) return null;
  if (target instanceof HTMLInputElement) return target.value;
  if (target.isContentEditable) return target.textContent ?? '';
  return null;
}

export function isDarkTheme(): boolean {
  return document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
}

/**
 * Diagnostic markers on <html> (readable from the page console):
 * data-wacrm = aguardando-lista | montado | desligado, data-wacrm-chats = count | "erro: ...".
 */
export function setStatus(key: 'wacrm' | 'wacrmChats', value: string): void {
  document.documentElement.dataset[key] = value;
}

/**
 * The whole native left rail (the full-height column holding the rail buttons).
 * Found from the "Conversas" button: closest ancestor that is narrow and nearly
 * as tall as the window.
 */
export function findRailBox(): HTMLElement | null {
  const chatsBtn = document.querySelector<HTMLElement>(SELECTORS.railChatsButton);
  if (!chatsBtn) return null;
  let node: HTMLElement | null = chatsBtn.parentElement;
  for (let i = 0; node && i < 10; i++, node = node.parentElement) {
    const r = node.getBoundingClientRect();
    if (r.height >= window.innerHeight * 0.8 && r.width > 0 && r.width <= 120) return node;
  }
  return null;
}

/**
 * Outermost wrapper of the rail that is still narrow and full height. WhatsApp
 * nests the rail in fixed-width, overflow-hidden columns; our sidebar has to
 * replace that whole column or it gets clipped to the rail's width.
 */
export function findRailColumn(box: HTMLElement): HTMLElement {
  let col = box;
  for (let p = box.parentElement; p && p !== document.body; p = p.parentElement) {
    const r = p.getBoundingClientRect();
    if (r.width > 120 || r.height < window.innerHeight * 0.8) break;
    col = p;
  }
  return col;
}

const RAIL_HIDDEN_ATTR = 'data-wacrm-rail-hidden';

/**
 * Hides the native rail without removing its box: WhatsApp's layout stays as
 * it was, and its buttons still respond to our sidebar's clicks.
 */
export function setRailVisible(column: HTMLElement | null, visible: boolean): void {
  const el = column ?? document.querySelector<HTMLElement>(`[${RAIL_HIDDEN_ATTR}]`);
  if (!el) return;
  if (!visible) {
    el.setAttribute(RAIL_HIDDEN_ATTR, '');
    el.style.setProperty('visibility', 'hidden', 'important');
  } else if (el.hasAttribute(RAIL_HIDDEN_ATTR)) {
    el.removeAttribute(RAIL_HIDDEN_ATTR);
    el.style.removeProperty('visibility');
  }
}

/**
 * z-index our fixed sidebar needs to paint above WhatsApp's page: one above
 * the highest z-index on the rail column or any of its ancestors.
 */
export function zIndexAbove(el: Element, min: number): number {
  let top = min - 1;
  // Any numeric z-index counts: flex/grid items stack even while position is static.
  for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
    const z = Number.parseInt(getComputedStyle(node).zIndex, 10);
    if (Number.isFinite(z)) top = Math.max(top, z);
  }
  return top + 1;
}

const SHIFT_ATTR = 'data-wacrm-shift';

/**
 * Our sidebar is a fixed layer over the native rail. WhatsApp keeps its own
 * layout (drawers, dividers placed at the rail's width) and is moved right by
 * the difference, so nothing of it ends up under the sidebar. 0 restores it.
 */
export function setAppShift(px: number): void {
  const app = document.getElementById('app');
  if (!app) return;
  if (px > 0) {
    app.setAttribute(SHIFT_ATTR, '');
    app.style.setProperty('margin-inline-start', `${px}px`, 'important');
    app.style.setProperty('width', `calc(100% - ${px}px)`, 'important');
  } else if (app.hasAttribute(SHIFT_ATTR)) {
    app.removeAttribute(SHIFT_ATTR);
    app.style.removeProperty('margin-inline-start');
    app.style.removeProperty('width');
  }
}

export const PANE_ATTR = 'data-wacrm-pane';
/** Row holding the panes: painted in the ground color so nothing shows past the cards' round corners. */
export const PANE_ROW_ATTR = 'data-wacrm-panerow';
/**
 * WhatsApp's absolute layers over the panes (drawers, media) start with a
 * spacer as wide as the list used to be, then a panel with a 1px left border.
 * Spacer → list width, panel → no border; otherwise the border crosses the chat.
 */
export const LAYER_SPACER_ATTR = 'data-wacrm-spacer';
export const LAYER_PANEL_ATTR = 'data-wacrm-layerpanel';
/** List header ("WhatsApp ⋮ +"): title hidden, buttons laid over the search row's end. */
const HDR_ATTR = 'data-wacrm-hdr';
const HDR_TITLE_ATTR = 'data-wacrm-hdrtitle';
const SEARCH_ROW_ATTR = 'data-wacrm-searchrow';

/** In-flow siblings of `node` that sit to its right and are wide enough to be a pane. */
function panesBeside(node: Element): Element[] {
  const right = node.getBoundingClientRect().right;
  return [...(node.parentElement?.children ?? [])].filter((el) => {
    if (el === node || el.tagName.startsWith('WACRM-')) return false;
    const r = el.getBoundingClientRect();
    const { position } = getComputedStyle(el);
    return position !== 'absolute' && position !== 'fixed' && r.width >= 200 && r.left >= right - 2;
  });
}

/**
 * Tags WhatsApp's two main panes (chat list, conversation) so the theme can
 * draw them as cards. Left = the ancestor of #side that has the conversation
 * beside it (it may also hold the "WhatsApp ⋮ +" header above #side); right =
 * those panes beside it. Uses only "what is beside", never widths, because
 * our own CSS changes the left pane's width.
 */
export function markPanes(): void {
  const side = document.querySelector<HTMLElement>(SELECTORS.sidePanel);
  // Status / Configurações can replace #side for a while: keep the last marks.
  if (!side) return;
  const app = document.getElementById('app');
  let left: HTMLElement = side;
  while (
    panesBeside(left).length === 0 &&
    left.parentElement &&
    left.parentElement !== app &&
    left.parentElement !== document.body
  ) {
    left = left.parentElement;
  }
  const right = panesBeside(left);
  // Nothing beside the list (loading, narrow single-pane layout): don't card-ify a wrapper of everything.
  if (right.length === 0) return;
  const marked = new Set<Element>([left, ...right]);
  if (left.getAttribute(PANE_ATTR) !== 'left') left.setAttribute(PANE_ATTR, 'left');
  for (const el of right) if (el.getAttribute(PANE_ATTR) !== 'right') el.setAttribute(PANE_ATTR, 'right');
  document.querySelectorAll(`[${PANE_ATTR}]`).forEach((el) => marked.has(el) || el.removeAttribute(PANE_ATTR));
  const row = left.parentElement;
  if (row && !row.hasAttribute(PANE_ROW_ATTR)) row.setAttribute(PANE_ROW_ATTR, '');
  document.querySelectorAll(`[${PANE_ROW_ATTR}]`).forEach((el) => el === row || el.removeAttribute(PANE_ROW_ATTR));
  if (row) markLayerSpacers(row, left);
  layoutListHeader(left);
}

/**
 * One row on top of the list: search box, then ⋮ and +. The "WhatsApp" title
 * is hidden and its header is laid (absolute) over the end of the search row,
 * which leaves room for it. Nodes stay where WhatsApp put them.
 */
function layoutListHeader(left: HTMLElement): void {
  const menu = findMenuButton();
  const search = findSearchBox();
  const list = document.querySelector(SELECTORS.chatList);
  if (!menu || !search || !list || !left.contains(menu) || !left.contains(search)) return;
  // Header: the menu's ancestor right below the branch that holds the search box.
  let hdr: HTMLElement = menu;
  while (hdr.parentElement && hdr.parentElement !== left && !hdr.parentElement.contains(search)) hdr = hdr.parentElement;
  // Search row: the search box's ancestor right below the branch that holds the chat list.
  let searchRow: HTMLElement = search;
  while (searchRow.parentElement && searchRow.parentElement !== left && !searchRow.parentElement.contains(list)) {
    searchRow = searchRow.parentElement;
  }
  if (hdr.contains(search) || searchRow.contains(menu)) return;
  if (!hdr.hasAttribute(HDR_ATTR)) {
    document.querySelectorAll(`[${HDR_ATTR}]`).forEach((el) => el.removeAttribute(HDR_ATTR));
    hdr.setAttribute(HDR_ATTR, '');
  }
  if (!searchRow.hasAttribute(SEARCH_ROW_ATTR)) {
    document.querySelectorAll(`[${SEARCH_ROW_ATTR}]`).forEach((el) => el.removeAttribute(SEARCH_ROW_ATTR));
    searchRow.setAttribute(SEARCH_ROW_ATTR, '');
  }
  // Hide everything in the header that isn't on the way to ⋮ or + (the title
  // may be text, an SVG wordmark or "WhatsApp Business"): only the buttons stay.
  const keep = [menu, findNewChatButton()].filter((el): el is HTMLElement => el !== null);
  const hideOthers = (node: Element) => {
    for (const child of node.children) {
      if (keep.includes(child as HTMLElement)) continue;
      if (keep.some((k) => child.contains(k))) hideOthers(child);
      else if (!child.hasAttribute(HDR_TITLE_ATTR)) child.setAttribute(HDR_TITLE_ATTR, '');
    }
  };
  hideOthers(hdr);
  // Visible pill: the search box's first ancestor with a background.
  let pillEl: HTMLElement = search;
  while (pillEl !== searchRow && pillEl.parentElement && getComputedStyle(pillEl).backgroundColor === 'rgba(0, 0, 0, 0)') {
    pillEl = pillEl.parentElement;
  }
  const l = left.getBoundingClientRect();
  const row = searchRow.getBoundingClientRect();
  const pill = pillEl.getBoundingClientRect();
  const h = hdr.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const last = (keep[keep.length - 1] ?? menu).getBoundingClientRect();
  const px = (name: string, fallback: number) => parseFloat(left.style.getPropertyValue(name)) || fallback;
  const set = (name: string, value: number) => {
    const v = `${Math.round(value)}px`;
    if (left.style.getPropertyValue(name) !== v) left.style.setProperty(name, v);
  };
  // ⋮ centered on the pill; `top` is measured from inside the card's border.
  set('--wacrm-hdr-top', (pill.top + pill.bottom) / 2 - l.top - left.clientTop - ((m.top + m.bottom) / 2 - h.top));
  // Search pill … + span exactly the width of our tab bar (12px in from the card otherwise, as the sidebar card).
  const tabs = document.querySelector('wacrm-tabs')?.shadowRoot?.querySelector('[role="tablist"]')?.getBoundingClientRect();
  const startX = tabs?.width ? tabs.left : row.left + 12;
  const endX = tabs?.width ? tabs.right : row.right - 12;
  // A margin, not padding: WhatsApp's own inset inside the row may need a negative shift.
  set('--wacrm-search-ms', px('--wacrm-search-ms', 0) + (startX - pill.left));
  set('--wacrm-hdr-end', px('--wacrm-hdr-end', 0) + (last.right - endX));
  // The pill stops 8px before ⋮.
  set('--wacrm-search-pe', parseFloat(getComputedStyle(searchRow).paddingInlineEnd) + (pill.right - (m.left - 8)));
}

/** WhatsApp's search box in the list (not inside the chat list). */
function findSearchBox(): HTMLElement | null {
  const boxes = document.querySelectorAll<HTMLElement>(
    `${SELECTORS.sidePanel} [contenteditable="true"], ${SELECTORS.sidePanel} input[type="text"], ${SELECTORS.sidePanel} input:not([type])`,
  );
  for (const box of boxes) if (!box.closest(SELECTORS.chatList)) return box;
  return null;
}

function markLayerSpacers(row: Element, left: Element): void {
  const listLeft = left.getBoundingClientRect().left;
  for (const layer of row.children) {
    if (layer === left || getComputedStyle(layer).position !== 'absolute') continue;
    const [spacer, panel] = layer.children;
    if (!spacer || !panel || spacer.hasAttribute(LAYER_SPACER_ATTR)) continue;
    const r = spacer.getBoundingClientRect();
    // Spacer: starts where the list starts and ends where the panel begins.
    if (Math.abs(r.left - listLeft) > 2 || r.width < 200 || Math.abs(panel.getBoundingClientRect().left - r.right) > 2) continue;
    spacer.setAttribute(LAYER_SPACER_ATTR, '');
    panel.setAttribute(LAYER_PANEL_ATTR, '');
  }
}

export function clearPanes(): void {
  document.querySelectorAll(`[${PANE_ATTR}]`).forEach((el) => el.removeAttribute(PANE_ATTR));
  document.querySelectorAll(`[${PANE_ROW_ATTR}]`).forEach((el) => el.removeAttribute(PANE_ROW_ATTR));
  document.querySelectorAll(`[${LAYER_SPACER_ATTR}]`).forEach((el) => el.removeAttribute(LAYER_SPACER_ATTR));
  document.querySelectorAll(`[${LAYER_PANEL_ATTR}]`).forEach((el) => el.removeAttribute(LAYER_PANEL_ATTR));
  for (const attr of [HDR_ATTR, HDR_TITLE_ATTR, SEARCH_ROW_ATTR]) {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
  }
  document.querySelectorAll<HTMLElement>('[style*="--wacrm-"]').forEach((el) => {
    for (const name of ['--wacrm-hdr-top', '--wacrm-hdr-end', '--wacrm-search-pe', '--wacrm-search-ms'])
      el.style.removeProperty(name);
  });
}

/**
 * Elements painted ABOVE our sidebar (between x=0 and `width`): what would
 * overlap it. Reported in the sidebar footer so a screenshot names the culprit.
 */
export function findIntruders(host: Element, width: number): string[] {
  const found = new Map<Element, string>();
  for (const fx of [0.3, 0.6, 0.9]) {
    for (const fy of [0.2, 0.5, 0.8]) {
      const stack = document.elementsFromPoint(width * fx, window.innerHeight * fy);
      for (const el of stack) {
        if (el === host) break; // everything after this is painted below us
        if (el === document.documentElement || el === document.body) continue;
        if (found.has(el)) continue;
        const cs = getComputedStyle(el);
        found.set(el, `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${cs.position} z${cs.zIndex}`);
      }
    }
  }
  return [...found.values()];
}

/** WhatsApp's "Arquivadas" entry (top of the chat list), if rendered. */
export function findArchivedEntry(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    `${SELECTORS.sidePanel} button, ${SELECTORS.sidePanel} [role="button"], ${SELECTORS.sidePanel} [role="listitem"]`,
  );
  for (const el of candidates) {
    const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
    if (/^(arquivadas|archived)\b/i.test(text)) return el;
  }
  return null;
}

/**
 * When the shift did not move WhatsApp (its layout is pinned to the viewport),
 * describes the first positioned ancestor of the rail, for the footer.
 */
export function describeShiftFailure(rail: Element, sidebarWidth: number): string | null {
  const side = document.querySelector(SELECTORS.sidePanel);
  if (!side || side.getBoundingClientRect().left >= sidebarWidth - 2) return null;
  for (let el = rail.parentElement; el && el !== document.body; el = el.parentElement) {
    const { position } = getComputedStyle(el);
    if (position !== 'static') return `WhatsApp não deslocou (${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${position})`;
  }
  return 'WhatsApp não deslocou';
}

/**
 * Native button in the chat list header ("Nova conversa", "Mais opções"):
 * left pane first, then anywhere outside the conversation (which has its own
 * "Mais opções") and outside the chat list.
 */
function findHeaderButton(match: RegExp): HTMLElement | null {
  const pane = document.querySelector(`[${PANE_ATTR}="left"]`) ?? document.querySelector(SELECTORS.sidePanel);
  for (const scope of [pane, document.getElementById('app')]) {
    if (!scope) continue;
    for (const el of scope.querySelectorAll<HTMLElement>('button[aria-label], [role="button"][aria-label]')) {
      if (el.closest(SELECTORS.chatList) || el.closest(SELECTORS.main)) continue;
      if (match.test(el.getAttribute('aria-label') ?? '')) return el;
    }
  }
  return null;
}

export const findNewChatButton = () => findHeaderButton(/^(nova conversa|new chat)$/i);
export const findMenuButton = () => findHeaderButton(/^(mais opções|menu|more options)$/i);

/**
 * Runs an entry of WhatsApp's ⋮ menu by its label: opens the menu (visibly)
 * and clicks the entry once it renders. If the entry never shows up the menu
 * stays open, so the user can still pick it by hand.
 */
export async function runMenuAction(label: string, menuLabels: readonly string[], timeoutMs = 1500): Promise<boolean> {
  const button = findMenuButton();
  if (!button) return false;
  const added: Element[] = [];
  const observer = new MutationObserver((records) =>
    records.forEach((r) => r.addedNodes.forEach((n) => n instanceof Element && added.push(n))),
  );
  observer.observe(document.body, { childList: true, subtree: true });
  button.click();
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      const entry = findMenuEntry(added, label, menuLabels);
      if (entry) {
        entry.click();
        return true;
      }
    }
    return false;
  } finally {
    observer.disconnect();
  }
}

const norm = (text: string | null | undefined) => (text ?? '').trim().toLowerCase();

/**
 * The entry named `label` inside the menu that just opened. Chat rows re-render
 * all the time (a group can be called "Catálogo"), so only containers outside
 * the chat list / conversation that hold at least two known menu labels count.
 */
function findMenuEntry(roots: Element[], label: string, menuLabels: readonly string[]): HTMLElement | null {
  const known = new Set(menuLabels.map(norm));
  const wanted = norm(label);
  const isMenu = (el: Element) =>
    new Set([...el.querySelectorAll('*')].map((d) => norm(d.textContent)).filter((t) => known.has(t))).size >= 2;
  for (const root of roots) {
    if (!root.isConnected || root.closest(`${SELECTORS.chatList}, ${SELECTORS.main}`) || root.tagName.startsWith('WACRM-')) continue;
    // Items may be added one by one into an existing menu: then the parent is the menu.
    const parent = root.parentElement;
    const menu = isMenu(root) ? root : parent && parent !== document.body && isMenu(parent) ? parent : null;
    if (!menu) continue;
    for (const el of menu.querySelectorAll<HTMLElement>('*')) {
      if (norm(el.textContent) !== wanted) continue;
      if (![...el.children].some((c) => norm(c.textContent) === wanted)) return el;
    }
  }
  return null;
}

const LINE_ATTR = 'data-wacrm-line';

/**
 * WhatsApp draws a full-height 1px divider at the rail's edge; after the shift
 * it lands on our sidebar's edge, over the chat list card. Hide such lines
 * (positioned, ≤ 2px wide, at least half the window tall) found at `x`.
 */
export function hideEdgeLines(x: number): void {
  const h = window.innerHeight;
  for (const fy of [0.3, 0.5, 0.7]) {
    for (const el of document.elementsFromPoint(x + 0.5, h * fy)) {
      if (!(el instanceof HTMLElement) || el.hasAttribute(LINE_ATTR)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 2 || r.height < h * 0.5 || Math.abs(r.left - x) > 2) continue;
      const { position } = getComputedStyle(el);
      if (position !== 'absolute' && position !== 'fixed') continue;
      el.setAttribute(LINE_ATTR, '');
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }
}

const EDGE_BORDER_ATTR = 'data-wacrm-edgeborder';

/**
 * Borders WhatsApp draws at the list's start edge (rail divider, overlay
 * layers) end up in the gap between our sidebar and the list card. Remove
 * the border of tall elements whose start/end edge sits on that line.
 */
export function hideListEdgeBorders(): void {
  const app = document.getElementById('app');
  const leftPane = document.querySelector(`[${PANE_ATTR}="left"]`);
  if (!app || !leftPane) return;
  const x = leftPane.getBoundingClientRect().left;
  const minH = window.innerHeight * 0.5;
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      // The rail column is hidden and measured for the shift: leave it alone.
      (node as Element).getBoundingClientRect().height < minH ||
      (node as Element).tagName.startsWith('WACRM-') ||
      (node as Element).hasAttribute('data-wacrm-railcol')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let el = walker.nextNode(); el; el = walker.nextNode()) {
    if (!(el instanceof HTMLElement) || el.hasAttribute(EDGE_BORDER_ATTR) || el.hasAttribute(PANE_ATTR)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const startEdge = Math.abs(r.left - x) <= 2 && parseFloat(cs.borderLeftWidth) > 0;
    const endEdge = Math.abs(r.right - x) <= 2 && parseFloat(cs.borderRightWidth) > 0;
    if (!startEdge && !endEdge) continue;
    el.setAttribute(EDGE_BORDER_ATTR, startEdge ? 'left' : 'right');
    el.style.setProperty(startEdge ? 'border-left-width' : 'border-right-width', '0', 'important');
  }
}

export function showListEdgeBorders(): void {
  document.querySelectorAll<HTMLElement>(`[${EDGE_BORDER_ATTR}]`).forEach((el) => {
    el.style.removeProperty(el.getAttribute(EDGE_BORDER_ATTR) === 'left' ? 'border-left-width' : 'border-right-width');
    el.removeAttribute(EDGE_BORDER_ATTR);
  });
}

export function showEdgeLines(): void {
  document.querySelectorAll<HTMLElement>(`[${LINE_ATTR}]`).forEach((el) => {
    el.removeAttribute(LINE_ATTR);
    el.style.removeProperty('visibility');
  });
}

export interface RailItem {
  /** aria-label of the native button, used to find it again. */
  label: string;
  /** Unread/notification count shown on the native button, if any. */
  badge: number | null;
  selected: boolean;
  /** Bottom group (settings, profile) vs top group. */
  bottom: boolean;
}

/** Snapshot of the native rail buttons (works while the rail is hidden). */
export function readRailItems(box: HTMLElement): RailItem[] {
  const buttons = [...box.querySelectorAll<HTMLElement>('button[aria-label], [role="button"][aria-label]')];
  const seen = new Set<string>();
  // Layout is gone while the rail is hidden, so group by DOM structure: the
  // rail has two button groups (top: chats, calls...; bottom: settings, profile).
  const groups = [...new Set(buttons.map((b) => groupOf(b, box)))];
  const bottomGroup = groups.length > 1 ? groups[groups.length - 1] : null;
  return buttons.flatMap((btn) => {
    const label = btn.getAttribute('aria-label')!.trim();
    if (!label || seen.has(label)) return [];
    seen.add(label);
    const digits = btn.textContent?.match(/\d+/);
    const selected =
      btn.getAttribute('aria-pressed') === 'true' ||
      btn.getAttribute('aria-selected') === 'true' ||
      btn.getAttribute('aria-current') === 'page' ||
      btn.getAttribute('aria-current') === 'true';
    return [{ label, badge: digits ? Number(digits[0]) : null, selected, bottom: groupOf(btn, box) === bottomGroup }];
  });
}

/** Direct child of the rail box that contains `el` (its button group). */
function groupOf(el: HTMLElement, box: HTMLElement): Element {
  let node: Element = el;
  while (node.parentElement && node.parentElement !== box) node = node.parentElement;
  return node;
}

/** Activates a native rail button by its label (the rail itself may be hidden). */
export function clickRailItem(box: HTMLElement, label: string): boolean {
  const btn = [...box.querySelectorAll<HTMLElement>('[aria-label]')].find((b) => b.getAttribute('aria-label') === label);
  btn?.click();
  return !!btn;
}

/**
 * Selectors of WhatsApp's own CSS rules that use `needle` (e.g. a CSS
 * variable). Its class names are hashed per release, so they are looked up
 * at runtime instead of hardcoded. Simple class selectors only.
 */
export function findRuleSelectors(needle: string): string[] {
  const found = new Set<string>();
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && rule.cssText.includes(needle) && /^\.[\w-]+$/.test(rule.selectorText)) {
        found.add(rule.selectorText);
      }
    }
  }
  return [...found];
}

/** Title of WhatsApp's contact/group info drawer (pt-BR and en). */
const INFO_TITLE = /^(dados (do contato|do grupo|da empresa|comerciais)|contact info|group info|business info)$/i;
export const INFO_SLOT_ATTR = 'data-wacrm-infoslot';

/**
 * WhatsApp's contact/group info drawer, when open. Found by its title text
 * (outside the conversation and the chat list), then climbing to the tall
 * column that holds it; the body is its scrollable part.
 */
function findInfoDrawer(): { header: HTMLElement; body: HTMLElement } | null {
  const app = document.getElementById('app');
  if (!app) return null;
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Element) {
        // Messages and chat rows are never the title: don't walk them.
        if (node.matches(`${SELECTORS.main}, ${SELECTORS.chatList}`) || node.tagName.startsWith('WACRM-')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_SKIP;
      }
      return INFO_TITLE.test(node.textContent?.trim() ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const title = walker.nextNode()?.parentElement;
  if (!title) return null;
  let drawer: HTMLElement = title;
  while (drawer.parentElement && drawer.parentElement !== app && drawer.getBoundingClientRect().height < window.innerHeight * 0.6) {
    drawer = drawer.parentElement;
  }
  // Body: the scrollable element in the drawer.
  const body = [...drawer.querySelectorAll<HTMLElement>('div')].find((el) => {
    const { overflowY } = getComputedStyle(el);
    return (overflowY === 'auto' || overflowY === 'scroll') && el.getBoundingClientRect().height > 200;
  });
  return body ? { header: title, body } : null;
}

/**
 * Tags the first section of the info drawer (photo, name, actions) so the CRM
 * section mounts right after it.
 */
export function markInfoSlot(): void {
  const found = findInfoDrawer();
  let slot: Element | null = null;
  if (found) {
    let el: Element = found.body;
    while (el.children.length === 1) el = el.children[0];
    slot = el.children[0] ?? null;
  }
  if (slot && !slot.hasAttribute(INFO_SLOT_ATTR)) slot.setAttribute(INFO_SLOT_ATTR, '');
  document.querySelectorAll(`[${INFO_SLOT_ATTR}]`).forEach((el) => el === slot || el.removeAttribute(INFO_SLOT_ATTR));
}

export function clearInfoSlot(): void {
  document.querySelectorAll(`[${INFO_SLOT_ATTR}]`).forEach((el) => el.removeAttribute(INFO_SLOT_ATTR));
}

/**
 * Opens WhatsApp's info drawer for the open conversation: clicks the header
 * block that shows the chat's name. Never a call/video button; if the name
 * block isn't found nothing is clicked.
 */
export type OpenInfoResult = 'already-open' | 'no-header' | 'no-name' | 'danger' | 'clicked';

export function openContactInfo(chatName: string): OpenInfoResult {
  if (findInfoDrawer()) return 'already-open';
  const header = document.querySelector<HTMLElement>(SELECTORS.mainHeader);
  if (!header) return 'no-header';
  const danger = /chamada|ligação|ligar|vídeo|video|call/i;
  // The chat's name in the header; clicking it opens the drawer (as a user would).
  const name = [...header.querySelectorAll<HTMLElement>('span, div')].find(
    (el) => !el.closest('wacrm-header') && el.children.length === 0 && el.textContent?.trim() === chatName.trim(),
  );
  if (!name) return 'no-name';
  for (let el: HTMLElement | null = name; el && el !== header; el = el.parentElement) {
    if (danger.test(`${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`)) return 'danger';
  }
  name.click();
  return 'clicked';
}

/** Whether WhatsApp's info drawer is open (for the "not found" diagnostic). */
export const isContactInfoOpen = () => findInfoDrawer() !== null;
