/**
 * Contract between the MAIN world script (wa-bridge, talks to WhatsApp via wa-js)
 * and the isolated content script (UI + storage). Messages travel as CustomEvents
 * on `window`. Kept dependency-free: wa-bridge imports it and must stay small.
 * Runtime validation of page data lives in ./schemas (isolated side only).
 */

export const TO_PAGE = 'wacrm:to-page';
export const FROM_PAGE = 'wacrm:from-page';

export type ChatKind = 'contact' | 'group' | 'other';

export interface ChatSummary {
  jid: string;
  kind: ChatKind;
  name: string;
  /** Last activity, epoch ms. */
  lastAt: number | null;
  unread: number;
  archived: boolean;
  /** Direction of the last message, when WhatsApp has it loaded. */
  lastFromMe: boolean | null;
  /** User marked the chat as unread to come back to it (no unread count). */
  markedUnread?: boolean;
  pinned?: boolean;
  muted?: boolean;
  /** Profile photo thumbnail WhatsApp already has loaded (https URL), if any. */
  pic?: string | null;
  /**
   * Last message as WhatsApp's list shows it ("Você: ok", "Ana: 📷 Foto").
   * Display only: never persisted (LGPD — no message content in storage).
   */
  preview?: string | null;
}

export interface MessageSeen {
  jid: string;
  at: number;
  fromMe: boolean;
}

/** Requests: isolated → page. */
export type BridgeRequest =
  | { id: string; method: 'ping' }
  | { id: string; method: 'listChats' }
  | { id: string; method: 'getActiveChat' }
  | { id: string; method: 'openChat'; jid: string }
  | { id: string; method: 'getProfilePic'; jid: string }
  | { id: string; method: 'listLists' }
  | { id: string; method: 'chatAction'; jid: string; action: ChatAction };

/** WhatsApp's own per-chat menu actions, run when the user picks them in our card menu. */
export type ChatAction =
  | { type: 'archive'; on: boolean }
  /** seconds: mute for that long; 'always' forever; null unmutes. */
  | { type: 'mute'; seconds: number | 'always' | null }
  | { type: 'pin'; on: boolean }
  | { type: 'unread'; on: boolean }
  | { type: 'addToList'; listId: string }
  | { type: 'clear' }
  | { type: 'delete' }
  | { type: 'leave' };

/** A WhatsApp chat list ("Favoritos", custom lists). */
export interface ChatListInfo {
  id: string;
  name: string;
}

/** Messages: page → isolated. */
export type PageMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'chatsChanged' }
  | { type: 'message'; message: MessageSeen }
  | { type: 'activeChat'; chat: ChatSummary | null }
  | { type: 'response'; id: string; ok: boolean; result?: unknown; error?: string };

export function kindFromJid(jid: string): ChatKind {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@c.us') || jid.endsWith('@lid')) return 'contact';
  return 'other';
}

/** Minimal shape of a WhatsApp message model, as far as the chat list needs. */
export interface MessageLike {
  type?: string;
  isNotification?: boolean;
  id?: { fromMe?: boolean };
  body?: string;
  caption?: string;
  /** Group messages: who sent it. */
  senderName?: string | null;
}

/** System entries: group notices, encryption notices, call logs, deleted messages. */
const SYSTEM_TYPES = new Set([
  'gp2',
  'notification',
  'notification_template',
  'e2e_notification',
  'call_log',
  'revoked',
  'protocol',
  'ciphertext',
  'broadcast_notification',
]);

/** Newest real message (system entries skipped), if any is loaded. */
export function lastRealMessage<T extends MessageLike>(messages: readonly T[]): T | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.isNotification || (msg.type && SYSTEM_TYPES.has(msg.type))) continue;
    return msg;
  }
  return null;
}

/**
 * Whether the last real message (newest first, system entries skipped) is
 * mine. null when there is none among the loaded messages.
 */
export function lastSpokeMe(messages: readonly MessageLike[]): boolean | null {
  const msg = lastRealMessage(messages);
  return typeof msg?.id?.fromMe === 'boolean' ? msg.id.fromMe : null;
}

const MEDIA_LABELS: Record<string, string> = {
  image: '📷 Foto',
  video: '🎥 Vídeo',
  ptt: '🎤 Áudio',
  audio: '🎵 Áudio',
  document: '📄 Documento',
  sticker: 'Figurinha',
  location: '📍 Localização',
  vcard: '👤 Contato',
  multi_vcard: '👤 Contatos',
  poll_creation: '📊 Enquete',
};

/** One-line preview of a message, like WhatsApp's chat list ("Você: …", "Ana: 📷 Foto"). */
export function previewOf(msg: MessageLike | null, isGroup: boolean, max = 140): string | null {
  if (!msg) return null;
  const caption = msg.type === 'chat' ? msg.body : msg.caption;
  const label = MEDIA_LABELS[msg.type ?? ''];
  const text =
    (caption?.trim() ? (label && msg.type !== 'chat' ? `${label.split(' ')[0]} ${caption}` : caption) : label) ?? '';
  if (!text) return null;
  const sender = msg.senderName?.trim();
  // A bare number may be a private @lid id, not a phone: show just the text.
  const who = msg.id?.fromMe ? 'Você' : isGroup && sender && !/^[\d\s+()-]+$/.test(sender) ? sender : '';
  const line = (who ? `${who}: ${text}` : text).replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
