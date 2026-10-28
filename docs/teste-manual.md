# Teste manual

O que os testes automáticos não cobrem: o WhatsApp Web de verdade, logado. Rode depois de cada versão.

Use uma conversa de teste para as ações do menu ⋮. Teste primeiro as que dá para desfazer (silenciar, fixar, marcar como não lida) e por último Limpar, Apagar e Sair do grupo.

## Preparar
- [ ] `npm run build`, ↻ no card da extensão em `chrome://extensions` e recarregar a aba do WhatsApp

## Carregamento
- [ ] Ao abrir o WhatsApp: tela "WhatsApp CRM / Reimagined by Astruz" desde o início, sem a tela do WhatsApp aparecendo antes; a barra azul avança junto com o carregamento
- [ ] Ao terminar: a tela some, a sidebar entra pela esquerda e os cards da lista e da conversa sobem em seguida
- [ ] QR code de login ou "Usar aqui": a tela de carregamento sai sozinha em ~2s e não cobre nada
- [ ] Com a extensão desligada, recarregar não mostra a tela de carregamento
- [ ] Com "Reduzir movimento" ligado no sistema, sem animação

## Lista e abas
- [ ] Filtros nativos (Tudo, Não lidas…) somem; ficam a busca, ⋮, + e as abas **Aguardando · Individual · Grupos · Clientes**, todas com número
- [ ] Mesmo padrão de Ligações: linha com "Conversas" (22px) e ⋮ e + à direita; busca de ponta a ponta embaixo; abas embaixo, alinhadas com a busca a 20px das bordas
- [ ] **Arquivadas**: sem seta de voltar, título de 22px alinhado com o de Ligações; **Conversas** na sidebar volta para a lista
- [ ] Telas com seta de voltar (subpáginas de Configurações): título de 22px, seta alinhada com o título das outras telas
- [ ] **Aguardando**: conversas e grupos não lidos ou marcados como não lidos; ao ler, saem da aba
- [ ] **Individual** só conversas individuais; **Grupos** só grupos
- [ ] Enquanto as conversas carregam: cards cinza no formato dos cards (skeleton) e marcadores nos números das abas, sem texto "Carregando…"
- [ ] Fotos dos cards com 40px, centralizadas entre o nome e a última mensagem
- [ ] Cada card mostra foto (ou iniciais, ou ícone para contatos salvos só como número), nome, horário, última mensagem ("Você: …", "Ana: 📷 Foto") e não lidas
- [ ] Clicar num card abre a conversa certa; Enter no card focado também
- [ ] ☆ vira ★ e a conversa aparece em **Clientes**; recarregar → continua lá
- [ ] Digitar na busca mostra os resultados do próprio WhatsApp; apagar a busca volta às abas

## Outras telas da lista
- [ ] **Ligações**, **Arquivadas**, **Status**, **Canais**, **Comunidades**, **Configurações** e **Perfil**: lista e detalhes em dois cards com o mesmo espaço, cantos e linha de 1px de Conversas; sem abas do CRM e nada aparecendo por trás, inclusive com os detalhes de uma ligação abertos
- [ ] Digitar na busca dessas telas não muda as abas do CRM
- [ ] Voltar para **Conversas**: em menos de 1s as abas, a busca, ⋮ e + voltam alinhados como antes
- [ ] Abrir uma foto ou vídeo numa conversa: o visualizador ocupa a tela inteira, sem card por cima

## Menu ⋮ do card
- [ ] ⋮ aparece ao lado do horário; clicar nele não abre a conversa
- [ ] Arquivar, Silenciar (8 horas, 1 semana, Sempre), Fixar, Marcar como lida/não lida funcionam e o card atualiza
- [ ] Adicionar aos Favoritos e Adicionar à lista colocam a conversa na lista certa do WhatsApp
- [ ] Limpar, Apagar (individual) e Sair do grupo pedem confirmação; Cancelar não faz nada
- [ ] Depois de silenciar (inclusive **Sempre**) o menu mostra "Reativar notificações"; depois de fixar, "Desafixar conversa"
- [ ] O menu fecha logo depois da ação; clicar duas vezes rápido não repete a ação

## Sidebar
- [ ] Topo "WhatsApp CRM / Reimagined by Astruz"; Astruz abre https://astruz.dev/
- [ ] Grupos de itens separados só por linhas, sem títulos de seção; rodapé com Privacidade e a conta; sem Mensagens favoritas, Listas, Marcar todas como lidas, Selecionar conversas, Nova conversa, Novo grupo e Bloqueio do app (este fica em Configurações › Privacidade)
- [ ] Cada item abre a função nativa do WhatsApp
- [ ] Rodapé: Privacidade, Mídia e Configurações; por último a sua foto + **Perfil** (abre o Perfil) e, ao lado, o botão com ícone de sair, que pede a confirmação do WhatsApp para desconectar
- [ ] Com a janela baixa (menos de ~850px de altura) Mídia, Configurações e Perfil continuam no rodapé
- [ ] Sem foto de perfil: aparece um ícone no lugar; com **Fotos** na Privacidade, a sua foto também fica desfocada
- [ ] Sem Release mais nova no GitHub: nenhum aviso. Com uma Release de versão maior que a instalada: **Nova versão X** acima de Privacidade e no popup do ícone; o link abre a página da versão numa aba nova, sem tirar o WhatsApp da tela
- [ ] Passar o mouse nos itens não mostra nenhum link no canto da tela
- [ ] Degradê em cima ao rolar e embaixo enquanto há mais itens
- [ ] Nenhuma janela do WhatsApp fica por baixo ou por cima da sidebar (se ficar, o rodapé mostra "Sobreposto por…")

## Visual
- [ ] Sidebar, lista e conversa são cards com o mesmo fundo, linha de 1px, cantos de 24px e 8px de espaço entre eles
- [ ] Sem linha atravessando a conversa nem divisor dentro do card da lista
- [ ] Na conversa, o menu de anexo, o painel de emojis e o botão "rolar até o fim" ficam onde sempre ficaram; a linha de 1px do card não passa por cima de menus que encostam na borda
- [ ] Cores do WhatsApp em tons BoardUI (fundo grafite, destaques azuis), bolhas arredondadas, fonte Inter
- [ ] Nenhuma barra de rolagem visível
- [ ] Dicas ao passar o mouse (⋮ "Mais opções", "Nova ligação") escuras, com linha de 1px e cantos de 8px
- [ ] Balões de aviso do WhatsApp (ex.: "Adicionado(a) à sua lista de favoritos") aparecem escuros, com linha de 1px, à direita da sidebar e não por baixo dela
- [ ] Sem conversa aberta (e em Ligações), a ilustração do painel da direita fica em cinza e azul, sem o verde e o creme do WhatsApp
- [ ] Ligações perdidas em vermelho BoardUI; a divisória de Arquivadas no tom das outras linhas, não branca
- [ ] Menu ⋮ do WhatsApp com a mesma linha de 1px dos nossos cards, não branca

## CRM
- [ ] **Pipeline** (sidebar) abre o Kanban num card igual aos de Conversas (8px de espaço, cantos de 24px, linha de 1px), com as 5 etapas cabendo na tela; arrastar card entre etapas e dentro da coluna; clicar abre a conversa; Esc fecha
- [ ] Teclado no Pipeline: Espaço pega o card, setas movem, Espaço solta; Esc durante o arraste só cancela (o Pipeline continua aberto)
- [ ] Botão **CRM** no cabeçalho da conversa abre "Dados do contato" na seção do CRM: marcar cliente, etapa, tags (Enter), notas
- [ ] Digitar numa tag ou nota não dispara atalhos do WhatsApp

## Privacidade
- [ ] Cada opção desfoca o que promete e revela ao passar o mouse; nenhuma mostra o aviso "Não encontrei isso nesta versão do WhatsApp"
- [ ] Fotos desfocadas sem quadrado em volta
- [ ] Se alguma opção não achar o que desfocar, aparece um ⚠ vermelho no item **Privacidade** da sidebar, mesmo com o painel fechado
- [ ] Fechar um menu com o mouse parado no meio da tela não desfoca a tela inteira; sair da janela desfoca
- [ ] "Quando o mouse sai da janela" e "após 1 min sem uso" desfocam a tela inteira; mexer o mouse volta

## Ligar e desligar
- [ ] Ícone da extensão → **Desligado**: sidebar, abas, cards e desfoque somem na hora e o WhatsApp volta ao normal
- [ ] Recarregar o WhatsApp desligado → nenhum script da extensão na página
- [ ] **Ligado** de novo → tudo volta sem recarregar
