# TODO — WhatsApp CRM

## Fase 0 — Fundação
- [x] T1 (implementado; falta teste manual no WhatsApp real) Scaffold WXT + React + TS + Tailwind; botão "CRM" no WhatsApp Web
  - Aceite: extensão unpacked carrega; console limpo; WhatsApp funciona normal
- [x] T2 (implementado; falta teste manual no WhatsApp real) wa-js (MAIN) + ponte; listar chats (JID, nome, tipo, última msg); abrir chat por JID
  - Aceite: amostra de 10 chats bate com a real
- [x] T3 (implementado; falta teste manual no WhatsApp real) Camada repo (chrome.storage.local + zod + migração)
  - Aceite: dado sobrevive a recarregar e a logout/login do WhatsApp
- [ ] **Checkpoint A**

## Fase 1 — Grupo vira Cliente
- [ ] T4 Marcar/desmarcar Cliente no cabeçalho da conversa
- [x] T5 (implementado; validado em página simulada, falta WhatsApp real) Barra de abas abaixo da busca: Conversas · Grupos · Total · Clientes (com contadores)
  - Aceite: Conversas + Grupos = Total; Total = lista nativa intacta; chips nativos (Tudo, listas) continuam funcionando; clique abre chat certo; aba lembrada
- [ ] **Checkpoint B**

- [x] Extra: chave liga/desliga no popup da extensão

## Fase 2 — Painel do grupo
- [x] T6 Status, tags, notas rápidas (painel do contato estilo Chatwoot)
- [ ] T7 Tarefas com prazo + checklist + progresso

## Fase 3 — Kanban de pipeline (paralelo)
- [x] T8 Overlay do Kanban (colunas fixas por enquanto; edição de colunas pendente)
- [x] T9 Cards de grupo + drag & drop persistente

## Fase 4 — Atas (paralelo)
- [ ] T10 Ata TipTap com participantes
- [ ] T11 Próximo passo → tarefa

## Fase 5 — Follow-ups recorrentes (paralelo)
- [ ] T12 Presets dia/semana/mês + personalizado → RRULE; preview 5 datas
- [ ] T13 Lista/editar/pausar + histórico
- [ ] T14 Testes de recorrência
- [ ] **Checkpoint C**: 1 dia de uso real

## Fase 6 — Central de notificações
- [ ] T15 chrome.alarms + varredura de atrasados ao iniciar
- [ ] T16 Sino: Hoje / Atrasados / Próximos; Abrir / Feito / Adiar
- [ ] T17 Popup Chrome + badge; clique abre o chat
- [ ] T18 "Sem resposta há X horas" no sino
- [ ] **Checkpoint D**

## Fase 7 — Rollout
- [ ] T19 Exportar/Importar JSON + backup semanal
- [ ] T20 Teste de fumaça Playwright
- [ ] T21 Publicação privada + guia
