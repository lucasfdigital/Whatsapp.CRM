import {
  RiAdvertisementLine,
  RiArchiveLine,
  RiBookOpenLine,
  RiBookmarkLine,
  RiChat3Line,
  RiChatNewLine,
  RiCheckDoubleLine,
  RiCheckboxMultipleLine,
  RiFlashlightLine,
  RiListCheck,
  RiLockLine,
  RiLogoutBoxRLine,
  RiMoneyDollarCircleLine,
  RiUserAddLine,
  RiDonutChartLine,
  RiGroupLine,
  RiImageLine,
  RiLayoutColumnLine,
  RiMegaphoneLine,
  RiPhoneLine,
  RiSettings4Line,
  RiSparklingLine,
  RiStarLine,
  RiStore2Line,
  RiUserSmileLine,
  RiCircleLine,
  type RemixiconComponentType,
} from '@remixicon/react';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { NavItem } from '@/components/application/dashboard/dashboard-sidebar';
import { Badge } from '@/components/base/badges/badge';
import { activeTabItem } from '@/lib/settings';
import { categorize, type Category } from '@/lib/sidebar-categories';
import {
  clickRailItem,
  describeShiftFailure,
  findArchivedEntry,
  findIntruders,
  findMenuButton,
  findNewChatButton,
  findRailColumn,
  hideEdgeLines,
  readRailItems,
  runMenuAction,
  setAppShift,
  setRailVisible,
  showEdgeLines,
  zIndexAbove,
  type RailItem,
} from '@/lib/wa-dom';
import { cx } from '@/utils/cx';
import { useCrm, type CrmStore } from '../store';
import { Surface } from './shared';

/** Minimum stacking level; raised at runtime above WhatsApp's own app layer (zIndexAbove). */
const SIDEBAR_Z = 10;

/** The native rail, once the content script has tagged it. */
function useRailBox(): HTMLElement | null {
  const [box, setBox] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () => {
      const el = document.querySelector<HTMLElement>('[data-wacrm-railbox]');
      setBox((prev) => (prev?.isConnected && prev === el ? prev : el));
    };
    find();
    const id = window.setInterval(find, 1000);
    return () => window.clearInterval(id);
  }, []);
  return box;
}

/** Native rail label (pt-BR / en) → Remix icon. Unknown labels get a neutral glyph. */
const NATIVE_ICONS: Array<[RegExp, RemixiconComponentType]> = [
  [/^(conversas|chats)$/i, RiChat3Line],
  [/^(ligações|chamadas|calls)$/i, RiPhoneLine],
  [/^status$/i, RiDonutChartLine],
  [/^(canais|channels)$/i, RiMegaphoneLine],
  [/^(comunidades|communities)$/i, RiGroupLine],
  [/meta ai/i, RiSparklingLine],
  [/(ferramentas|business|comerciais)/i, RiStore2Line],
  [/(anunciar|advertise)/i, RiAdvertisementLine],
  [/(mídia|media|arquivos)/i, RiImageLine],
  [/(arquivad|archived)/i, RiArchiveLine],
  [/^(configurações|settings)$/i, RiSettings4Line],
  [/^(perfil|profile)$/i, RiUserSmileLine],
  [/^(nova conversa|new chat)$/i, RiChatNewLine],
  [/^(novo grupo|new group)$/i, RiUserAddLine],
  [/(catálogo|catalog)/i, RiBookOpenLine],
  [/(cobranças|payments)/i, RiMoneyDollarCircleLine],
  [/(respostas rápidas|quick replies)/i, RiFlashlightLine],
  [/(mensagens favoritas|starred)/i, RiBookmarkLine],
  [/(selecionar conversas|select chats)/i, RiCheckboxMultipleLine],
  [/^(listas|lists)$/i, RiListCheck],
  [/(marcar todas como lidas|mark all as read)/i, RiCheckDoubleLine],
  [/(bloqueio do app|app lock)/i, RiLockLine],
  [/(desconectar|log ?out)/i, RiLogoutBoxRLine],
];

/**
 * Entries of WhatsApp's ⋮ menu (Business, pt-BR). Each one runs the native
 * entry, so nothing is lost; ones missing from the account's menu leave the
 * menu open for the user.
 */
const MENU_ACTIONS = [
  'Ferramentas comerciais',
  'Novo grupo',
  'Anunciar',
  'Catálogo',
  'Cobranças',
  'Respostas rápidas',
  'Mensagens favoritas',
  'Selecionar conversas',
  'Listas',
  'Marcar todas como lidas',
  'Bloqueio do app',
  'Desconectar',
];

/** One sidebar row backed by a native WhatsApp control. */
interface Entry {
  label: string;
  badge?: number | null;
  run: () => void;
}

const iconFor = (label: string) => NATIVE_ICONS.find(([re]) => re.test(label))?.[1] ?? RiCircleLine;

/**
 * BoardUI sidebar in place of WhatsApp's native rail. Native entries click the
 * (hidden) original buttons, so WhatsApp keeps all its own behavior; CRM
 * entries open our views. Built from BoardUI's dashboard-sidebar pieces.
 */
export function Sidebar({ store }: { store: CrmStore }) {
  const railBox = useRailBox();
  return railBox ? <SidebarShell store={store} railBox={railBox} /> : null;
}

function SidebarShell({ store, railBox }: { store: CrmStore; railBox: HTMLElement }) {
  const view = useCrm(store, (s) => s.view);
  const clientes = useCrm(store, (s) => Object.values(s.tracked).filter((c) => c.status === 'cliente').length);
  const [native, setNative] = useState<RailItem[]>(() => readRailItems(railBox));
  const [lastNative, setLastNative] = useState<string | null>(null);

  // Push WhatsApp right by (our width − native rail width); follows collapse.
  const shellRef = useRef<HTMLDivElement>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [hasArchived, setHasArchived] = useState(false);
  const [hasNewChat, setHasNewChat] = useState(false);
  const [hasMenu, setHasMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [zIndex, setZIndex] = useState(SIDEBAR_Z);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const column = findRailColumn(railBox);
    // Native rail stays in place (keeps WhatsApp's layout) but invisible; we paint above WhatsApp's layer.
    setRailVisible(column, false);
    setZIndex(zIndexAbove(column, SIDEBAR_Z));
    const update = () => setAppShift(Math.max(0, shell.offsetWidth - column.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    // Layout problems show up in the footer, so a screenshot is enough to diagnose them.
    const probe = window.setInterval(() => {
      const host = (shell.getRootNode() as ShadowRoot).host;
      hideEdgeLines(shell.offsetWidth);
      const over = findIntruders(host, shell.offsetWidth);
      const next = [
        describeShiftFailure(column, shell.offsetWidth),
        over.length ? `Sobreposto por: ${over.join(' · ')}` : null,
      ].filter((d): d is string => d !== null);
      if (!findMenuButton()) next.push('Menu ⋮ não encontrado');
      if (!findNewChatButton()) next.push('Botão Nova conversa não encontrado');
      setDiagnostics((prev) => (prev.join() === next.join() ? prev : next));
      setHasArchived(!!findArchivedEntry());
      setHasNewChat(!!findNewChatButton());
      setHasMenu(!!findMenuButton());
    }, 2000);
    return () => {
      observer.disconnect();
      window.clearInterval(probe);
      setAppShift(0);
      showEdgeLines();
      setRailVisible(null, true);
    };
  }, [railBox]);

  // Mirror badges / selection of the native buttons (under our sidebar).
  useEffect(() => {
    const update = () => setNative(readRailItems(railBox));
    update();
    const observer = new MutationObserver(update);
    observer.observe(railBox, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    return () => observer.disconnect();
  }, [railBox]);

  const top = native.filter((i) => !i.bottom);
  const bottom = native.filter((i) => i.bottom);
  const nativeSelected = native.find((i) => i.selected)?.label ?? lastNative ?? top[0]?.label;
  const selected = view === 'pipeline' ? 'crm:pipeline' : nativeSelected;

  const openNative = (label: string) => {
    store.setView('none');
    setLastNative(label);
    clickRailItem(railBox, label);
  };

  const fromRail = (item: RailItem): Entry => ({
    label: item.label,
    badge: item.badge,
    run: () => openNative(item.label),
  });
  const has = (re: RegExp) => top.some((i) => re.test(i.label));
  const menuEntries: Entry[] = hasMenu
    ? MENU_ACTIONS
        // The rail already has these.
        .filter(
          (label) =>
            !(/^anunciar$/i.test(label) && has(/anunciar/i)) && !(/^ferramentas/i.test(label) && has(/ferramentas/i)),
        )
        .map((label) => ({
          label,
          run: () => {
            store.setView('none');
            // Selecting works on WhatsApp's own list, not ours.
            if (/selecionar conversas/i.test(label)) store.setNativeList(true);
            void runMenuAction(label, MENU_ACTIONS);
          },
        }))
    : [];
  const entries: Entry[] = [
    ...top.map(fromRail),
    // Arquivadas lives at the top of the native list, which our list replaces.
    ...(hasArchived && !has(/arquivad|archived/i)
      ? [{ label: 'Arquivadas', run: () => (store.setView('none'), findArchivedEntry()?.click()) }]
      : []),
    ...(hasNewChat
      ? [{ label: 'Nova conversa', run: () => (store.setView('none'), findNewChatButton()?.click()) }]
      : []),
    ...menuEntries,
  ];
  const sections = categorize(entries);
  const account = sections.find((sec) => sec.id === 'conta')?.items ?? [];
  const body = sections.filter((sec) => sec.id !== 'conta');

  const row = (entry: Entry) => (
    <NavItem
      key={entry.label}
      icon={iconFor(entry.label)}
      label={entry.label}
      isSelected={selected === entry.label}
      onClick={entry.run}
      badge={
        entry.badge ? <Badge color={selected === entry.label ? 'primary' : 'neutral'}>{entry.badge}</Badge> : undefined
      }
    />
  );

  const section = (key: string, title: string, children: ReactNode) => (
    <Fragment key={key}>
      <div className="h-px w-full shrink-0 bg-separator-border" aria-hidden />
      <nav aria-label={title} className="flex w-full flex-col gap-1 px-0.5">
        <div className="px-2">
          <span className="text-caption-1-semibold whitespace-nowrap text-text-tertiary uppercase">{title}</span>
        </div>
        {children}
      </nav>
    </Fragment>
  );

  const crm = section(
    'crm',
    'CRM',
    <>
      <NavItem
        icon={RiLayoutColumnLine}
        label="Pipeline"
        isSelected={selected === 'crm:pipeline'}
        onClick={() => store.setView(view === 'pipeline' ? 'none' : 'pipeline')}
      />
      <NavItem
        icon={RiStarLine}
        label="Clientes"
        onClick={() => {
          if (top[0]) openNative(top[0].label);
          store.setNativeList(false);
          activeTabItem.setValue('cliente');
        }}
        badge={clientes ? <Badge color="neutral">{clientes}</Badge> : undefined}
      />
    </>,
  );
  const renderSection = (sec: Category<Entry>) => section(sec.id, sec.title, sec.items.map(row));

  return (
    <Surface>
      <div ref={shellRef} className="fixed inset-y-0 start-0 bg-background-full p-2" style={{ zIndex }}>
        <aside
          className={cx(
            'flex h-full shrink-0 flex-col overflow-hidden',
            'rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar',
            'w-[260px] p-3',
          )}
        >
          {/* Header stays put; only the sections scroll. */}
          <div className="flex w-full shrink-0 flex-col gap-3 pb-3">
            {/* Brand */}
            <div>
              <span className="block ps-1 text-body-semibold whitespace-nowrap">
                WhatsApp CRM{' '}
                <span className="text-body-regular text-text-tertiary">
                  by{' '}
                  <a
                    href="https://astruzdev.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm text-accent-400 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    Astruz
                  </a>
                </span>
              </span>
            </div>
          </div>

          <div className="relative -mx-2 min-h-0 flex-1">
            <div
              className="flex h-full flex-col gap-3 overflow-y-auto px-2 pb-3 [scrollbar-width:none]"
              onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
            >
              {body.filter((sec) => sec.id === 'conversas').map(renderSection)}
              {/* CRM right after Conversas: it is what the team opens most. */}
              {crm}
              {body.filter((sec) => sec.id !== 'conversas').map(renderSection)}
            </div>
            {/* Progressive top fade (as in BoardUI's settings modal): sections dissolve under the header. */}
            <div
              aria-hidden
              className={cx(
                'pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-background-secondary-default to-transparent',
                'transition-opacity duration-200 ease-out',
                scrolled ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>

          <div className="flex w-full shrink-0 flex-col gap-1 border-t border-separator-border pt-3">
            {diagnostics.map((d) => (
              <p key={d} className="px-2 text-caption-1-regular break-all text-text-tertiary">
                {d}
              </p>
            ))}
            <nav aria-label="Conta" className="flex w-full flex-col gap-1">
              {/* Desconectar last, away from Configurações (the most clicked footer entry). */}
              {[
                ...account.filter((e) => !/desconectar|log ?out/i.test(e.label)),
                ...bottom.map(fromRail),
                ...account.filter((e) => /desconectar|log ?out/i.test(e.label)),
              ].map(row)}
            </nav>
          </div>
        </aside>
      </div>
    </Surface>
  );
}
