import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RiCloseLine, RiLayoutColumnLine, RiTimeLine } from '@remixicon/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/base/badges/badge';
import { Chip } from '@/components/base/badges/chip';
import { IconButton } from '@/components/base/buttons/icon-button';
import type { ChatSummary } from '@/lib/bridge/protocol';
import { formatChatTime } from '@/lib/format';
import type { ChatRecord, Stage } from '@/lib/repo/schema';
import { workspaceLeft } from '@/lib/wa-dom';
import { cx } from '@/utils/cx';
import { useCrm, type CrmStore } from '../store';
import { ChatAvatar, OVERLAY_Z, STAGE_CHIP, Surface, useChatPic } from './shared';

interface Card {
  jid: string;
  record: ChatRecord;
  live?: ChatSummary;
}

const COLUMN_PREFIX = 'col:';

/**
 * Whatever is under the pointer wins (a card, else its column). closestCorners
 * alone picks cards of the source column when dropping into a tall empty one.
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length === 0) return closestCorners(args);
  const card = hits.find((h) => !String(h.id).startsWith(COLUMN_PREFIX));
  return card ? [card] : hits;
};

/** Full-screen Kanban of clientes by pipeline stage, covering everything right of WhatsApp's rail. */
export function Pipeline({ store }: { store: CrmStore }) {
  const view = useCrm(store, (s) => s.view);
  const chats = useCrm(store, (s) => s.chats);
  const tracked = useCrm(store, (s) => s.tracked);
  const stages = useCrm(store, (s) => s.stages);
  const trackedError = useCrm(store, (s) => s.trackedError);
  const left = useWorkspaceLeft(view === 'pipeline');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Space picks a card up (arrows move, Space drops); Enter opens the conversation.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  // While a card is being dragged (keyboard drag), Escape cancels the drag instead of closing the board.
  const dragging = useRef(false);
  useEffect(() => {
    if (view !== 'pipeline') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || dragging.current) return;
      // Escape inside another popover or dialog closes that one, not the board.
      const inPopover = e
        .composedPath()
        .some((n) => n instanceof Element && n.matches('[role="dialog"], [role="menu"], [role="listbox"]'));
      if (!inPopover) store.setView('none');
    };
    // Capture: the sidebar's shadow host stops keydown from bubbling out (isolateEvents).
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, store]);

  const columns = useMemo(() => {
    const live = new Map(chats.map((c) => [c.jid, c]));
    const byStage = new Map<string, Card[]>(stages.map((s) => [s.id, []]));
    for (const record of Object.values(tracked)) {
      if (record.status !== 'cliente' || !record.stageId) continue;
      byStage.get(record.stageId)?.push({ jid: record.jid, record, live: live.get(record.jid) });
    }
    byStage.forEach((cards) => cards.sort((a, b) => a.record.position - b.record.position));
    return byStage;
  }, [chats, tracked, stages]);

  if (view !== 'pipeline') return null;

  const total = [...columns.values()].reduce((n, c) => n + c.length, 0);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const jid = String(active.id);
    const overId = String(over.id);
    let stageId: string;
    let index: number;
    if (overId.startsWith(COLUMN_PREFIX)) {
      stageId = overId.slice(COLUMN_PREFIX.length);
      index = columns.get(stageId)?.filter((c) => c.jid !== jid).length ?? 0;
    } else {
      const target = tracked[overId];
      if (!target?.stageId) return;
      stageId = target.stageId;
      // Index in the column as shown: dragging down onto a card lands after it, up lands before it.
      index = (columns.get(stageId) ?? []).findIndex((c) => c.jid === overId);
      if (index < 0) index = 0;
    }
    store.moveToStage(jid, stageId, index).catch((err) => console.warn('[WhatsApp CRM] mover', err));
  };

  return (
    <Surface>
      {/* Fixed element carries its own z-index: the shadow host's z-index is reset by WXT. */}
      {/* Same card as the list and the conversation: 8px of ground around it, starting where the list card starts. */}
      <div className="fixed inset-y-0 right-0 flex bg-background-full p-2 ps-0" style={{ left, zIndex: OVERLAY_Z }}>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar">
          <header className="flex items-center justify-between gap-4 border-b border-separator-border px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent-900 text-accent-300">
                <RiLayoutColumnLine className="size-5" aria-hidden />
              </span>
              <div>
                <h1 className="text-title-3-semibold">Pipeline de clientes</h1>
                <p className="text-body-2-regular text-text-tertiary">
                  {total} {total === 1 ? 'cliente' : 'clientes'} · arraste os cards entre as etapas
                </p>
              </div>
            </div>
            <IconButton icon={RiCloseLine} aria-label="Fechar pipeline" onClick={() => store.setView('none')} />
          </header>

          {total === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="max-w-sm text-center text-body-regular text-text-tertiary">
                {trackedError
                  ? `Não consegui ler os clientes salvos. ${trackedError}`
                  : 'Nenhum cliente ainda. Marque grupos ou conversas com a estrela nas abas Individual e Grupos, ou pelo botão CRM da conversa, e eles aparecem aqui.'}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collision}
              onDragStart={() => (dragging.current = true)}
              onDragEnd={(e) => {
                // After the keydown that ended it has been seen by our Escape listener.
                setTimeout(() => (dragging.current = false));
                onDragEnd(e);
              }}
              onDragCancel={() => setTimeout(() => (dragging.current = false))}
            >
              <div className="flex flex-1 gap-4 overflow-x-auto p-6">
                {stages.map((stage) => (
                  <Column
                    key={stage.id}
                    store={store}
                    stage={stage}
                    cards={columns.get(stage.id) ?? []}
                    onOpen={(jid) => store.openChat(jid)}
                  />
                ))}
              </div>
            </DndContext>
          )}
        </div>
      </div>
    </Surface>
  );
}

function Column({
  store,
  stage,
  cards,
  onOpen,
}: {
  store: CrmStore;
  stage: Stage;
  cards: Card[];
  onOpen: (jid: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_PREFIX + stage.id });
  return (
    <section
      ref={setNodeRef}
      className={cx(
        // A well inside the pipeline card; the clients are the primary-surface cards, as in the chat list.
        'flex min-w-48 flex-1 basis-0 flex-col rounded-2xl border border-border-button-default transition-colors duration-150',
        isOver && 'border-accent-600 bg-background-secondary-hover',
      )}
    >
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <Chip variant="subtle" color={STAGE_CHIP[stage.color]}>
          {stage.name}
        </Chip>
        <span className="text-caption-1-semibold text-text-tertiary tabular-nums">{cards.length}</span>
      </header>
      <SortableContext items={cards.map((c) => c.jid)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {cards.map((card) => (
            <CardItem key={card.jid} store={store} card={card} onOpen={onOpen} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function CardItem({ store, card, onOpen }: { store: CrmStore; card: Card; onOpen: (jid: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.jid });
  const name = card.live?.name ?? card.record.displayName;
  const lastAt =
    card.live?.lastAt ?? (Math.max(card.record.lastInboundAt ?? 0, card.record.lastOutboundAt ?? 0) || null);
  const unread = card.live?.unread ?? 0;
  const pic = useChatPic(store, card.jid, card.live?.pic);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.jid)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter') onOpen(card.jid);
      }}
      className={cx(
        'cursor-grab rounded-2xl border border-border-button-default bg-background-primary-default p-3 transition-colors duration-150 outline-none hover:border-border-button-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring active:cursor-grabbing',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="wacrm-blur-photos shrink-0">
          <ChatAvatar name={name} kind={card.record.kind} pic={pic} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="wacrm-blur-names truncate text-body-2-medium">{name}</p>
          <p className="text-caption-1-regular text-text-tertiary">
            {card.record.kind === 'group' ? 'Grupo' : 'Conversa'}
          </p>
        </div>
        {unread > 0 && <Badge color="primary">{unread}</Badge>}
      </div>
      {(card.record.tags.length > 0 || lastAt) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {card.record.tags.map((tag) => (
            <Chip key={tag} variant="subtle" color="gray">
              {tag}
            </Chip>
          ))}
          {lastAt && (
            <span className="ms-auto inline-flex items-center gap-1 text-caption-1-regular text-text-tertiary">
              <RiTimeLine className="size-3.5" aria-hidden />
              {formatChatTime(lastAt)}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/** Tracks where the native rail ends so the workspace leaves it visible. */
function useWorkspaceLeft(active: boolean): number {
  const [left, setLeft] = useState(workspaceLeft);
  useEffect(() => {
    if (!active) return;
    const update = () => setLeft(workspaceLeft());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active]);
  return left;
}
