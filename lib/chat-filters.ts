import type { ChatSummary } from './bridge/protocol';

/**
 * "Aguardando": the user still has to see it — unread messages, or marked as
 * unread to come back to it. Reading a chat (individual or group) clears it.
 */
export function isAwaiting(chat: Pick<ChatSummary, 'unread' | 'markedUnread'>): boolean {
  return chat.unread > 0 || chat.markedUnread === true;
}
