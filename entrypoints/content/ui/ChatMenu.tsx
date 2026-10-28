import {
  RiArchiveLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiChatCheckLine,
  RiChatUnreadLine,
  RiDeleteBinLine,
  RiEraserLine,
  RiHeartLine,
  RiListCheck,
  RiLogoutBoxRLine,
  RiMore2Fill,
  RiNotificationOffLine,
  RiNotificationLine,
  RiPushpinLine,
  RiUnpinLine,
  RiInboxUnarchiveLine,
} from '@remixicon/react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from '@/components/base/dropdown/dropdown';
import type { ChatAction, ChatListInfo, ChatSummary } from '@/lib/bridge/protocol';
import { cx } from '@/utils/cx';
import type { CrmStore } from '../store';

type MenuChat = Pick<
  ChatSummary,
  'jid' | 'kind' | 'name' | 'archived' | 'pinned' | 'muted' | 'unread' | 'markedUnread'
>;

const MUTE_OPTIONS: Array<{ label: string; seconds: number | 'always' }> = [
  { label: '8 horas', seconds: 8 * 3600 },
  { label: '1 semana', seconds: 7 * 24 * 3600 },
  { label: 'Sempre', seconds: 'always' },
];

/** WhatsApp's favorites list goes by this name in pt-BR / en. */
const FAVORITES = /^(favoritos|favorites)$/i;

/**
 * WhatsApp's own per-chat menu (archive, mute, pin, unread, lists, clear,
 * delete/leave) on our card. Destructive entries ask for confirmation first.
 */
export function ChatMenu({ store, chat, portal }: { store: CrmStore; chat: MenuChat; portal?: Element | null }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<'mute' | 'lists' | null>(null);
  const [confirm, setConfirm] = useState<'clear' | 'delete' | 'leave' | null>(null);
  const [lists, setLists] = useState<ChatListInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  // Bumped on every open/close: a late result from an older open must not touch the menu.
  const session = useRef(0);

  const onOpenChange = (next: boolean) => {
    session.current++;
    setOpen(next);
    setSub(null);
    setConfirm(null);
    setError(null);
    setPending(false);
    // Lists change in WhatsApp: fetch them on every open.
    if (next) {
      const current = session.current;
      store.listLists().then(
        (l) => session.current === current && setLists(l),
        () => session.current === current && setLists([]),
      );
    }
  };

  const run = (action: ChatAction) => {
    if (pending) return; // one action per open: a double click must not run it twice
    setPending(true);
    const current = session.current;
    store.chatAction(chat.jid, action).then(
      () => session.current === current && onOpenChange(false),
      (err) => {
        if (session.current !== current) return;
        setPending(false);
        setError(String(err).replace(/^Error: /, ''));
      },
    );
  };

  const favorites = lists?.find((l) => FAVORITES.test(l.name));
  const otherLists = lists?.filter((l) => l !== favorites) ?? [];
  const unread = chat.unread > 0 || !!chat.markedUnread;
  const isGroup = chat.kind === 'group';

  const CONFIRM = {
    clear: { text: 'Limpar todas as mensagens desta conversa?', cta: 'Limpar', action: { type: 'clear' } },
    delete: { text: 'Apagar esta conversa?', cta: 'Apagar', action: { type: 'delete' } },
    leave: { text: `Sair do grupo ${chat.name}?`, cta: 'Sair', action: { type: 'leave' } },
  } as const satisfies Record<string, { text: string; cta: string; action: ChatAction }>;

  return (
    // Clicks and keys in the menu must not open the chat (the card is clickable).
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
      <Dropdown isOpen={open} onOpenChange={onOpenChange}>
        <DropdownTrigger
          aria-label={`Opções de ${chat.name}`}
          className={cx(
            'rounded-md p-0.5 text-foreground-icon-tertiary hover:text-foreground-icon-primary',
            open && 'text-foreground-icon-primary',
          )}
        >
          <RiMore2Fill className="size-4" />
        </DropdownTrigger>
        <DropdownPopover
          aria-label={`Opções de ${chat.name}`}
          placement="bottom end"
          portalContainer={portal ?? undefined}
          // While an action runs: dimmed and inert, so nothing fires twice.
          dialogClassName={pending ? 'pointer-events-none opacity-60' : undefined}
        >
          {confirm ? (
            <div className="flex flex-col gap-3 p-2">
              <p className="text-body-2-regular">{CONFIRM[confirm].text}</p>
              <div className="flex justify-end gap-2">
                <Button size="small" variant="secondary" onClick={() => setConfirm(null)}>
                  Cancelar
                </Button>
                <Button size="small" variant="danger" onClick={() => run(CONFIRM[confirm].action)}>
                  {CONFIRM[confirm].cta}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Item
                icon={chat.archived ? RiInboxUnarchiveLine : RiArchiveLine}
                onSelect={() => run({ type: 'archive', on: !chat.archived })}
              >
                {chat.archived ? 'Desarquivar conversa' : 'Arquivar conversa'}
              </Item>
              {chat.muted ? (
                <Item icon={RiNotificationLine} onSelect={() => run({ type: 'mute', seconds: null })}>
                  Reativar notificações
                </Item>
              ) : (
                <>
                  <Item
                    icon={RiNotificationOffLine}
                    onSelect={() => setSub(sub === 'mute' ? null : 'mute')}
                    submenu={sub === 'mute'}
                  >
                    Silenciar notificações
                  </Item>
                  {sub === 'mute' &&
                    MUTE_OPTIONS.map((o) => (
                      <Item key={o.label} indent onSelect={() => run({ type: 'mute', seconds: o.seconds })}>
                        {o.label}
                      </Item>
                    ))}
                </>
              )}
              <Item
                icon={chat.pinned ? RiUnpinLine : RiPushpinLine}
                onSelect={() => run({ type: 'pin', on: !chat.pinned })}
              >
                {chat.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
              </Item>
              <Item
                icon={unread ? RiChatCheckLine : RiChatUnreadLine}
                onSelect={() => run({ type: 'unread', on: !unread })}
              >
                {unread ? 'Marcar como lida' : 'Marcar como não lida'}
              </Item>
              {favorites && (
                <Item icon={RiHeartLine} onSelect={() => run({ type: 'addToList', listId: favorites.id })}>
                  Adicionar aos Favoritos
                </Item>
              )}
              {otherLists.length > 0 && (
                <>
                  <Item
                    icon={RiListCheck}
                    onSelect={() => setSub(sub === 'lists' ? null : 'lists')}
                    submenu={sub === 'lists'}
                  >
                    Adicionar à lista
                  </Item>
                  {sub === 'lists' &&
                    otherLists.map((l) => (
                      <Item key={l.id} indent onSelect={() => run({ type: 'addToList', listId: l.id })}>
                        {l.name || 'Lista sem nome'}
                      </Item>
                    ))}
                </>
              )}
              <DropdownDivider />
              <Item icon={RiEraserLine} danger onSelect={() => setConfirm('clear')}>
                Limpar conversa
              </Item>
              {isGroup ? (
                <Item icon={RiLogoutBoxRLine} danger onSelect={() => setConfirm('leave')}>
                  Sair do grupo
                </Item>
              ) : (
                <Item icon={RiDeleteBinLine} danger onSelect={() => setConfirm('delete')}>
                  Apagar conversa
                </Item>
              )}
            </>
          )}
          {error && <p className="px-2 pb-1 text-caption-1-regular text-text-error-primary">{error}</p>}
        </DropdownPopover>
      </Dropdown>
    </span>
  );
}

function Item({
  icon: Icon,
  onSelect,
  danger,
  indent,
  submenu,
  children,
}: {
  icon?: typeof RiArchiveLine;
  onSelect: () => void;
  danger?: boolean;
  indent?: boolean;
  /** Has a nested list; true while it is expanded. */
  submenu?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownItem onSelect={onSelect} className={cx(indent && 'ps-9', danger && 'text-text-error-primary')}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate text-start">{children}</span>
      {submenu !== undefined &&
        (submenu ? (
          <RiArrowDownSLine className="size-4" aria-hidden />
        ) : (
          <RiArrowRightSLine className="size-4" aria-hidden />
        ))}
    </DropdownItem>
  );
}
