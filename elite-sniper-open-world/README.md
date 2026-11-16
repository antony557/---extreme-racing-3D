# ELITE SNIPER — OPEN WORLD

FPS de sniper em mundo aberto para **navegador (PC e Android)**, construído com Three.js,
áudio procedural Web Audio e física virtual própria. Sem build, sem servidor: abra e jogue.

## Como jogar

Opção 1 — abrir direto:
1. Abra `index.html` num navegador moderno (Chrome/Edge/Firefox).
   Alguns navegadores bloqueiam módulos ES via `file://`. Se acontecer, use a opção 2.

Opção 2 — servidor local (recomendado):
```bash
cd elite-sniper-open-world
npx serve .          # ou: python3 -m http.server 8080
```
Abra `http://localhost:8080` (no celular, use o IP do computador na mesma rede).

## Controles

**PC:** WASD mover · Mouse olhar (clique para capturar) · Botão esq. disparar ·
Botão dir. mirar · Roda do mouse alternar zoom · **R** recarregar · **Shift** correr /
prender a respiração ao mirar · **C** agachar · **Z** deitar · **B** binóculos ·
**E** interagir (subir torres, coletar inteligência) · **H** kit médico ·
**Tab** inventário · **Esc** pausa.

**Android:** joystick virtual à esquerda · arrastar à direita para olhar ·
botões: TIRO, MIRAR (toque alterna), RECARGA, ZOOM, BINÓC, CORRER (segure mirando
para prender a respiração), AGACHAR, DEITAR, PULAR, USAR, ✚ (curar), MOCHILA, II (pausa).
O jogo pede modo paisagem.

## O que está implementado

- **Mundo aberto 1600×1600 m** com geografia coerente: cordilheira ao norte, vales,
  rio esculpido de oeste a leste, lago, cachoeira, campos, rochedos a leste, neve nos picos.
- **Streaming por chunks com 3 níveis de LOD**, descarte de geometria distante,
  frustum culling, `InstancedMesh` para árvores/rochas/grama, vento no vertex shader.
- **Estruturas**: 3 vilarejos, base militar com muros/torres/barracos, 2 acampamentos,
  2 torres de observação (escaláveis pela escada com E), estradas de terra.
- **Ciclo dia/noite completo** (8 min) e **6 estados de clima** (limpo, nublado, chuva,
  tempestade com trovoadas e relâmpagos, neblina, vento forte) com transições suaves.
- **3 rifles com modelos 3D procedurais detalhados** (corpo, cano, freio de boca, coronha,
  luneta com torretas, ferrolho animado, carregador, bipé que abre em prona).
- **Balística virtual**: gravidade, arrasto do vento, tempo de voo, dispersão por postura/
  bipé/apneia, headshot (×2,5), queda de dano por velocidade, tracers e impactos.
- **Luneta funcional** (4×/8×/16× conforme rifle) com retícula mil-dot, apneia com
  penalidade de ofegação, e **binóculos**.
- **8 espécies de animais** com IA (pastar, vagar, beber, alerta, fuga com zigue-zague,
  predadores que atacam, bandos, aves que se dispersam em voo), sentidos de visão/audição
  e reação a tiros e passos.
- **NPCs hostis** com patrulha, investigação de ruídos, detecção com tempo de reação,
  busca de cobertura, rajadas, 3 níveis de dificuldade.
- **Campanha com 11 missões** (caça, eliminação, reconhecimento, tiro longo, coleta,
  sobrevivência na tempestade, exploração) com progresso, recompensas e tela de resultados.
- **Progressão e salvamento automático** (XP, níveis, desbloqueio de rifles, estatísticas,
  posição e hora do mundo) em `localStorage`.
- **HUD integrado**: bússola com marcadores, coordenadas, relógio, clima, objetivo com
  marcador 3D, vida/energia, munição, postura, hitmarker, kill feed, vinheta de dano.
- **Áudio 100% procedural espacializado** (HRTF): tiro com eco, ferrolho, recarga,
  passos, vento, chuva, pássaros, vocalizações de animais, trovões, batimento cardíaco.
- **3 presets de qualidade** (BAIXA/MÉDIA/ULTRA) + **redução adaptativa de resolução**
  quando o FPS médio cai abaixo de 26.

## Arquitetura

```
src/
  core/     config.js (presets) · utils.js (ruído/RNG) · save.js · audio.js · input.js
  world/    heightfield.js (geografia) · terrain.js (chunks+LOD) · vegetation.js
            water.js · sky.js · weather.js · structures.js · world.js (colisão+raycast)
  player/   player.js (movimento/posturas) · camera.js (bob/recuo/apneia)
  weapons/  rifles.js (modelos) · ballistics.js · weaponSystem.js
  entities/ animals.js · npcs.js
  game/     missions.js · progression.js
  ui/       hud.js · menus.js · mobileLayout.js (posições dos controles)
  main.js   bootstrap e loop
tests/  smoke.mjs · game.e2e.mjs · layout.mjs
```

## Testes executados (reais)

Três suítes automatizadas em Node:

- **`tests/smoke.mjs`** — 37 verificações de sistemas (mundo, física, armas,
  animais, NPCs, missões, progressão, performance):

- heightfield determinístico, rio abaixo do nível da água, montanhas, sítios aplainados;
- streaming de chunks (criação, recarga ao mover, descarte ao longe);
- raycast de terreno/entidades, colisão do jogador, assentamento no terreno;
- caminhada, prona com altura de olhos, dano, kit médico;
- projétil com gravidade impactando o terreno; vento desviando a trajetória;
- disparo/recarga/zoom da luneta com munição consistente;
- veado detectando e fugindo do caçador; morte e animação de queda;
- spawn de bandos de animais; NPCs detectando, entrando em combate e disparando;
- spawn de NPCs na base militar; missões de caça/tiro longo concluídas e persistidas;
- XP e subida de nível;
- simulação de 60 s de jogo a 60 Hz: ~0,14 ms/frame de lógica, mundo povoado
  (34 animais, 12 NPCs, streaming estável), sem NaN nos extremos do mapa.

Verificações estáticas adicionais: sintaxe de todos os módulos (`node --check`) e
conferência automática de que todo `getElementById` usado no código existe no HTML.

- **`tests/game.e2e.mjs`** — 39 verificações que dão boot no JOGO INTEIRO
  (main.js real, renderizador simulado) e rodam o loop de jogo: menu → caça
  livre → 600 frames → mover → atirar/mirar/zoom/deitar → pausa/continuar →
  campanha → morte/respawn → sair/reentrar → autosave. Inclui **simulação de
  toque real**: dedo direito girando a câmera (yaw e pitch), analógico esquerdo
  movendo o personagem, e regressão do bug de câmera travada (pausar com o dedo
  na tela e voltar — a câmera continua respondendo). Também verifica zero
  erros de console durante toda a execução.
- **`tests/layout.mjs`** — prova geométrica do layout mobile em 3 resoluções
  reais de Android (780×360, 915×412, 1280×720): os 13 botões não se
  sobrepõem dois a dois (78 pares verificados por resolução), todos dentro da
  tela, nenhum cobre o analógico, ações de combate no lado direito.

**Limitação honesta:** este sandbox não possui navegador com WebGL nem acesso a um
aparelho Android, então o boot visual em navegador real e o FPS em tela não puderam ser
medidos aqui — a lógica, a física e a IA foram testadas de fato; o caminho de renderização
usa apenas APIs padrão do Three.js r160.

## Substituições declaradas (conforme a seção 17 do briefing)

- **Modelos GLB externos** (Poly Haven/Quaternius/Sketchfab): este ambiente não permite
  download de assets de terceiros nem verificação de licença in-loco. Todos os modelos
  (rifles, animais, soldados, construções, árvores, rochas) são **geometria procedural
  detalhada e original** — sem risco de licença e com carregamento instantâneo.
- **Rapier**: substituído por **física virtual própria** (integração de projéteis com
  gravidade/vento, colisão círculo-cilindro/caixa, raycast analítico) — mais leve para
  mobile e suficiente para o gameplay de sniper.
- **IndexedDB**: os saves são pequenos; usa-se `localStorage` com versionamento.
- **Texturas fotográficas**: terrenos usam vertex colors por bioma + ruído; céu, nuvens,
  água e efeitos usam shaders e texturas geradas em canvas.
