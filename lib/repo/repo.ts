import type { ChatKind } from '@/lib/bridge/protocol';
import type { KV } from './kv';
import { migrate } from './migrations';
import {
  KEYS,
  chatsSchema,
  metaSchema,
  notesSchema,
  stagesSchema,
  type ChatRecord,
  type ChatStatus,
  type Chats,
  type Meta,
  type Note,
  type Stage,
} from './schema';

export interface TrackChatInput {
  jid: string;
  kind: ChatKind;
  displayName: string;
}

/**
 * Single entry point to persisted CRM data. UI never touches storage directly,
 * so a backend can replace the KV later without rewriting screens.
 */
export function createRepo(kv: KV, now: () => number = Date.now) {
  // Serialize read-modify-write cycles inside this tab.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  let ready: Promise<void> | undefined;
  const init = () =>
    (ready ??= exclusive(async () => {
      const raw = await kv.get(Object.values(KEYS));
      const migrated = migrate(raw);
      if (migrated !== raw) await kv.set(migrated);
    }));

  const readChats = async (): Promise<Chats> => {
    const { [KEYS.chats]: chats } = await kv.get([KEYS.chats]);
    return chatsSchema.parse(chats ?? {});
  };

  /** `fn` mutates the map; returning `false` skips the write. */
  const updateChats = async (fn: (chats: Chats) => boolean | void) => {
    await init();
    return exclusive(async () => {
      const chats = await readChats();
      if (fn(chats) !== false) await kv.set({ [KEYS.chats]: chatsSchema.parse(chats) });
      return chats;
    });
  };

  const readStages = async (): Promise<Stage[]> => {
    const { [KEYS.stages]: stages } = await kv.get([KEYS.stages]);
    return Object.values(stagesSchema.parse(stages ?? {})).sort((a, b) => a.order - b.order);
  };

  return {
    init,

    async getMeta(): Promise<Meta> {
      await init();
      const { [KEYS.meta]: meta } = await kv.get([KEYS.meta]);
      return metaSchema.parse(meta);
    },

    async listChats(): Promise<ChatRecord[]> {
      await init();
      return Object.values(await readChats());
    },

    async getChat(jid: string): Promise<ChatRecord | undefined> {
      await init();
      return (await readChats())[jid];
    },

    /** Starts tracking a chat (idempotent). Refreshes the display name if it changed. */
    async trackChat(input: TrackChatInput): Promise<ChatRecord> {
      const chats = await updateChats((chats) => {
        const existing = chats[input.jid];
        const t = now();
        chats[input.jid] = existing
          ? { ...existing, displayName: input.displayName, updatedAt: t }
          : {
              jid: input.jid,
              kind: input.kind,
              displayName: input.displayName,
              status: 'none',
              stageId: null,
              position: 0,
              tags: [],
              lastInboundAt: null,
              lastOutboundAt: null,
              createdAt: t,
              updatedAt: t,
            };
      });
      return chats[input.jid]!;
    },

    /** New clientes land in the first pipeline stage (end of the column). */
    async setStatus(jid: string, status: ChatStatus): Promise<ChatRecord> {
      await init();
      const firstStage = (await readStages())[0]?.id ?? null;
      const chats = await updateChats((chats) => {
        const chat = chats[jid];
        if (!chat) throw new Error(`Chat não rastreado: ${jid}`);
        // Becoming a cliente (again) always starts in the first stage; older data may keep a stale stageId.
        const needsStage = status === 'cliente' && (chat.status !== 'cliente' || chat.stageId == null);
        const position = needsStage
          ? Math.max(
              0,
              ...Object.values(chats)
                .filter((c) => c.stageId === firstStage)
                .map((c) => c.position + 1),
            )
          : chat.position;
        // Leaving the clientes drops the stage: a re-marked chat starts over in the first one.
        const stageId = status !== 'cliente' ? null : needsStage ? firstStage : chat.stageId;
        chats[jid] = { ...chat, status, stageId, position: stageId == null ? 0 : position, updatedAt: now() };
      });
      return chats[jid]!;
    },

    async listStages(): Promise<Stage[]> {
      await init();
      return readStages();
    },

    /**
     * Kanban drop: puts `jid` in `stageId` at `index` and renumbers the target
     * and source columns so positions stay 0..n-1.
     */
    async moveToStage(jid: string, stageId: string, index: number): Promise<void> {
      await init();
      if (!(await readStages()).some((st) => st.id === stageId)) throw new Error(`Etapa não existe: ${stageId}`);
      await updateChats((chats) => {
        const chat = chats[jid];
        if (!chat) throw new Error(`Chat não rastreado: ${jid}`);
        const column = Object.values(chats)
          .filter((c) => c.stageId === stageId && c.status === 'cliente' && c.jid !== jid)
          .sort((a, b) => a.position - b.position);
        column.splice(Math.max(0, Math.min(index, column.length)), 0, chat);
        const t = now();
        const from = chat.stageId;
        column.forEach((c, i) => {
          chats[c.jid] = { ...chats[c.jid]!, stageId, position: i, ...(c.jid === jid ? { updatedAt: t } : {}) };
        });
        if (from !== stageId) {
          Object.values(chats)
            .filter((c) => c.stageId === from)
            .sort((a, b) => a.position - b.position)
            .forEach((c, i) => (chats[c.jid] = { ...c, position: i }));
        }
      });
    },

    async setTags(jid: string, tags: string[]): Promise<void> {
      const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
      await updateChats((chats) => {
        const chat = chats[jid];
        if (!chat) throw new Error(`Chat não rastreado: ${jid}`);
        chats[jid] = { ...chat, tags: clean, updatedAt: now() };
      });
    },

    async listNotes(jid: string): Promise<Note[]> {
      await init();
      const { [KEYS.notes]: notes } = await kv.get([KEYS.notes]);
      return Object.values(notesSchema.parse(notes ?? {}))
        .filter((n) => n.jid === jid)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async addNote(jid: string, body: string): Promise<Note> {
      await init();
      const note: Note = { id: crypto.randomUUID(), jid, body: body.trim(), createdAt: now() };
      await exclusive(async () => {
        const { [KEYS.notes]: raw } = await kv.get([KEYS.notes]);
        const notes = notesSchema.parse(raw ?? {});
        notes[note.id] = note;
        await kv.set({ [KEYS.notes]: notesSchema.parse(notes) });
      });
      return note;
    },

    async deleteNote(id: string): Promise<void> {
      await init();
      await exclusive(async () => {
        const { [KEYS.notes]: raw } = await kv.get([KEYS.notes]);
        const notes = notesSchema.parse(raw ?? {});
        if (!(id in notes)) return;
        delete notes[id];
        await kv.set({ [KEYS.notes]: notes });
      });
    },

    /**
     * Records time + direction of a message, only for chats already tracked
     * (we don't keep metadata of every contact). Out-of-order events are ignored.
     */
    async recordMessage(jid: string, at: number, fromMe: boolean): Promise<void> {
      await updateChats((chats) => {
        const chat = chats[jid];
        if (!chat) return false;
        const field = fromMe ? 'lastOutboundAt' : 'lastInboundAt';
        if ((chat[field] ?? 0) >= at) return false;
        chats[jid] = { ...chat, [field]: at };
      });
    },

    onChange(cb: () => void): () => void {
      const keys = new Set<string>(Object.values(KEYS));
      return kv.onChanged((changed) => {
        if (changed.some((k) => keys.has(k))) cb();
      });
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
