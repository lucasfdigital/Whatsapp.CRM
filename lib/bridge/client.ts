import {
  FROM_PAGE,
  TO_PAGE,
  type BridgeRequest,
  type ChatSummary,
  type MessageSeen,
  type PageMessage,
} from './protocol';
import { chatSummarySchema, pageMessageSchema, profilePicSchema } from './schemas';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface BridgeEvents {
  ready: () => void;
  error: (message: string) => void;
  chatsChanged: () => void;
  message: (message: MessageSeen) => void;
  activeChat: (chat: ChatSummary | null) => void;
}

/** Isolated-world side of the bridge: typed requests + events from wa-bridge. */
export function createBridgeClient(target: EventTarget = window, timeoutMs = 15_000) {
  const pending = new Map<string, Pending>();
  const listeners: { [K in keyof BridgeEvents]: Set<BridgeEvents[K]> } = {
    ready: new Set(),
    error: new Set(),
    chatsChanged: new Set(),
    message: new Set(),
    activeChat: new Set(),
  };
  let isReady = false;
  const markReady = () => {
    if (isReady) return;
    isReady = true;
    listeners.ready.forEach((cb) => cb());
  };

  const onPageMessage = (event: Event) => {
    let parsed: PageMessage;
    try {
      parsed = pageMessageSchema.parse(JSON.parse((event as CustomEvent<string>).detail));
    } catch {
      return;
    }
    switch (parsed.type) {
      case 'response': {
        const p = pending.get(parsed.id);
        if (!p) return;
        pending.delete(parsed.id);
        clearTimeout(p.timer);
        parsed.ok ? p.resolve(parsed.result) : p.reject(new Error(parsed.error ?? 'erro desconhecido'));
        return;
      }
      case 'ready':
        markReady();
        return;
      case 'error':
        listeners.error.forEach((cb) => cb(parsed.message));
        return;
      case 'chatsChanged':
        listeners.chatsChanged.forEach((cb) => cb());
        return;
      case 'message':
        listeners.message.forEach((cb) => cb(parsed.message));
        return;
      case 'activeChat':
        listeners.activeChat.forEach((cb) => cb(parsed.chat));
        return;
    }
  };
  target.addEventListener(FROM_PAGE, onPageMessage);

  const request = (req: DistributiveOmit<BridgeRequest, 'id'>): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout: ${req.method}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      target.dispatchEvent(new CustomEvent(TO_PAGE, { detail: JSON.stringify({ ...req, id }) }));
    });

  // The page script may have posted 'ready' before we started listening.
  request({ method: 'ping' })
    .then((started) => started === true && markReady())
    .catch(() => undefined);

  return {
    get isReady() {
      return isReady;
    },
    on<K extends keyof BridgeEvents>(event: K, cb: BridgeEvents[K]) {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    async listChats(): Promise<ChatSummary[]> {
      const raw = await request({ method: 'listChats' });
      if (!Array.isArray(raw)) throw new Error('listChats: resposta inválida');
      // One malformed chat is dropped instead of failing the whole list;
      // all of them failing means WhatsApp changed shape, which must show as an error.
      const chats = raw.flatMap((item) => {
        const parsed = chatSummarySchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      });
      if (raw.length > 0 && chats.length === 0) throw new Error('listChats: nenhuma conversa em formato válido');
      if (chats.length < raw.length)
        console.warn(`[WhatsApp CRM] ${raw.length - chats.length} conversa(s) ignorada(s)`);
      return chats;
    },
    async getActiveChat(): Promise<ChatSummary | null> {
      const raw = await request({ method: 'getActiveChat' });
      return chatSummarySchema.nullable().parse(raw ?? null);
    },
    async openChat(jid: string): Promise<void> {
      await request({ method: 'openChat', jid });
    },
    /** Profile photo URL (fetched by WhatsApp if needed); null when there is none. */
    async getProfilePic(jid: string): Promise<string | null> {
      const raw = await request({ method: 'getProfilePic', jid });
      const parsed = profilePicSchema.safeParse(raw ?? null);
      return parsed.success ? parsed.data : null;
    },
    dispose() {
      target.removeEventListener(FROM_PAGE, onPageMessage);
      pending.forEach((p) => clearTimeout(p.timer));
      pending.clear();
    },
  };
}

export type BridgeClient = ReturnType<typeof createBridgeClient>;
