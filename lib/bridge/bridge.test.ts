import { describe, expect, it } from 'vitest';
import { createBridgeClient } from './client';
import { FROM_PAGE, TO_PAGE, kindFromJid, lastRealMessage, lastSpokeMe, previewOf, type ChatSummary } from './protocol';

const sample: ChatSummary = {
  jid: '5511999999999@c.us',
  kind: 'contact',
  name: 'Maria',
  lastAt: 1_700_000_000_000,
  unread: 2,
  archived: false,
  lastFromMe: false,
};

/** Fake page side: answers requests the way wa-bridge does. */
function fakePage(target: EventTarget, respond: (req: any) => unknown) {
  target.addEventListener(TO_PAGE, (e) => {
    const req = JSON.parse((e as CustomEvent<string>).detail);
    const reply = { type: 'response', id: req.id, ok: true, result: respond(req) };
    target.dispatchEvent(new CustomEvent(FROM_PAGE, { detail: JSON.stringify(reply) }));
  });
}

describe('lastSpokeMe', () => {
  it('skips group notices and other system entries', () => {
    const msgs = [{ type: 'chat', id: { fromMe: true } }, { type: 'gp2', id: { fromMe: false } }, { type: 'e2e_notification' }];
    expect(lastSpokeMe(msgs)).toBe(true);
  });

  it('skips entries flagged as notifications', () => {
    expect(lastSpokeMe([{ type: 'chat', id: { fromMe: false } }, { type: 'chat', isNotification: true, id: { fromMe: true } }])).toBe(false);
  });

  it('is null without real messages', () => {
    expect(lastSpokeMe([])).toBeNull();
    expect(lastSpokeMe([{ type: 'call_log', id: { fromMe: false } }])).toBeNull();
  });
});

describe('kindFromJid', () => {
  it('classifies contacts, groups and others', () => {
    expect(kindFromJid('5511@c.us')).toBe('contact');
    expect(kindFromJid('123@lid')).toBe('contact');
    expect(kindFromJid('1203@g.us')).toBe('group');
    expect(kindFromJid('status@broadcast')).toBe('other');
    expect(kindFromJid('123@newsletter')).toBe('other');
  });
});

describe('bridge client', () => {
  it('round-trips listChats and validates the payload', async () => {
    const target = new EventTarget();
    fakePage(target, () => [sample]);
    const client = createBridgeClient(target);
    expect(await client.listChats()).toEqual([sample]);
  });

  it('drops malformed chats from the page and rejects a non-list', async () => {
    const target = new EventTarget();
    fakePage(target, () => [{ jid: '' }]);
    await expect(createBridgeClient(target).listChats()).rejects.toThrow(/formato/);
    const empty = new EventTarget();
    fakePage(empty, () => []);
    await expect(createBridgeClient(empty).listChats()).resolves.toEqual([]);
    const other = new EventTarget();
    fakePage(other, () => ({ jid: 'x' }));
    await expect(createBridgeClient(other).listChats()).rejects.toThrow();
  });

  it('times out when the page never answers', async () => {
    const client = createBridgeClient(new EventTarget(), 20);
    await expect(client.openChat('x@c.us')).rejects.toThrow(/timeout/);
  });

  it('emits ready and message events, ignores garbage', () => {
    const target = new EventTarget();
    const client = createBridgeClient(target);
    const seen: unknown[] = [];
    client.on('message', (m) => seen.push(m));
    client.on('ready', () => seen.push('ready'));

    const send = (detail: string) => target.dispatchEvent(new CustomEvent(FROM_PAGE, { detail }));
    send('not json');
    send(JSON.stringify({ type: 'message', message: { jid: 'a@c.us' } }));
    send(JSON.stringify({ type: 'ready' }));
    send(JSON.stringify({ type: 'message', message: { jid: 'a@c.us', at: 1, fromMe: true } }));

    expect(client.isReady).toBe(true);
    expect(seen).toEqual(['ready', { jid: 'a@c.us', at: 1, fromMe: true }]);
  });
});

describe('previewOf', () => {
  it('shows text, with "Você:" for my messages', () => {
    expect(previewOf({ type: 'chat', body: 'Oi\ntudo bem?', id: { fromMe: false } }, false)).toBe('Oi tudo bem?');
    expect(previewOf({ type: 'chat', body: 'ok', id: { fromMe: true } }, false)).toBe('Você: ok');
  });
  it('labels media and prefixes the sender in groups', () => {
    expect(previewOf({ type: 'image', id: { fromMe: false }, senderName: 'Ana' }, true)).toBe('Ana: 📷 Foto');
    expect(previewOf({ type: 'image', caption: 'nota', id: { fromMe: false } }, false)).toBe('📷 nota');
    expect(previewOf({ type: 'ptt', id: { fromMe: true } }, true)).toBe('Você: 🎤 Áudio');
    expect(previewOf({ type: 'chat', body: 'oi', id: { fromMe: false }, senderName: '+1 511 4359066826' }, true)).toBe('oi');
  });
  it('cuts long text and returns null when there is nothing to show', () => {
    expect(previewOf({ type: 'chat', body: 'x'.repeat(300), id: {} }, false)?.length).toBe(140);
    expect(previewOf(null, false)).toBeNull();
    expect(previewOf({ type: 'unknown_type', id: {} }, false)).toBeNull();
  });
});

describe('lastRealMessage', () => {
  it('skips system entries', () => {
    const msgs = [{ type: 'chat', body: 'a' }, { type: 'gp2' }, { type: 'e2e_notification' }];
    expect(lastRealMessage(msgs)?.body).toBe('a');
  });
});
