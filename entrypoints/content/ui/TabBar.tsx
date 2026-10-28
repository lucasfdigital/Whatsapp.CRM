import { RiStarFill, RiStarLine } from '@remixicon/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ChatSummary } from '@/lib/bridge/protocol';
import { formatChatTime, matchesQuery } from '@/lib/format';
import { isAwaiting } from '@/lib/chat-filters';
import { activeTabItem, toTabId, type TabId } from '@/lib/settings';
import { readSearchBox, readSearchText, setNativeListHidden } from '@/lib/wa-dom';
import { Badge } from '@/components/base/badges/badge';
import { Button } from '@/components/base/buttons/button';
import { Tab, TabList, Tabs } from '@/components/base/tabs/tabs';
import { NotificationCard } from '@/components/application/notification-center/notification-center';
import { cx } from '@/utils/cx';
import { useCrm, type CrmStore, type LoadStatus } from '../store';
import { ChatMenu } from './ChatMenu';
import { ChatAvatar, Surface } from './shared';

const TABS: { id: TabId; label: string }[] = [
  { id: 'waiting', label: 'Aguardando' },
  { id: 'contact', label: 'Individual' },
  { id: 'group', label: 'Grupos' },
  { id: 'cliente', label: 'Clientes' },
];

/** Row in our list: live WhatsApp data, or the stored record when WhatsApp doesn't list the chat. */
interface Row {
  jid: string;
  kind: ChatSummary['kind'];
  name: string;
  lastAt: number | null;
  unread: number;
  lastFromMe: boolean | null;
  markedUnread?: boolean;
  archived: boolean;
  pinned?: boolean;
  muted?: boolean;
  pic?: string | null;
  /** Last message line, display only (never stored). */
  preview?: string | null;
  isCliente: boolean;
  /** false when only stored by us (WhatsApp doesn't list it right now). */
  live: boolean;
}

/**
 * Tab bar injected above WhatsApp's chat list; our filtered list replaces
 * WhatsApp's own while the extension is on.
 */
export function TabBar({ store }: { store: CrmStore }) {
  const status = useCrm(store, (s) => s.status);
  const error = useCrm(store, (s) => s.error);
  const trackedError = useCrm(store, (s) => s.trackedError);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const chats = useCrm(store, (s) => s.chats);
  const tracked = useCrm(store, (s) => s.tracked);
  const pics = useCrm(store, (s) => s.pics);
  const [tab, setTab] = useState<TabId>('waiting');
  const [query, setQuery] = useState('');

  useEffect(() => {
    activeTabItem.getValue().then((v) => setTab(toTabId(v)));
    return activeTabItem.watch((v) => setTab(toTabId(v)));
  }, []);

  // Mirror what the user types in WhatsApp's search box. Clearing it with its
  // X / Esc may not fire `input`, so the box is also re-read every second.
  useEffect(() => {
    const id = window.setInterval(() => {
      const text = readSearchBox();
      if (text !== null) setQuery((prev) => (prev === text ? prev : text));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const onInput = (e: Event) => {
      const text = readSearchText(e.target);
      if (text !== null) setQuery(text);
    };
    document.addEventListener('input', onInput, true);
    return () => document.removeEventListener('input', onInput, true);
  }, []);

  // While searching, WhatsApp's own results (messages, contacts without a chat,
  // new number) are shown instead of our list.
  const searching = query.trim() !== '';
  // "Selecionar conversas" (sidebar) also needs WhatsApp's own list.
  const nativeList = useCrm(store, (s) => s.nativeList);
  const showNative = searching || nativeList;
  useEffect(() => {
    setNativeListHidden(!showNative);
  }, [showNative]);
  useEffect(() => () => setNativeListHidden(false), []);

  const rows = useMemo<Row[]>(() => {
    const live = new Set(chats.map((c) => c.jid));
    const fromLive = chats.map((c): Row => ({ ...c, isCliente: tracked[c.jid]?.status === 'cliente', live: true }));
    // Clientes may include chats WhatsApp hasn't loaded (or archived ones).
    const storedOnly = Object.values(tracked)
      .filter((r) => r.status === 'cliente' && !live.has(r.jid))
      .map((r): Row => ({
        jid: r.jid,
        kind: r.kind,
        name: r.displayName,
        lastAt: Math.max(r.lastInboundAt ?? 0, r.lastOutboundAt ?? 0) || null,
        unread: 0,
        lastFromMe: null,
        archived: false,
        isCliente: true,
        live: false,
      }));
    return [...fromLive, ...storedOnly];
  }, [chats, tracked]);

  const counts = useMemo(
    () => ({
      waiting: rows.filter((r) => r.live && isAwaiting(r)).length,
      contact: rows.filter((r) => r.live && r.kind === 'contact').length,
      group: rows.filter((r) => r.live && r.kind === 'group').length,
      cliente: rows.filter((r) => r.isCliente).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const byTab =
      tab === 'cliente'
        ? rows.filter((r) => r.isCliente)
        : tab === 'waiting'
          ? rows.filter((r) => r.live && isAwaiting(r))
          : rows.filter((r) => r.live && r.kind === tab);
    const filtered = query.trim() ? byTab.filter((r) => matchesQuery(r.name, query)) : byTab;
    return [...filtered].sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  }, [rows, tab, query]);

  return (
    <Surface className="flex flex-col">
      <Tabs selectedKey={tab} onSelectionChange={(key) => activeTabItem.setValue(toTabId(key))} className="px-2 pb-1">
        {/* Small size, compact padding and no icons: four tabs with 3-digit counts must fit the narrow list. */}
        <TabList aria-label="Filtros do CRM" className="overflow-x-auto [scrollbar-width:none]">
          {TABS.map((item) => (
            <Tab
              key={item.id}
              id={item.id}
              size="sm"
              count={status === 'ready' ? counts[item.id] : '…'}
              className="flex-1 justify-center gap-1 px-0.5"
            >
              {item.label}
            </Tab>
          ))}
        </TabList>
      </Tabs>

      <LoadingHint status={status} error={error} />

      {nativeList && !searching && (
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <span className="text-caption-1-regular text-text-tertiary">Lista do WhatsApp</span>
          <Button size="small" onClick={() => store.setNativeList(false)}>
            Voltar às abas
          </Button>
        </div>
      )}

      {!showNative && (
        <ChatList
          rows={visible}
          pics={pics}
          onVisible={(jid) => store.requestPic(jid)}
          status={status}
          error={error}
          trackedError={trackedError}
          tab={tab}
          query={query}
          onOpen={(jid) => store.openChat(jid)}
          onToggleCliente={(row) => store.setCliente(row, !row.isCliente)}
          store={store}
          portal={portal}
        />
      )}
      <div ref={setPortal} />
    </Surface>
  );
}

function ChatList(props: {
  rows: Row[];
  pics: Record<string, string | null>;
  /** A row without a photo scrolled into view: ask WhatsApp for it. */
  onVisible: (jid: string) => void;
  status: LoadStatus;
  error?: string;
  trackedError?: string;
  tab: TabId;
  query: string;
  onOpen: (jid: string) => void;
  onToggleCliente: (row: Row) => void;
  store: CrmStore;
  /** Inside our shadow root: menus portal here so they keep our styles. */
  portal: Element | null;
}) {
  const { rows, status, error, trackedError, tab, query, pics, onVisible } = props;
  const ref = useRef<HTMLDivElement>(null);
  const height = useFillViewport(ref);

  // Photos only for rows on screen, like WhatsApp's own list.
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  // Created lazily: row refs run before effects on the first render.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observer = () =>
    (observerRef.current ??= new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const jid = (e.target as HTMLElement).dataset.jid;
          if (e.isIntersecting && jid) onVisibleRef.current(jid);
        }),
      { rootMargin: '200px 0px' },
    ));
  useEffect(() => () => observerRef.current?.disconnect(), []);
  const observeRow = (el: HTMLDivElement | null) => {
    if (el && el.dataset.needsPic === 'true') observer().observe(el);
  };

  let empty: string | null = null;
  if (status === 'loading') empty = 'Carregando conversas…';
  else if (status === 'error') empty = `Não consegui ler as conversas do WhatsApp. ${error ?? ''}`;
  else if (rows.length === 0)
    empty = query.trim()
      ? 'Nada encontrado.'
      : tab === 'cliente'
        ? trackedError
          ? `Não consegui ler os clientes salvos. ${trackedError}`
          : 'Nenhum cliente ainda. Use a estrela ao lado de um grupo ou conversa para marcar como cliente.'
        : tab === 'waiting'
          ? 'Tudo em dia: nenhuma conversa aguardando você.'
          : 'Nenhuma conversa.';

  return (
    <div
      ref={ref}
      // No scrollbar (the user asked for none anywhere); wheel, touch and keys still scroll.
      className="overflow-y-auto [scrollbar-width:none]"
      style={{ height }}
    >
      {empty ? (
        <p className="px-6 py-8 text-center text-body-2-regular text-text-tertiary">{empty}</p>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {rows.map((row) => (
            <div
              key={row.jid}
              ref={observeRow}
              data-jid={row.jid}
              data-needs-pic={String(!row.pic && !(row.jid in pics))}
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 64px' }}
            >
              <NotificationCard
                onClick={() => props.onOpen(row.jid)}
                role="button"
                tabIndex={0}
                aria-label={row.name}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                  e.preventDefault();
                  props.onOpen(row.jid);
                }}
                className="cursor-pointer transition-colors duration-150 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                visual={
                  <span className="wacrm-blur-photos shrink-0">
                    <ChatAvatar name={row.name} kind={row.kind} pic={row.pic ?? pics[row.jid]} />
                  </span>
                }
                title={<span className="wacrm-blur-names block truncate">{row.name}</span>}
                timestamp={
                  <span className="inline-flex items-center gap-1">
                    <span className={row.unread || row.markedUnread ? 'text-accent-400' : undefined}>
                      {formatChatTime(row.lastAt)}
                    </span>
                    {row.live && <ChatMenu store={props.store} chat={row} portal={props.portal} />}
                  </span>
                }
                trailing={
                  row.unread > 0 ? (
                    <Badge color="primary">{row.unread}</Badge>
                  ) : row.markedUnread ? (
                    <span className="size-2 rounded-full bg-accent-500" aria-label="Marcada como não lida" />
                  ) : null
                }
                description={
                  <span className="flex items-center gap-2">
                    <span
                      className={cx(
                        'wacrm-blur-previews min-w-0 flex-1 truncate',
                        !row.preview && 'text-text-tertiary',
                      )}
                    >
                      {row.preview || (row.kind === 'group' ? 'Grupo' : 'Conversa')}
                    </span>
                    <button
                      type="button"
                      title={row.isCliente ? 'Remover de Clientes' : 'Marcar como cliente'}
                      aria-label={row.isCliente ? 'Remover de Clientes' : 'Marcar como cliente'}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onToggleCliente(row);
                      }}
                      className={cx(
                        'shrink-0 cursor-pointer rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                        row.isCliente
                          ? 'text-chart-4'
                          : 'text-foreground-icon-tertiary hover:text-foreground-icon-primary',
                      )}
                    >
                      {row.isCliente ? <RiStarFill className="size-4" /> : <RiStarLine className="size-4" />}
                    </button>
                  </span>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Our list takes the space WhatsApp's list had: from its top to the bottom of the window. */
function useFillViewport(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(400);
  useLayoutEffect(() => {
    const update = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(200, window.innerHeight - top));
    };
    update();
    window.addEventListener('resize', update);
    // Content above us (the loading hint, WhatsApp's header) can move our top without a resize.
    const observer = new ResizeObserver(update);
    const root = ref.current?.getRootNode();
    if (root instanceof ShadowRoot) observer.observe(root.host);
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [ref]);
  return height;
}

/** Where loading stopped, readable in a screenshot (the MAIN-world bridge writes its stage to <html>). */
function LoadingHint({ status, error }: { status: LoadStatus; error?: string }) {
  const [slow, setSlow] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (status === 'ready') return setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 15_000);
    const poll = window.setInterval(() => tick((n) => n + 1), 2_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [status]);
  if (status === 'ready' || (!slow && status !== 'error')) return null;
  const { wacrmBridge, wacrmWajs } = document.documentElement.dataset;
  const detail = wacrmBridge ? `wa-js: ${wacrmWajs ?? '?'}` : 'ponte não injetada';
  return (
    <p className="px-4 pb-2 text-caption-1-regular text-text-tertiary">
      Conectando ao WhatsApp… ({detail}
      {error ? ` · ${error}` : ''})
    </p>
  );
}
