import { describe, expect, it } from 'vitest';
import { categorize } from './sidebar-categories';

const labels = (sections: ReturnType<typeof categorize<{ label: string }>>) =>
  sections.map((s) => `${s.title}: ${s.items.map((i) => i.label).join(', ')}`);

describe('categorize', () => {
  it('groups the rail of a WhatsApp Business account (pt-BR)', () => {
    const items = ['Conversas', 'Ligações', 'Status', 'Canais', 'Comunidades', 'Ferramentas', 'Anunciar'].map((label) => ({ label }));
    expect(labels(categorize(items))).toEqual([
      'Conversas: Conversas, Ligações',
      'Atualizações: Status, Canais, Comunidades',
      'Negócio: Ferramentas, Anunciar',
    ]);
  });

  it('understands English labels and Meta AI', () => {
    const items = ['Chats', 'Calls', 'Channels', 'Meta AI'].map((label) => ({ label }));
    expect(labels(categorize(items))).toEqual(['Conversas: Chats, Calls', 'Atualizações: Channels', 'Negócio: Meta AI']);
  });

  it('sorts the ⋮ menu of a Business account into sections', () => {
    const items = [
      'Ferramentas comerciais', 'Novo grupo', 'Anunciar', 'Catálogo', 'Cobranças', 'Respostas rápidas',
      'Mensagens favoritas', 'Selecionar conversas', 'Listas', 'Marcar todas como lidas', 'Bloqueio do app', 'Desconectar',
    ].map((label) => ({ label }));
    expect(labels(categorize(items))).toEqual([
      'Conversas: Novo grupo, Mensagens favoritas, Selecionar conversas, Listas, Marcar todas como lidas',
      'Negócio: Ferramentas comerciais, Anunciar, Catálogo, Cobranças, Respostas rápidas',
      'Conta: Bloqueio do app, Desconectar',
    ]);
  });

  it('keeps unknown entries under "Mais" and drops empty sections', () => {
    expect(labels(categorize([{ label: 'Novidade X' }]))).toEqual(['Mais: Novidade X']);
  });
});
