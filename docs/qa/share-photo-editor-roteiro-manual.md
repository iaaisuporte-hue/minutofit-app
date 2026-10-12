# Roteiro manual — editor de foto do compartilhamento de treino

Homologação no **app instalado** (Android WebView e iOS WKWebView). O ambiente de
desenvolvimento (WSL, sem Gradle/Xcode, sem aparelho) **não** valida isto — os testes
automatizados cobrem a lógica com canvas simulado, não o toque nem a câmera reais.

> **Antes do build nativo:** rode `npx cap sync` no diretório do app. Sem ele o
> app empacota o código anterior e o editor simplesmente não aparece (falha silenciosa).

Onde abrir: concluir um treino → **Compartilhar** (ou um treino/atividade do histórico).

## 1. Câmera e galeria
- [ ] **Tirar foto** com permissão concedida → o editor abre (tela cheia) com a foto.
- [ ] **Tirar foto** com permissão **negada** → aparece a mensagem pedindo a permissão nas
      configurações e **Galeria** continua disponível; o modal não trava.
- [ ] **Galeria** → escolher foto → o editor abre.
- [ ] Cancelar a câmera/galeria → volta ao modal sem mensagem de erro.
- [ ] Arquivo que não abre (ex.: HEIC não suportado, arquivo corrompido) → mensagem
      "Não consegui montar a imagem com essa foto. Tente outra."; o editor **não** abre e a
      foto anterior (se havia) continua.

## 2. Orientação e tamanho
- [ ] Foto **retrato**, foto **paisagem** e foto com **EXIF girado** (tirada com o
      aparelho deitado) aparecem na orientação certa no editor e na arte final.
- [ ] Foto de **12 MP ou mais** abre sem travar nem fechar o app; o gesto continua fluido.

## 3. Gestos
- [ ] Na primeira abertura aparece a dica "Pince para zoom · arraste para posicionar";
      some ao primeiro gesto e não volta na mesma sessão do app.
- [ ] Arrastar com **um dedo** move só a foto; texto, painel de exercícios e logo ficam parados.
- [ ] **Pinça** com dois dedos dá zoom ancorado entre os dedos (até ~3×) e arrasta junto.
- [ ] Nunca aparece borda vazia: arrastar até o limite para a foto na borda.
- [ ] Toque longo na foto **não** abre "Salvar imagem"/menu do sistema; a página não rola
      nem dá zoom durante o gesto.
- [ ] iPhone: o gesto perto da base da tela não conflita com o home indicator (os controles
      ficam embaixo, a foto acima).

## 4. Ajustes
- [ ] **Brilho** e **Contraste** mudam só a foto (o texto não muda de cor); o rótulo mostra
      "Neutro", "+10%", "−8%"…
- [ ] **Escurecimento do fundo: Suave · Médio · Forte** muda a sombra sobre a foto; Médio é o padrão.
- [ ] **Restaurar** volta zoom, posição, brilho, contraste e escurecimento (Médio) **só do
      formato atual**; fica desabilitado quando já está tudo no padrão.
- [ ] **Story 9:16 ↔ Feed 1:1** repetido várias vezes: cada formato guarda o próprio
      enquadramento/ajuste; o formato ainda não visitado começa no padrão; nada trava.

## 5. Concluir, voltar e compartilhar
- [ ] **Concluir** → volta ao modal com a prévia já com a foto ajustada e a mensagem
      "Foto adicionada ao card." (na primeira foto).
- [ ] A prévia do modal **bate** com o que foi visto no editor (enquadramento, brilho, escurecimento).
- [ ] **Ajustar foto** reabre o editor com os ajustes salvos.
- [ ] No editor, mexer e tocar **Voltar** → volta ao modal com a foto, **sem** os ajustes
      daquela abertura.
- [ ] Botão **voltar do Android** no editor → volta ao modal (não fecha o compartilhamento
      nem sai da tela do treino). Voltar de novo → fecha o modal, o resumo do treino continua lá.
- [ ] Trocar Story/Feed **no modal** (fora do editor) usa o ajuste salvo de cada formato.
- [ ] **Compartilhar** no Instagram como **Story** e como **Feed**: a imagem publicada bate
      com a prévia.
- [ ] **Salvar no aparelho**: o arquivo salvo bate com a prévia.
- [ ] Fluxo **sem foto** (só compartilhar o card padrão) continua igual ao de antes.

## 6. Tema e tela pequena
- [ ] Tema **escuro** e **claro**: controles legíveis, nenhum bloco claro "chumbado" no escuro.
- [ ] Aparelho pequeno (~320–360 px de largura): sem rolagem horizontal, todos os botões
      tocáveis (≥ 44 px), o palco da foto continua visível.
- [ ] Girar o aparelho com o editor aberto: o canvas se reajusta sem distorcer.

Registre aparelho, versão do sistema e versão do app em cada execução.
