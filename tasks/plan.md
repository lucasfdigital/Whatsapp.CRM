# Plano — Extensão "WhatsApp CRM" (Vendas + CS)

## Decisões tomadas (27/10/2026)
- **Cada pessoa usa o próprio número** de WhatsApp.
- **Dados salvos dentro da extensão** (sem backend, sem login). Cada pessoa tem o seu CRM local.
- **Kanban = só pipeline** (card = grupo/cliente, colunas = etapas). Tarefas ficam em lista com checks dentro do grupo.
- **Notificações só dentro do WhatsApp/Chrome** (sino + popup do Chrome). Sem e-mail/Slack.

## Objetivo
Extensão Chrome que roda dentro do WhatsApp Web e vira um CRM pessoal para cada vendedor/CS:
- Classificar contatos e grupos (Lead, Cliente, Parceiro…) com tags e notas.
- **Marcar grupo como Cliente → aba "Clientes" separada** acima da lista de conversas.
- **Kanban de pipeline** em tela cheia: colunas editáveis (ex.: Onboarding → Ativo → Em risco → Renovação → Churn), arrastar grupo entre etapas.
- **Tarefas com checks** por grupo (título, prazo, checklist).
- **Atas de reunião** por grupo; "próximos passos" viram tarefa com 1 clique.
- **Follow-ups recorrentes**: diário, semanal, mensal ou personalizado.
- **Central de notificações** (sino com contador): follow-ups de hoje, atrasados, tarefas vencendo, clientes sem resposta. Ações: Abrir conversa · Feito · Adiar.

## Ferramentas (stack)

| Camada | Ferramenta | Por quê |
|---|---|---|
| Framework da extensão | **WXT** (Manifest V3) | Hot reload, gera manifest, organiza content script / background |
| UI | **React + TypeScript + Tailwind + shadcn/ui** em **Shadow DOM** | CSS do WhatsApp não briga com o nosso |
| Lista das abas | **@tanstack/react-virtual** | Lista própria rápida com milhares de chats (Conversas/Grupos/Clientes) |
| Kanban | **dnd-kit** | Drag & drop leve, funciona em Shadow DOM |
| Atas/notas | **TipTap** | Rich text com checkboxes; salva JSON |
| Recorrência | **rrule** (padrão iCalendar) + **date-fns-tz** | Diário/semanal/mensal/personalizado num formato só; fuso `America/Sao_Paulo` |
| Leitura do WhatsApp | **@wppconnect/wa-js** empacotado (versão fixa) | Lê chats, grupos, participantes, horário e direção da última msg pelo store interno |
| Fallback DOM | `MutationObserver` + arquivo único de seletores | Badges/abas na lista; conserto rápido quando WhatsApp mudar |
| Armazenamento | **`chrome.storage.local` + permissão `unlimitedStorage`** atrás de uma camada `repo` | Fica na origem da extensão (não do WhatsApp): sobrevive a logout do WhatsApp e limpeza de cache do site |
| Validação de dados | **zod** + versão de schema com migração | Atualizar a extensão sem corromper dado salvo |
| Backup | Exportar/Importar **JSON** + backup automático semanal (`chrome.downloads`) | Única proteção contra perder tudo (troca de PC, desinstalar) |
| Agendador | **`chrome.alarms`** no background (service worker) | Dispara follow-up enquanto o Chrome estiver aberto, mesmo com a aba do WhatsApp fechada |
| Notificação | Sino na UI + **`chrome.notifications`** + badge no ícone (`chrome.action.setBadgeText`) | Tudo dentro do Chrome |
| Testes | **Vitest** + **Playwright** (extensão unpacked) | Unit (recorrência, repo) + e2e contra página fake |
| Distribuição | Web Store privada/não listada ou instalação forçada via Google Workspace Admin | Só o time instala |

Fora do stack (decisão): Supabase, login, servidor, e-mail/Slack.

## Arquitetura de execução
- **MAIN world** (página do WhatsApp): só wa-js. Lê dados e envia via `CustomEvent`/`postMessage`. Não acessa storage da extensão.
- **Content script (isolated)**: UI React, leitura/escrita no `repo` (`chrome.storage.local`), escuta `chrome.storage.onChanged` para atualizar a tela.
- **Background**: `chrome.alarms`, `chrome.notifications`, badge, backup automático.
- MV3 proíbe código remoto → wa-js empacotado no build.

## Consequências de "salvo na extensão" (aceitas, mas o time precisa saber)
1. **Ninguém vê os clientes do colega.** Gestor não tem visão do time; se um vendedor sai, os clientes dele somem com o navegador dele. Mitigação: Exportar JSON; formato de dados pronto para, se um dia quiser, plugar um backend sem reescrever a UI (camada `repo`).
2. **Trocar de computador / desinstalar / perfil novo do Chrome = perde tudo** sem backup. Mitigação: backup automático semanal + aviso "último backup há X dias".
3. **Notificação só com Chrome aberto.** Computador desligado na hora → ao abrir, o follow-up aparece em "Atrasados" e dispara popup.
4. Combina bem com "cada um usa o próprio número": cada pessoa acompanha os grupos em que está.

## Riscos
1. **Ban do WhatsApp**: extensão só **lê e anota**. Sem disparo em massa, sem auto-resposta, sem envio automático. Follow-up = lembrete para a pessoa.
2. **WhatsApp muda DOM/store**: wa-js + seletores isolados + teste de fumaça.
3. **LGPD**: guarda só metadados (JID, nome, horário/direção da última msg) e o que a pessoa escreve. Não copia conteúdo das conversas.
4. **Recorrência + fuso**: dia 31, fevereiro, horário de verão → testes dedicados.
5. **JID como chave**: `55119...@c.us` contato, `1203...@g.us` grupo. Nome muda, JID não.

## Modelo de dados (chaves no storage, cada uma um mapa por id)
- `meta { schemaVersion, lastBackupAt }`
- `chats { [wa_jid]: { kind, displayName, status, stageId, position, tags[], lastInboundAt, lastOutboundAt, createdAt } }`
- `stages { [id]: { name, order, color } }` — colunas do pipeline
- `tasks { [id]: { jid, title, done, dueAt, checklist: [{id, text, done}], meetingId? } }`
- `meetings { [id]: { jid, heldAt, title, attendees[], bodyJson } }`
- `notes { [id]: { jid, body, createdAt } }`
- `followups { [id]: { jid, title, note, rrule, timezone, startAt, nextDueAt, active } }`
  - Presets → RRULE: diário `FREQ=DAILY` · semanal `FREQ=WEEKLY;BYDAY=MO` · mensal `FREQ=MONTHLY;BYMONTHDAY=1` · personalizado = construtor (a cada N dias/semanas/meses, dias da semana, termina após N vezes ou data).
- `occurrences { [id]: { followupId, dueAt, status: pending|done|snoozed|skipped, doneAt, snoozeUntil } }`
- `settings { noReplyHours, notifyPopup, backupWeekly }`

## Fluxo de follow-up + notificação
1. No grupo → "Agendar follow-up" → preset ou personalizado → horário. Preview "próximas 5 datas".
2. Salva `followups`, calcula `nextDueAt`, registra `chrome.alarms` para o próximo vencimento.
3. Alarme dispara (ou Chrome abre e vê vencidos) → cria `occurrence` pendente → popup Chrome + badge no ícone + contador no sino → agenda próximo pela RRULE.
4. **Sino**: seções **Hoje** / **Atrasados** / **Próximos 7 dias**. Itens: follow-ups, tarefas com prazo, clientes sem resposta há mais de `noReplyHours`.
5. Ações: **Abrir conversa** (wa-js abre o chat) · **Feito** · **Adiar** (1h / amanhã / escolher data).

## Grafo de dependências
```
Scaffold WXT ─► UI Shadow DOM ─► wa-js (MAIN) + ponte ─► repo (storage + zod + migração)
                                                              │
                                                              ▼
                                  F1  Marcar Cliente + aba "Clientes"
                                                              ▼
                                  F2  Painel do grupo: tarefas + checks + notas
                          ┌───────────────────┼────────────────────┐
                          ▼                   ▼                    ▼
                 F3 Kanban pipeline     F4 Atas reunião     F5 Follow-ups recorrentes
                          └───────────────────┼────────────────────┘
                                              ▼
                                  F6  Central de notificações + alarms
                                              ▼
                                  F7  Backup + testes e2e + distribuição
```
F3, F4, F5 independentes → paralelizáveis.

## Fases e checkpoints

### Fase 0 — Fundação
- T1 Scaffold WXT + React + TS + Tailwind; botão "CRM" no WhatsApp Web.
- T2 wa-js no MAIN world + ponte; listar chats (JID, nome, tipo, horário/direção da última msg); abrir chat por JID.
- T3 Camada `repo`: CRUD sobre `chrome.storage.local`, schemas zod, `schemaVersion` + migração, evento de mudança.
- **Checkpoint A**: WhatsApp intacto; lista bate com a real; dado sobrevive a recarregar e a sair/entrar no WhatsApp.

### Fase 1 — Grupo vira Cliente
- T4 Botão "Marcar como Cliente" no cabeçalho da conversa (e desmarcar).
- T5 **Barra de abas** injetada logo abaixo da busca, acima dos chips nativos (Tudo / listas do usuário ficam intactos):
  `Conversas (n)` · `Grupos (n)` · `Total (n)` · `Clientes (n)`
  - **Conversas** = só individuais (`@c.us`) · **Grupos** = só grupos (`@g.us`) · **Total** = tudo (lista nativa do WhatsApp, sem mexer) · **Clientes** = marcados como cliente.
  - Contador em cada aba (Clientes mostra também quantos têm follow-up hoje).
  - Lista nativa do WhatsApp é **virtualizada**: esconder linhas com CSS quebra a rolagem. Então Conversas/Grupos/Clientes renderizam **lista própria** (dados do wa-js, `@tanstack/react-virtual`) por cima do painel de conversas: foto, nome, última msg, horário, não lidas, badge de status. Clique abre o chat via wa-js. "Total" esconde nossa lista e mostra a nativa.
  - Busca nativa continua funcionando; nossa lista filtra pelo mesmo texto digitado.
  - Aba escolhida lembrada entre recargas.
- **Checkpoint B**: contagens de Conversas + Grupos = Total; marcar 3 grupos como cliente, recarregar, continuam na aba Clientes; clicar em item abre o chat certo.

### Fase 2 — Painel do grupo
- T6 Painel lateral: status, tags, notas rápidas.
- T7 Tarefas com prazo + checklist + progresso.

### Fase 3 — Kanban de pipeline (paralelo)
- T8 Overlay tela cheia; colunas editáveis (criar, renomear, cor, reordenar).
- T9 Card = grupo (nome, nº tarefas abertas, próximo follow-up, dias sem resposta); drag & drop persiste etapa + posição; clique abre conversa.

### Fase 4 — Atas (paralelo)
- T10 Nova ata TipTap (data, participantes do grupo via wa-js, pauta, decisões).
- T11 Próximo passo → tarefa.

### Fase 5 — Follow-ups recorrentes (paralelo)
- T12 Formulário: presets diário/semanal/mensal + construtor personalizado → RRULE; preview próximas 5 datas.
- T13 Lista no grupo: editar, pausar, excluir; histórico de ocorrências.
- T14 Testes unitários de recorrência (dia 31, fevereiro, fuso, fim após N, adiar).
- **Checkpoint C**: 2–3 pessoas de Vendas/CS usam 1 dia real.

### Fase 6 — Central de notificações
- T15 Background: `chrome.alarms` por próximo vencimento + varredura ao iniciar o Chrome (pega atrasados).
- T16 Sino com contador: Hoje / Atrasados / Próximos 7 dias; Abrir / Feito / Adiar.
- T17 Popup `chrome.notifications` + badge no ícone; clique no popup foca aba do WhatsApp e abre o chat.
- T18 Regra "sem resposta há X horas" (via `lastInboundAt > lastOutboundAt`) entra no sino.
- **Checkpoint D**: follow-up agendado para daqui 2 min dispara popup e aparece no sino; com Chrome fechado na hora, aparece em Atrasados ao abrir.

### Fase 7 — Rollout
- T19 Exportar/Importar JSON + backup automático semanal + aviso de backup antigo.
- T20 Teste de fumaça Playwright (seletores + fluxo marcar cliente → follow-up → notificação).
- T21 Publicação privada + guia de instalação para o time.

## Perguntas em aberto (não bloqueiam o início)
1. Etapas padrão do pipeline? (sugestão: Onboarding, Ativo, Em risco, Renovação, Churn)
2. "Sem resposta" padrão: 24h?
3. Follow-up pula fim de semana/feriado automaticamente?
