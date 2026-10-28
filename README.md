# WhatsApp CRM

Extensão do Chrome que transforma o WhatsApp Web num CRM leve para times de Vendas e CS, sem sair do WhatsApp. Feita pela [Astruz](https://astruz.dev/).

Não é um produto oficial do WhatsApp nem da Meta.

## O que faz

- **Abas de conversas:** Aguardando (não lidas ou marcadas como não lidas), Individual, Grupos e Clientes, cada uma com contador.
- **Clientes:** marque conversas ou grupos com a estrela; eles ganham uma aba própria.
- **Pipeline:** Kanban dos clientes por etapa (Onboarding, Ativo, Em risco, Renovação, Churn), com arrastar e soltar.
- **CRM da conversa:** etapa, tags e notas de cada cliente, a partir do botão **CRM** no cabeçalho da conversa.
- **Menu da conversa (⋮):** as ações nativas do WhatsApp em cada card (arquivar, silenciar, fixar, marcar como lida/não lida, listas, limpar, apagar ou sair do grupo). As destrutivas pedem confirmação.
- **Privacidade:** desfoca mensagens, prévias, mídia, campo de digitação, fotos e nomes até passar o mouse; desfoca a tela inteira quando o mouse sai da janela ou após 1 minuto sem uso.
- **Visual:** sidebar com as funções do WhatsApp organizadas por categoria e tema escuro com acento azul.

A chave no ícone da extensão liga e desliga tudo; desligada, o WhatsApp volta ao normal.

## Privacidade e segurança

- **Nunca envia mensagens** nem responde sozinha. Ações no WhatsApp só acontecem quando você clica.
- **Não salva conteúdo de conversa.** Prévias e fotos ficam só na memória da aba.
- Salva em `chrome.storage.local`, no seu navegador, apenas o que você marca: identificador do chat, nome, status de cliente, etapa, tags, notas e horário/direção da última mensagem.
- Sem servidor e sem login; os dados do CRM nunca saem do navegador.
- No máximo a cada 6 horas, a extensão consulta a última versão publicada neste repositório (`api.github.com`) para avisar quando há uma nova. A consulta não leva nenhum dado seu; o GitHub vê só o IP e o navegador, como em qualquer visita.
- Permissões: `storage`, `unlimitedStorage`, `scripting` e acesso só a `https://web.whatsapp.com/*`.

## Instalar (modo desenvolvedor)

Requer Node.js (versão LTS atual).

```bash
npm install
npm run build
```

1. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha a pasta `build/chrome-mv3`.
3. Abra https://web.whatsapp.com.

Para atualizar depois de um novo build: clique em ↻ no card da extensão e recarregue a aba do WhatsApp.

### Atualizar para uma nova versão

Quando sai uma versão nova, aparece **Nova versão** no rodapé da sidebar e no popup do ícone da extensão. O link abre a página da versão no GitHub. A extensão não se atualiza sozinha (o Chrome não atualiza extensões carregadas sem compactação):

1. Baixe o `.zip` da versão.
2. Apague o conteúdo da pasta que você carregou no Chrome e extraia o zip **nessa mesma pasta**. Quem instalou pelo código pode, em vez disso, rodar `git pull`, `npm install` e `npm run build`.
3. Em `chrome://extensions`, clique em ↻ no card da extensão e recarregue a aba do WhatsApp.

> Use sempre a mesma pasta. Numa pasta diferente o Chrome trata como outra extensão, e as tags, notas e o pipeline salvos não aparecem.

### Publicar uma versão

Quem já usa só é avisado de versões maiores que a instalada. Suba `version` em `package.json`, faça o commit e o push, e então:

```bash
npm run zip
gh release create v0.2.0 build/whatsapp-crm-0.2.0-chrome.zip --title "v0.2.0" --notes-file docs/como-atualizar.md
```

## Desenvolvimento

```bash
npm run dev        # Chrome com recarga automática
npm test           # testes unitários (Vitest)
npm run compile    # checagem de tipos
```

O que depende do WhatsApp de verdade (layout, ações nativas) é conferido à mão: [docs/teste-manual.md](docs/teste-manual.md).

### Arquitetura

| Peça | Onde roda | Faz |
|---|---|---|
| `public/wppconnect-wa.js` ([wa-js](https://github.com/wppconnect-team/wa-js) 4.7.2) | página do WhatsApp | expõe `window.WPP`; injetado só com a extensão ligada |
| `entrypoints/wa-bridge.ts` | página do WhatsApp | lista conversas, avisa novas mensagens, abre conversas e roda as ações do menu ⋮ |
| `entrypoints/background.ts`, `lib/main-world.ts` | service worker | registra ou remove os scripts da página conforme a chave |
| `lib/update.ts`, `ui/UpdateNotice.tsx` | service worker, sidebar e popup | compara a versão instalada com a última Release do GitHub (no máximo a cada 6 h) e mostra **Nova versão** com o link |
| `lib/bridge/*` | content script | cliente tipado da ponte; valida com zod tudo que vem da página |
| `lib/repo/*` | content script | dados em `chrome.storage.local`, com schema versionado e migrações |
| `entrypoints/content/*` | content script | interface (React + Tailwind v4 em Shadow DOM) |
| `entrypoints/splash.content.tsx` | content script (`document_start`) | tela de carregamento e animação de entrada; só com a extensão ligada |
| `lib/wa-dom.ts`, `lib/wa-theme.ts` | content script | seletores do WhatsApp e tema aplicado à interface nativa |
| `lib/privacy.ts` | content script | regras de desfoque e o véu de tela inteira |
| `entrypoints/popup/*` | popup | chave liga/desliga |

A interface usa componentes [BoardUI](https://www.boardui.com/) (React + Tailwind v4); as regras de estilo estão em [AGENTS.md](AGENTS.md).

### Diagnóstico

Se as abas não aparecerem, rode no console da aba do WhatsApp e confira o resultado (não inclui conteúdo de mensagens):

```js
({ crm: document.documentElement.dataset.wacrm, chats: document.documentElement.dataset.wacrmChats, pane: !!document.querySelector('#pane-side') })
```

- `crm` vazio: o content script não rodou.
- `pane: false`: o WhatsApp mudou um seletor (ajustar em `lib/wa-dom.ts`).
- `chats: erro…`: o wa-js não é compatível com esta versão do WhatsApp.
