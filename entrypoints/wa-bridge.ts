import {
  FROM_PAGE,
  TO_PAGE,
  kindFromJid,
  lastRealMessage,
  lastSpokeMe,
  previewOf,
  type BridgeRequest,
  type ChatAction,
  type ChatSummary,
  type PageMessage,
} from '@/lib/bridge/protocol';

/**
 * Runs in WhatsApp's MAIN world, right after wa-js (`window.WPP`). The background
 * registers both only while the extension is switched on (lib/main-world.ts), so
 * "Desligado" leaves WhatsApp without any injected code after a reload.
 * It lists chats, reports message direction/time, opens a chat and runs
 * WhatsApp's own per-chat menu actions when the user picks one in our menu.
 * It never sends messages and never sees extension storage.
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
      pinned: Boolean(chat.pin),
      // -1 = muted forever; otherwise an expiration in seconds.
      muted:
        Number(chat.muteExpiration ?? chat.mute?.expiration ?? 0) === -1 ||
        Number(chat.muteExpiration ?? chat.mute?.expiration ?? 0) * 1000 > Date.now(),
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
      const summaries: ChatSummary[] = chats.flatMap((chat: Parameters<typeof toSummary>[0]) => {
        try {
          return [toSummary(chat)];
        } catch {
          return [];
        }
      });
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
    async listLists() {
      const lists: Array<{ id: string; name: string }> = WPP().lists?.list?.() ?? [];
      return lists.map(({ id, name }) => ({ id: String(id), name: String(name ?? '') }));
    },
    // Only what WhatsApp's own chat menu offers, run on the user's click.
    async chatAction(req: { jid: string; action: ChatAction }) {
      const { chat, group, lists } = WPP();
      const { jid, action } = req;
      // Requests arrive as page events: accept only a chat id and a known action shape.
      if (typeof jid !== 'string' || !/@(c\.us|g\.us|lid)$/.test(jid) || typeof action?.type !== 'string') {
        throw new Error('Pedido inválido');
      }
      switch (action.type) {
        case 'archive':
          return void (await chat.archive(jid, action.on));
        case 'mute':
          if (action.seconds === null) return void (await chat.unmute(jid));
          if (action.seconds === 'always') {
            // WhatsApp's own "Sempre" is expiration -1, which wa-js' mute() rejects as negative.
            const model = await chat.find(jid);
            return void (await model.mute.mute({ expiration: -1, isAutoMuted: false, sendDevice: true }));
          }
          return void (await chat.mute(jid, { duration: action.seconds }));
        case 'pin':
          return void (await chat.pin(jid, action.on));
        case 'unread':
          return void (await (action.on ? chat.markIsUnread(jid) : chat.markIsRead(jid)));
        case 'addToList':
          if (!lists?.addChats) throw new Error('Listas indisponíveis nesta versão do WhatsApp');
          return void (await lists.addChats(action.listId, [jid]));
        case 'clear':
          return void (await chat.clear(jid, true));
        case 'delete':
          return void (await chat.delete(jid));
        case 'leave':
          if (kindFromJid(jid) !== 'group') throw new Error('Não é um grupo');
          return void (await group.leave(jid));
        default:
          throw new Error('Ação desconhecida');
      }
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
          message: {
            jid: String(jid),
            at: (Number(msg.t) || Date.now() / 1000) * 1000,
            fromMe: Boolean(msg.id.fromMe),
          },
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
