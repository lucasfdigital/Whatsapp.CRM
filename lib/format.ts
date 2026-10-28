/** WhatsApp-style timestamp: "10:14" today, "Ontem", weekday this week, else dd/mm/aaaa. */
export function formatChatTime(at: number | null, now: Date = new Date()): string {
  if (at == null) return '';
  const d = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (at >= startOfToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (at >= startOfToday - day) return 'Ontem';
  if (at >= startOfToday - 6 * day) {
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return d.toLocaleDateString('pt-BR');
}

/** Up to two initials for the avatar placeholder; '?' when the name has no letters (a phone number, emoji only). */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  return ((words[0]![0] ?? '') + (words.length > 1 ? (words[words.length - 1]![0] ?? '') : '')).toUpperCase();
}

/** Accent/case-insensitive "contains". */
export function matchesQuery(name: string, query: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return norm(name).includes(norm(query.trim()));
}

/**
 * Phone number shown for a chat. Only `@c.us` ids carry the number; `@lid`
 * ids are WhatsApp's private ids (not a phone), so they show nothing.
 */
export function phoneOf(jid: string): string | null {
  const [user, server] = jid.split('@');
  return server === 'c.us' && /^\d+$/.test(user ?? '') ? `+${user}` : null;
}
