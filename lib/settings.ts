import { storage } from 'wxt/utils/storage';

/** Master switch from the toolbar popup. Off = WhatsApp untouched. */
export const enabledItem = storage.defineItem<boolean>('local:enabled', { fallback: true });

/** Chips: waiting / contact / group. 'cliente' is opened from the sidebar. */
export type TabId = 'waiting' | 'contact' | 'group' | 'cliente';
const TAB_IDS: readonly TabId[] = ['waiting', 'contact', 'group', 'cliente'];
/** Older versions stored other ids ('all'); anything unknown opens "Aguardando". */
export const toTabId = (value: unknown): TabId => (TAB_IDS.includes(value as TabId) ? (value as TabId) : 'waiting');
/** Last tab the user picked, restored on reload. */
export const activeTabItem = storage.defineItem<TabId>('local:activeTab', { fallback: 'waiting' });

/** Contact panel (right side of the open conversation) open/closed. */

