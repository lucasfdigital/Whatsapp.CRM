import {
  FROM_PAGE,
  TO_PAGE,
  kindFromJid,
  lastRealMessage,
  lastSpokeMe,
  previewOf,
  type BridgeRequest,
  type ChatSummary,
  type PageMessage,
} from '@/lib/bridge/protocol';

/**
 * Runs in WhatsApp's MAIN world, right after wa-js (`window.WPP`). The background
 * registers both only while the extension is switched on (lib/main-world.ts), so
 * "Desligado" leaves WhatsApp without any injected code after a reload.
 * Read-only on purpose: it lists chats, reports message direction/time and
 * opens a chat. It never sends messages and never sees extension storage.
 */
export default defineUnlistedScript(() => {
  const w = window as unknown as { __wacrmBridge?: boolean };
  if (w.__wacrmBridge) return;
  w.__wacrmBridge = true;
  document.documentElement.dataset.wacrmBridge = 'on';
  // Shown by the tab bar while loading, so a screenshot tells where it stopped.
  const stage = (value: string) => (document.documentElement.dataset.wacrmWajs = value);
  stage('aguardando');

  const post = (message: PageMessage) =>
    window.dispatchEvent(new CustomEvent(FROM_PAGE, { detail: JSON.stringify(message) }));

  const WPP = () => (window as unknown as { WPP?: any }).WPP;

  // Only what the preview needs; the rest of the message model stays in the page.
  const toMessageLike = (msg: any) =>
    msg && {
      type: msg.type,
      isNotification: msg.isNotification,
      id: { fromMe: msg.id?.fromMe },
      body: typeof msg.body === 'string' ? msg.body : undefined,
      caption: typeof msg.caption === 'string' ? msg.caption : undefined,
      senderName: msg.senderObj?.pushname || msg.senderObj?.formattedName || msg.notifyName || null,
    };

  const httpsOrNull = (url: unknown) => (typeof url === 'string' && url.startsWith('https://') ? url : null);

  const toSummary = (chat: any): ChatSummary => {
    const jid: string = chat.id?._serialized ?? String(chat.id);
    // Recent loaded messages; system entries (group notices…) don't count as "they spoke last".
    const loaded: any[] = chat.msgs?.getModelsArray?.() ?? chat.msgs?.models ?? [];
    const msgs = loaded.length ? loaded : [chat.msgs?.last?.()].filter(Boolean);
    return {
      jid,
      kind: kindFromJid(jid),
      name: chat.formattedTitle || chat.name || chat.contact?.pushname || jid.split('@')[0],
      lastAt: typeof chat.t === 'number' ? chat.t * 1000 : null,
      unread: Math.max(0, Number(chat.unreadCount) || 0),
      archived: Boolean(chat.archive),
      lastFromMe: lastSpokeMe(msgs.slice(-20)),
      preview: previewOf(toMessageLike(lastRealMessage(msgs.slice(-20))), kindFromJid(jid) === 'group'),
      markedUnread: Boolean(chat.markedUnread) || Number(chat.unreadCount) < 0,
      pic: httpsOrNull(chat.contact?.profilePicThumb?.img ?? chat.contact?.profilePicThumb?.eurl),
    };
  };

  let started = false;

  const handlers: Record<BridgeRequest['method'], (req: any) => Promise<unknown>> = {
    // Lets the isolated side catch up if it attached after 'ready' was posted.
    async ping() {
      return started;
    },
    async listChats() {
      const chats = await WPP().chat.list();
      const summaries: ChatSummary[] = chats.map(toSummary);
      // Same scope as WhatsApp's "Tudo" list: no archived chats, no status/newsletters.
      return summaries.filter((c) => c.kind !== 'other' && !c.archived);
    },
    async getActiveChat() {
      const chat = WPP().chat.getActiveChat?.();
      return chat ? toSummary(chat) : null;
    },
    // Same request WhatsApp makes when a chat row scrolls into view.
    async getProfilePic(req: { jid: string }) {
      return httpsOrNull(await WPP().contact.getProfilePictureUrl(req.jid, false));
    },
    async openChat(req: { jid: string }) {
      return WPP().chat.openChatBottom(req.jid);
    },
  };

  window.addEventListener(TO_PAGE, async (event) => {
    let req: BridgeRequest;
    try {
      req = JSON.parse((event as CustomEvent<string>).detail);
    } catch {
      return;
    }
    const handler = handlers[req.method];
    if (!handler) return;
    try {
      post({ type: 'response', id: req.id, ok: true, result: await handler(req) });
    } catch (err) {
      post({ type: 'response', id: req.id, ok: false, error: String(err) });
    }
  });

  let changedTimer: ReturnType<typeof setTimeout> | undefined;
  const chatsChanged = () => {
    clearTimeout(changedTimer);
    changedTimer = setTimeout(() => post({ type: 'chatsChanged' }), 500);
  };

  const start = () => {
    const wpp = WPP();
    wpp.on('chat.new_message', (msg: any) => {
      const jid: string | undefined = msg?.id?.remote?._serialized ?? msg?.id?.remote;
      if (jid) {
        post({
          type: 'message',
          message: { jid: String(jid), at: (Number(msg.t) || Date.now() / 1000) * 1000, fromMe: Boolean(msg.id.fromMe) },
        });
      }
      chatsChanged();
    });
    wpp.on('chat.new_chat', chatsChanged);
    wpp.on('chat.active_chat', (chat: any) => {
      try {
        post({ type: 'activeChat', chat: chat ? toSummary(chat) : null });
      } catch (err) {
        console.warn('[WhatsApp CRM] active_chat', err);
      }
    });
    wpp.on('chat.unread_count_changed', chatsChanged);
    started = true;
    stage(`pronto ${wpp.version ?? ''}`.trim());
    console.info('[WhatsApp CRM] wa-js pronto');
    post({ type: 'ready' });
  };

  // wa-js is injected just before this script; wait for it to hook into WhatsApp.
  const waitForWpp = (tries = 0) => {
    const wpp = WPP();
    if (wpp && tries === 0) stage(`aguardando ${wpp.version ?? ''}`.trim());
    if (!wpp && tries === 50) stage('wa-js ausente');
    if (wpp?.isFullReady) return start();
    if (wpp?.loader?.onFullReady) return wpp.loader.onFullReady(start);
    if (tries > 600) {
      console.warn('[WhatsApp CRM] wa-js não carregou');
      stage(wpp ? `sem resposta ${wpp.version ?? ''}`.trim() : 'wa-js ausente');
      return post({ type: 'error', message: 'wa-js não carregou' });
    }
    setTimeout(() => waitForWpp(tries + 1), 100);
  };
  waitForWpp();
});
