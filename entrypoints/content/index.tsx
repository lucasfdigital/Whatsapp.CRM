import './style.css';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createBridgeClient } from '@/lib/bridge/client';
import { chromeLocalKV } from '@/lib/repo/kv';
import { createRepo } from '@/lib/repo/repo';
import { enabledItem } from '@/lib/settings';
import {
  SELECTORS,
  INFO_SLOT_ATTR,
  clearInfoSlot,
  clearPanes,
  findRailBox,
  findRailColumn,
  hideListEdgeBorders,
  hideNativeFilters,
  markInfoSlot,
  markPanes,
  setAppShift,
  setNativeListHidden,
  setRailVisible,
  setStatus,
  showEdgeLines,
  showListEdgeBorders,
  showNativeFilters,
} from '@/lib/wa-dom';
import { createCrmStore } from './store';
import { HeaderButton, InfoCrm } from './ui/ContactPanel';
import { Pipeline } from './ui/Pipeline';
import { Sidebar } from './ui/Sidebar';
import { TabBar } from './ui/TabBar';
import { ThemeBridge } from './ui/ThemeBridge';

const RAIL_MARK = 'data-wacrm-railbox';
/** Outer column wrapping the rail: its width is how far WhatsApp is shifted. */
const RAIL_COL = 'data-wacrm-railcol';

export default defineContentScript({
  matches: ['https://web.whatsapp.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // wa-js + wa-bridge run in the MAIN world, registered by the background while enabled.
    const bridge = createBridgeClient();
    const repo = createRepo(chromeLocalKV());
    repo.init().catch((err) => console.error('[WhatsApp CRM] storage', err));
    const store = createCrmStore(bridge, repo);

    // Keep time/direction of the last message for tracked chats (needed for "sem resposta").
    bridge.on('message', ({ jid, at, fromMe }) => {
      repo.recordMessage(jid, at, fromMe).catch((err) => console.warn('[WhatsApp CRM]', err));
    });

    const surfaces = await Promise.all([
      // BoardUI dark/blue theme applied to WhatsApp's own UI.
      surface(ctx, 'wacrm-theme', { anchor: 'body', append: 'last' }, <ThemeBridge />),
      // Tabs + our list, right above WhatsApp's chat list (proven anchor).
      surface(ctx, 'wacrm-tabs', { anchor: SELECTORS.chatList, append: 'before' }, <TabBar store={store} />, (host) => {
        host.style.flex = '0 0 auto';
        setStatus('wacrm', 'montado');
      }),
      // BoardUI sidebar: fixed layer over the native rail (it waits for markRail()).
      surface(ctx, 'wacrm-sidebar', { anchor: 'body', append: 'last' }, <Sidebar store={store} />),
      // "CRM" toggle in the open conversation's header.
      // Clicks must not reach WhatsApp's header (it opens "Dados do contato").
      surface(ctx, 'wacrm-header', { anchor: SELECTORS.mainHeader, append: 'last', isolate: ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'] }, <HeaderButton store={store} />),
      // Fixed overlays (pipeline workspace, contact panel) hang off <body>.
      surface(ctx, 'wacrm-pipeline', { anchor: 'body', append: 'last' }, <Pipeline store={store} />),
      // CRM section inside WhatsApp's "Dados do contato/grupo", after photo and name (markInfoSlot).
      // Typing and clicks must not reach WhatsApp's shortcuts and drawer handlers.
      surface(ctx, 'wacrm-info', { anchor: `[${INFO_SLOT_ATTR}]`, append: 'after', isolate: ['keydown', 'keyup', 'keypress', 'click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'] }, <InfoCrm store={store} />),
    ]);

    // The rail has no stable id: tag it so autoMount can anchor on a selector.
    const markRail = () => {
      if (document.querySelector(`[${RAIL_MARK}]`)) return;
      const box = findRailBox();
      if (!box) return;
      // The sidebar reads items from RAIL_MARK and measures RAIL_COL.
      box.setAttribute(RAIL_MARK, '');
      findRailColumn(box).setAttribute(RAIL_COL, '');
    };
    // WhatsApp re-renders panes: keep the card tags on the current elements.
    const tick = () => {
      markRail();
      markPanes();
      markInfoSlot();
      hideListEdgeBorders();
      // Our three tabs replace WhatsApp's filter chips.
      hideNativeFilters();
    };
    let railTimer: number | undefined;

    let on = false;
    const apply = (enabled: boolean) => {
      if (enabled && !on) {
        on = true;
        setStatus('wacrm', 'aguardando-lista');
        store.start();
        tick();
        railTimer = window.setInterval(tick, 1000);
        surfaces.forEach((ui) => ui.autoMount());
      } else if (!enabled) {
        on = false;
        store.stop();
        window.clearInterval(railTimer);
        surfaces.forEach((ui) => ui.remove());
        setAppShift(0);
        setRailVisible(null, true);
        showEdgeLines();
        showListEdgeBorders();
        clearPanes();
        clearInfoSlot();
        showNativeFilters();
        document.querySelector(`[${RAIL_MARK}]`)?.removeAttribute(RAIL_MARK);
        document.querySelector(`[${RAIL_COL}]`)?.removeAttribute(RAIL_COL);
        setNativeListHidden(false);
        setStatus('wacrm', 'desligado');
      }
    };
    apply(await enabledItem.getValue());
    const unwatch = enabledItem.watch(apply);
    ctx.onInvalidated(() => {
      unwatch();
      window.clearInterval(railTimer);
      setAppShift(0);
      setRailVisible(null, true);
      showEdgeLines();
      showListEdgeBorders();
      clearPanes();
      clearInfoSlot();
      showNativeFilters();
      setNativeListHidden(false);
    });
  },
});

function surface(
  ctx: ContentScriptContext,
  name: string,
  opts: { anchor: string; append: 'before' | 'after' | 'last'; isolate?: string[]; inheritStyles?: boolean },
  node: ReactNode | (() => ReactNode),
  onHost?: (host: HTMLElement) => void,
  onUnmount?: () => void,
) {
  return createShadowRootUi<ReactDOM.Root>(ctx, {
    name,
    position: 'inline',
    anchor: opts.anchor,
    append: opts.append,
    inheritStyles: opts.inheritStyles,
    // Events that must stay inside our UI (WhatsApp shortcuts, header click handlers).
    isolateEvents: opts.isolate,
    onMount(container, _shadow, host) {
      // WXT resets the host with `all: initial !important`; ours must be !important too.
      host.style.setProperty('display', 'block', 'important');
      onHost?.(host);
      const root = ReactDOM.createRoot(container);
      root.render(typeof node === 'function' ? node() : node);
      return root;
    },
    onRemove(root) {
      root?.unmount();
      onUnmount?.();
    },
  });
}
