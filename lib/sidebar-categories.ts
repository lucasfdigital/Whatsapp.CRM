/**
 * Groups WhatsApp's native entries (rail buttons, header buttons, ⋮ menu) into
 * sidebar sections. Labels are pt-BR or en; anything unknown lands in "Mais",
 * so new WhatsApp entries still show up.
 */
export interface Category<T> {
  id: 'conversas' | 'atualizacoes' | 'negocio' | 'conta' | 'mais';
  title: string;
  items: T[];
}

const RULES: Array<{ id: Category<unknown>['id']; title: string; match: RegExp }> = [
  {
    id: 'conversas',
    title: 'Conversas',
    match:
      /^(conversas|chats|arquivadas|archived|ligações|chamadas|calls|nova conversa|new chat|novo grupo|new group|mensagens favoritas|starred messages|selecionar conversas|select chats|listas|lists|marcar todas como lidas|mark all as read)$/i,
  },
  { id: 'atualizacoes', title: 'Atualizações', match: /^(status|canais|channels|comunidades|communities)$/i },
  {
    id: 'negocio',
    title: 'Negócio',
    match: /(ferramentas|tools|anunciar|advertise|meta ai|catálogo|catalog|etiquetas|labels|cobranças|payments|respostas rápidas|quick replies)/i,
  },
  { id: 'conta', title: 'Conta', match: /^(configurações|settings|perfil|profile|bloqueio do app|app lock|desconectar|log ?out)$/i },
];

export function categorize<T extends { label: string }>(items: readonly T[]): Category<T>[] {
  const sections: Category<T>[] = [...RULES.map(({ id, title }) => ({ id, title, items: [] as T[] })), { id: 'mais', title: 'Mais', items: [] }];
  for (const item of items) {
    const index = RULES.findIndex((rule) => rule.match.test(item.label.trim()));
    sections[index === -1 ? sections.length - 1 : index].items.push(item);
  }
  return sections.filter((section) => section.items.length > 0);
}
