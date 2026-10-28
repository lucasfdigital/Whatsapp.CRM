import { useSyncExternalStore } from 'react';
import type { BridgeClient } from '@/lib/bridge/client';
import type { ChatAction, ChatSummary } from '@/lib/bridge/protocol';
import type { Repo } from '@/lib/repo/repo';
import type { ChatRecord, Note, Stage } from '@/lib/repo/schema';
import { setStatus as setDomStatus } from '@/lib/wa-dom';

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Photo requests in flight at once (WhatsApp itself loads them as rows scroll in). */
const PIC_CONCURRENCY = 3;
export type View = 'none' | 'pipeline';

export interface CrmState {
  status: LoadStatus;
  error?: string;
  chats: ChatSummary[];
  tracked: Record<string, ChatRecord>;
  /** Our own storage failed: Clientes and the Pipeline can't be trusted to be empty. */
  trackedError?: string;
  stages: Stage[];
  activeChat: ChatSummary | null;
  view: View;
  /** WhatsApp's own list instead of ours (e.g. "Selecionar conversas" works on it). */
  nativeList: boolean;
  /** Profile photos fetched on demand (memory only: URLs expire, never stored). */
  pics: Record<string, string | null>;
}

/**
 * Single source of truth shared by every injected surface (tab bar, rail,
 * pipeline workspace, contact panel). Each surface is its own React root in
 * its own shadow root; they all read and act through this store.
 */
export function createCrmStore(bridge: BridgeClient, repo: Repo) {
  let state: CrmState = {
    status: bridge.isReady ? 'ready' : 'loading',
    chats: [],
    tracked: {},
    stages: [],
    activeChat: null,
    view: 'none',
    nativeList: false,
    pics: {},
  };
  const subs = new Set<() => void>();
  const picQueue: string[] = [];
  const picLoading = new Set<string>();
  /** Failed photo fetches per chat: retried once, then treated as "no photo" (no refetch on every scroll). */
  const picFailures = new Map<string, number>();
  const pumpPics = () => {
    while (picLoading.size < PIC_CONCURRENCY && picQueue.length > 0) {
      const jid = picQueue.shift()!;
      picLoading.add(jid);
      bridge.getProfilePic(jid).then(
        (pic) => {
          picLoading.delete(jid);
          set({ pics: { ...state.pics, [jid]: pic } });
          pumpPics();
        },
        () => {
          picLoading.delete(jid);
          const failures = (picFailures.get(jid) ?? 0) + 1;
          picFailures.set(jid, failures);
          if (failures >= 2) set({ pics: { ...state.pics, [jid]: null } });
          pumpPics();
        },
      );
    }
  };
  const set = (patch: Partial<CrmState>) => {
    state = { ...state, ...patch };
    subs.forEach((cb) => cb());
  };

  const loadChats = async () => {
    try {
      const chats = await bridge.listChats();
      set({ chats, status: 'ready', error: undefined });
      setDomStatus('wacrmChats', String(chats.length));
    } catch (err) {
      console.warn('[WhatsApp CRM] listChats', err);
      setDomStatus('wacrmChats', `erro: ${String(err)}`);
      set({ status: 'error', error: String(err) });
    }
  };

  const loadTracked = async () => {
    try {
      const [list, stages] = await Promise.all([repo.listChats(), repo.listStages()]);
      set({ tracked: Object.fromEntries(list.map((c) => [c.jid, c])), stages, trackedError: undefined });
    } catch (err) {
      // Without this, Clientes and the Pipeline would just look empty.
      console.warn('[WhatsApp CRM] storage', err);
      set({ trackedError: String(err) });
    }
  };

  const loadActive = async () => {
    try {
      set({ activeChat: await bridge.getActiveChat() });
    } catch {
      // Older wa-js builds may not expose it; the event still updates it.
    }
  };

  const ensureTracked = (chat: Pick<ChatSummary, 'jid' | 'kind' | 'name'>) =>
    repo.trackChat({ jid: chat.jid, kind: chat.kind, displayName: chat.name });

  const offs: Array<() => void> = [];

  return {
    getState: () => state,
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },

    start() {
      offs.push(
        bridge.on('ready', () => {
          loadChats();
          loadActive();
        }),
        bridge.on('chatsChanged', loadChats),
        bridge.on('error', (msg) => set({ status: 'error', error: msg })),
        bridge.on('activeChat', (chat) => set({ activeChat: chat })),
        repo.onChange(loadTracked),
      );
      if (bridge.isReady) {
        loadChats();
        loadActive();
      }
      loadTracked();
    },
    stop() {
      offs.splice(0).forEach((off) => off());
      picQueue.length = 0;
    },

    setView: (view: View) => set({ view }),
    setNativeList: (nativeList: boolean) => set({ nativeList }),

    /** Asks WhatsApp for a chat's photo once; at most PIC_CONCURRENCY at a time. */
    requestPic(jid: string) {
      if (jid in state.pics || picQueue.includes(jid) || picLoading.has(jid)) return;
      picQueue.push(jid);
      pumpPics();
    },

    listLists: () => bridge.listLists(),
    /** One of WhatsApp's own chat-menu actions; the list refreshes right after. */
    async chatAction(jid: string, action: ChatAction) {
      await bridge.chatAction(jid, action);
      // Refresh in the background: the menu closes as soon as WhatsApp confirms.
      void loadChats();
    },

    async openChat(jid: string) {
      set({ view: 'none' });
      await bridge.openChat(jid).catch((err) => console.warn('[WhatsApp CRM] openChat', err));
    },

    async setCliente(chat: Pick<ChatSummary, 'jid' | 'kind' | 'name'>, isCliente: boolean) {
      await ensureTracked(chat);
      await repo.setStatus(chat.jid, isCliente ? 'cliente' : 'none');
    },

    moveToStage: (jid: string, stageId: string, index: number) => repo.moveToStage(jid, stageId, index),

    async setTags(chat: Pick<ChatSummary, 'jid' | 'kind' | 'name'>, tags: string[]) {
      await ensureTracked(chat);
      await repo.setTags(chat.jid, tags);
    },

    listNotes: (jid: string): Promise<Note[]> => repo.listNotes(jid),
    addNote: (jid: string, body: string) => repo.addNote(jid, body),
    deleteNote: (id: string) => repo.deleteNote(id),
  };
}

export type CrmStore = ReturnType<typeof createCrmStore>;

export function useCrm<T>(store: CrmStore, select: (s: CrmState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}
