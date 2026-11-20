# THE LAST CONTRACT

Jogo de ação 2D top-down em pixel art, com iluminação neon, feito em **HTML5 Canvas + JavaScript puro**. Sem bibliotecas, sem servidor e sem internet: abra e jogue.

## Como executar

**Baixar o APK:** vá em [Releases](../../releases) e baixe `TheLastContract-vX.Y.Z.apk`. Cada push no `main` também gera o APK em *Actions → Android APK → Artifacts*.

**Jogar no navegador:** abra `www/index.html` (Chrome, Edge, Firefox ou Chrome no Android).

Pronto. Funciona abrindo o arquivo direto (`file://`).

Para instalar como app (PWA) no celular, sirva a pasta por HTTP. Por exemplo, rode `python3 -m http.server 8080` dentro da pasta e abra `http://IP-DO-PC:8080` no celular. Aí aparece “Adicionar à tela inicial”, e o `sw.js` guarda tudo para uso offline. O service worker só é ativado em http/https; abrindo o arquivo direto ele não é necessário.

## Controles

| Ação | PC | Celular | Gamepad |
|---|---|---|---|
| Mover | WASD / setas | analógico esquerdo (flutuante) | analógico esq. |
| Correr | Shift | empurrar o analógico até o fim | apertar o analógico / empurrar até o fim |
| Mirar | mouse | arrastar no lado direito | analógico dir. |
| Atirar | clique esquerdo (segure) | arrastar mais longe no lado direito | RT / RB |
| Corpo a corpo | clique direito / E / F | botão GOLPE | B / LT |
| Esquiva (invulnerável) | Espaço | botão ESQUIVA | A |
| Recarregar | R | botão RECARGA | X |
| Trocar arma | Q / roda do mouse / 1-5 | botão ARMA | Y / LB |
| Mandar o pitbull | G (ou C) | botão CÃO | R3 / direcional ↑ |
| Pausa | Esc / P | botão II | Start |

Os menus também funcionam com setas + Enter e com o direcional + A/B do gamepad.

## O que existe no jogo

- **15 fases**: O Contrato, A Boate, As Ruas, O Hotel, O Porto, O Metrô, O Estacionamento, O Cassino, A Galeria, A Igreja, A Fábrica, O Arranha-Céu, O Telhado (com chuva), O Jardim e O Último Contrato (chefe com 3 fases). As fases 1–4 e 15 foram desenhadas à mão; as fases 5–14 foram montadas por um gerador determinístico (salas BSP ou áreas abertas) e validadas para que todas as áreas sejam alcançáveis. Cada fase tem briefing, objetivo, progressão e tela de resultado. A saída só abre depois de limpar a área; com 3 ou menos inimigos restantes, setas na borda da tela indicam onde eles estão.
- **Armas**: pistola, escopeta (7 projéteis), rifle automático e faca. Tem munição limitada em pente e reserva, recarga manual e automática, e troca automática quando a munição acaba. Os inimigos largam as armas ao morrer.
- **Finalizações estilo Hotline Miami**: um soco (ou o pitbull) derruba o inimigo. Com ele no chão:
  - **GOLPE** desarmado: 3 pisões;
  - **GOLPE** com faca: 2 facadas;
  - **GOLPE** com o lápis: 4 golpes, a "finalização lendária";
  - **atirar** de perto: execução com a arma (gasta munição e faz barulho).

  Durante a finalização há zoom na câmera, faixas de cinema, clarão vermelho, pausa de impacto, sangue e pontuação extra.
- **Pitbull companheiro**: segue o protagonista o tempo todo. A cada **3 abates** ele fica pronto. Mire num inimigo (o alvo aparece marcado em verde) e aperte G / CÃO: ele corre até o alvo, derruba e **arranca a arma da mão dele**, segurando-o no chão por cerca de 2,5 s para você finalizar. Inimigos desarmados tentam pegar a arma de volta. O chefe resiste: leva dano, mas não é desarmado.
- **Lápis lendário**: escondido na sala VIP da Fase 2 (A Boate). Ao pegar, aparece "VOCÊ DESBLOQUEOU O ACESSÓRIO LENDÁRIO DE JOHN WICK". Ele mata qualquer inimigo comum com um golpe, é silencioso e fica salvo: depois de desbloqueado, você começa todas as fases com ele (tecla 5).
- **Esquiva** com invulnerabilidade: os tiros atravessam você durante o rolamento.
- **Cobertura**: caixas, mesas, balcões, carros e pilares bloqueiam tiros e visão, tanto para você quanto para os inimigos.
- **Barris explosivos**: dano em área, reação em cadeia e marca permanente no chão.
- **IA** com máquina de estados: patrulha (vigia ou anda pela área), percepção por cone de visão e linha de visão, tempo de reação, perseguição com busca de caminho (BFS), procura pela última posição vista, procura de cobertura ao recarregar ou quando ferida, tiro em rajada, avanço e recuo táticos e audição (tiros atraem inimigos através de paredes).
- **6 tipos de inimigo**: Capanga (pistola), Escopeteiro, Atirador de rifle, Brutamontes (corpo a corpo com golpe telegrafado), Elite (terno branco, mais preciso) e o chefe **O Arquiteto**. O chefe usa rajadas de rifle, depois escopeta com investidas e reforços, e na fase final leques de projéteis em círculo.
- **3 dificuldades**, que mudam dano, tempo de reação, precisão, vida e alcance de visão dos inimigos.
- **Pontuação** com combo multiplicador (abates em até 3,5 s), bônus por corpo a corpo, execução e explosão, bônus de tempo, precisão e vida, e **avaliação S/A/B/C/D**.
- **Salvamento local** (`localStorage`): fases desbloqueadas, recordes por fase e configurações.
- **Configurações**: volume geral, música e efeitos; dificuldade; qualidade gráfica; tremor de tela; assistência de mira (toque/gamepad); controles de toque sempre visíveis.
- **Áudio 100% procedural** (Web Audio API): todos os efeitos e uma trilha diferente por fase (sintetizador synthwave/eletrônico) são gerados em tempo real. Por isso não há arquivos de áudio.

## Estrutura

```
www/              o jogo (é isto que vai para dentro do APK)
capacitor.config.json, package.json, scripts/apply-native.mjs, native/   empacotamento Android
.github/workflows/android.yml   build do APK na nuvem
tests/            testes dos mapas (npm test)
tools/            gerador dos mapas
--- dentro de www/ ---
index.html        telas (menu, briefing, pausa, configurações, resultado...)
style.css         visual neon da interface
game.js           loop, câmera, renderização, HUD, pontuação, menus, salvamento
manifest.json     PWA (instalação/APK)
sw.js             cache offline (quando servido por http/https)
js/utils.js       matemática, fonte bitmap 5x7, salvamento
js/audio.js       efeitos e músicas sintetizados
js/input.js       teclado/mouse, toque (analógicos virtuais) e gamepad
js/sprites.js     sprites pixel art gerados por código (com cache)
js/maps.js        mapas ASCII das 15 fases (editáveis)
js/levels.js      temas visuais e dados das fases
js/world.js       mapa, colisão, linha de visão, busca de caminho, iluminação
js/entities.js    armas, jogador, finalizações, IA dos inimigos, chefe, pitbull, barris
assets/icons/     ícones do app (192, 512, maskable)
assets/sprites/spritesheet.png   exportação de referência dos sprites
```

### Sobre os sprites

Os personagens, armas e itens são desenhados **pixel a pixel por código** (`js/sprites.js`) e guardados em cache como folhas de sprites em memória. Isso garante que personagem, inimigos e armas tenham sempre a mesma paleta e proporção, e deixa o jogo leve. O arquivo `assets/sprites/spritesheet.png` é uma **exportação de referência** dessas folhas (para ver ou servir de base a uma arte desenhada à mão). O jogo não carrega esse PNG.

### Editar mapas

Cada fase em `js/maps.js` é um mapa ASCII:

| Caractere | Significado |
|---|---|
| `#` | parede |
| `.` `,` `:` `_` | pisos (cada tema define a aparência) |
| `C` | caixa/caçamba |
| `K` | balcão/mesa/rack |
| `S` | sofá/cama |
| `T` | mesa |
| `O` | pilar |
| `V` | carro |
| `p` | planta (todos sólidos, funcionam como cobertura) |
| `P` | jogador |
| `X` | saída |
| `g` | capanga |
| `n` | escopeteiro |
| `f` | atirador |
| `m` | brutamontes |
| `e` | elite |
| `B` | chefe |
| `R` | ponto de reforço do chefe |
| `1` `2` `3` `4` `5` | pistola, escopeta, rifle, faca, lápis lendário |
| `a` | munição |
| `+` | kit médico |
| `%` | barril explosivo |
| `*` `^` `&` | luzes neon (3 cores por tema) |

## Desempenho

- O jogo renderiza em baixa resolução (cerca de 480×270, escala inteira) e amplia com `image-rendering: pixelated`. Isso deixa o pixel art nítido e reduz bastante o trabalho da GPU.
- O cenário inteiro (chão, paredes, objetos) é pré-renderizado uma vez por fase. Sangue, corpos e cápsulas são “carimbados” nessa imagem, sem custo por quadro.
- A iluminação é pré-calculada em meia resolução. Na **qualidade baixa**, ela é aplicada uma única vez no mapa: zero custo por quadro, ideal para aparelhos modestos.
- Partículas e projéteis usam pools (sem coleta de lixo durante o jogo). A IA limita a frequência das checagens de visão e de busca de caminho.

## Gerar o APK (Capacitor + GitHub Actions)

O workflow `.github/workflows/android.yml` faz tudo na nuvem: instala o Capacitor, roda os testes, cria o projeto Android e aplica `scripts/apply-native.mjs`, que configura:

- tela cheia imersiva;
- orientação paisagem;
- tela sempre ligada;
- ícones e splash.

No fim, compila o APK.

- **Push no `main`:** o APK aparece em *Actions → Android APK → Artifacts* e a Release `v<versão do package.json>` é criada ou atualizada com o APK. Para lançar uma versão nova, aumente `version` no `package.json`.
- **APK assinado de produção** (opcional, para a Play Store): cadastre os secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. Sem eles, o APK é de depuração: funciona normalmente no celular, mas não serve para a loja.

Para compilar no PC, com Android Studio instalado:

```
npm install
npm run android:debug
```

O APK sai em `android/app/build/outputs/apk/debug/`.

Os mapas das fases 5–14 vêm de `tools/gen_maps.py`. Para regerar: `npm run maps`.

## Nome do acessório lendário

O texto do lápis usa a constante `LEGEND_OWNER` em `js/levels.js`. John Wick é um personagem e marca registrada da Lionsgate. Para uso pessoal não há problema, mas **troque o nome antes de publicar o APK na Play Store**, para evitar remoção por violação de marca.

## Limitações conhecidas

- Os sprites são procedurais (desenhados em código), não pixel art feita à mão. A identidade é consistente, mas mais simples que um jogo comercial.
- O gamepad usa o mapeamento padrão (“standard”) do navegador; controles fora do padrão podem ter botões trocados.
- Em navegadores de iPhone, o fullscreen e o bloqueio de orientação não estão disponíveis (limitação do Safari). O jogo funciona, mas mostra o aviso para girar o aparelho.
- Não há checkpoints: morrer reinicia a fase atual.
- O pitbull é invulnerável (decisão de design para não frustrar), e os inimigos não o atacam.
- As fases 5–14 vêm de um gerador: são variadas e jogáveis, mas menos "roteirizadas" que as fases feitas à mão.
