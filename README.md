# WhatsApp CRM (extensão Chrome)

CRM pessoal dentro do WhatsApp Web. Plano completo: [tasks/plan.md](tasks/plan.md) · tarefas: [tasks/todo.md](tasks/todo.md).

## Rodar

```bash
npm install        # também copia o wa-js para public/
npm run build      # gera build/chrome-mv3
npm test           # testes unitários
npm run dev        # Chrome com hot reload
```

## Instalar para testar
1. `npm run build`
2. Chrome → `chrome://extensions` → ligar **Modo do desenvolvedor**
3. **Carregar sem compactação** → escolher a pasta `build/chrome-mv3`
4. Abrir https://web.whatsapp.com

## Visual
BoardUI (React + Tailwind v4), **tema escuro com acento azul**. Regras em `AGENTS.md` e na skill `.claude/skills/boardui`: só tokens semânticos (`text-text-primary`, `bg-background-*`, `accent-*`), tipografia composta (`text-body-medium`…), `cx()` para classes, ícones `@remixicon/react`. Componentes ficam em `components/base/` (adicionar com `BOARDUI_TELEMETRY_DISABLED=1 npx boardui@latest add <nome>`).

Por enquanto **sem** componentes com popover (select, dropdown, tooltip, date-picker): dentro do WhatsApp eles abrem fora da shadow root. Precisa de `UNSAFE_PortalProvider` apontando para dentro da shadow root antes de usar.

Imagens de demonstração do BoardUI ficam em `boardui-assets/` de propósito (fora de `public/`), senão entram no pacote da extensão (+7,7 MB). Se `boardui add` recriar algo em `public/templates`, `public/ai-chat` ou `public/brand`, mover para lá.

### WhatsApp nativo com visual BoardUI
- `lib/wa-theme.ts`: sobrescreve os tokens semânticos do WhatsApp (`--WDS-surface-default`, `--WDS-accent`, bolhas, divisórias…) com os tokens do BoardUI, lidos em tempo real da shadow root. Fonte Inter.
- `lib/wa-icons.ts`: troca ícones nativos (`[data-icon="…"]`) pelo Remix Icon via máscara CSS. Nomes desconhecidos ficam nativos; para cobrir mais, adicionar no `ICON_MAP`.
- Tudo some ao **Desligar** (o `<style>` é removido).

## Teste manual
- [ ] Recarregar extensão (↻ em `chrome://extensions`) e a aba do WhatsApp
- [ ] Os filtros nativos (Tudo, Não lidas, listas próprias) somem; ficam só a busca e as abas BoardUI (sublinhadas) **Aguardando · Individual · Grupos** com números; **Desligar** traz os filtros de volta
- [ ] **Aguardando**: conversas e grupos com mensagens não lidas (ou marcados como não lidos); leu, sai da aba
- [ ] Fotos de contatos e grupos aparecem na lista, nos cards do Pipeline e no painel CRM (sem foto → iniciais)
- [ ] Cada conversa é um card com a última mensagem ("Você: …", "Ana: 📷 Foto"); a prévia fica só na memória, nunca no storage
- [ ] Sem linha atravessando a conversa nem divisor dentro do card da lista; cantos dos cards sem mancha
- [ ] Painel CRM: número só para contatos `@c.us` (ids `@lid` mostram "Conversa")
- [ ] **Individual** só conversas individuais; **Grupos** só grupos
- [ ] Clicar num item abre a conversa certa
- [ ] ☆ ao lado de um item → vira ★; **Clientes** (seção CRM da sidebar) abre a aba Clientes; recarregar → continua lá
- [ ] Digitar na busca do WhatsApp mostra os resultados do próprio WhatsApp; apagar a busca volta para a aba
- [ ] Sidebar BoardUI cobre a barra lateral nativa: altura toda, Configurações embaixo, itens nativos funcionam, **Arquivadas** abre as arquivadas, seção **CRM** (Pipeline, Clientes), botão de recolher
- [ ] Sidebar em seções **Conversas · CRM · Atualizações · Negócio** e rodapé **Conta**; cada item do menu ⋮ (Respostas rápidas, Catálogo, Cobranças, Mensagens favoritas, Novo grupo…) abre a função nativa (o menu ⋮ abre e fecha sozinho; se o item não existir, o menu fica aberto). **Selecionar conversas** mostra a lista do WhatsApp com "Voltar às abas". **Desconectar** fica no fim e deve pedir confirmação do WhatsApp
- [ ] Nenhuma janela do WhatsApp fica por baixo/por cima da sidebar; se algo sobrepor, o rodapé da sidebar mostra "Sobreposto por…" ou "WhatsApp não deslocou"
- [ ] Lista de conversas e conversa aberta aparecem como cards arredondados (mesma cor da sidebar), lista com ~400px
- [ ] **Pipeline** (sidebar) abre o Kanban; arrastar card entre etapas; clicar no card abre a conversa; Esc fecha
- [ ] Conversa aberta → botão **CRM** no cabeçalho → card à direita: marcar cliente, etapa, tags (Enter), notas
- [ ] Digitar numa nota/tag não dispara atalhos do WhatsApp nem joga o foco para a caixa de mensagem
- [ ] Cores do WhatsApp em tons BoardUI (fundo grafite, bolhas enviadas azuis, destaques azuis), fonte Inter
- [ ] Clicar no ícone da extensão → chave **Desligado** → sidebar, abas e cards somem na hora e a barra lateral nativa volta; recarregar o WhatsApp → nenhum script da extensão
- [ ] **Ligado** de novo → tudo volta sem precisar recarregar

## Arquitetura
| Peça | Onde roda | Faz |
|---|---|---|
| `public/wppconnect-wa.js` (wa-js 4.7.2 fixo) | página do WhatsApp (MAIN) | expõe `window.WPP`; só é injetado com a extensão **Ligada** |
| `entrypoints/background.ts` + `lib/main-world.ts` | service worker | registra/remove wa-js + bridge conforme a chave; ao religar injeta nas abas abertas |
| `entrypoints/wa-bridge.ts` | página do WhatsApp (MAIN) | só leitura: lista chats, avisa novas mensagens (horário + direção), abre chat. Nunca envia mensagem |
| `lib/bridge/*` | content script (isolado) | cliente tipado da ponte; valida com zod tudo que vem da página |
| `lib/repo/*` | content script (isolado) | dados em `chrome.storage.local`, schema versionado + migrações |
| `entrypoints/content/*` | content script (isolado) | abas + lista própria (React + Tailwind em Shadow DOM) inseridas antes de `#pane-side` |
| `entrypoints/popup/*` | popup da extensão | chave liga/desliga |
| `lib/wa-dom.ts` | content script | **todos** os seletores do WhatsApp num lugar só |

Dados salvos: só metadados dos chats que você marcou (JID, nome, status, horário/direção da última mensagem). Conteúdo de conversa não é salvo.

## Diagnóstico
Se as abas não aparecerem, cole no console (linha de comando embaixo, não no Filter) e envie o resultado:
```js
({crm: document.documentElement.dataset.wacrm, chats: document.documentElement.dataset.wacrmChats, pane: !!document.querySelector('#pane-side'), ids: [...document.querySelectorAll('[id]')].map(e => e.id).filter(i => !/^\d/.test(i)).slice(0, 30)})
```
- `crm` vazio → content script não rodou · `pane: false` → seletor mudou (corrigir em `lib/wa-dom.ts`) · `chats: erro…` → wa-js incompatível com esta versão do WhatsApp
