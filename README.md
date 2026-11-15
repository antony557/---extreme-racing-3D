# EXTREME RACING 3D

Jogo de corrida 3D completo para navegador (desktop e celular), construído com Three.js e física própria. Sem dependências externas em tempo de execução — tudo (veículos, pistas, texturas e áudio) é gerado proceduralmente.

## Como executar

O jogo usa ES Modules, então precisa de um servidor local (não abre por `file://`):

```bash
cd extreme-racing-3d
npx serve .            # ou: python3 -m http.server 8080
```

Abra `http://localhost:8080` (ou a porta indicada) no navegador.

## Recursos

- **12 veículos** procedurais (hatch, sedã, SUV, muscle, rally, cupê, drift, esportivos, GT, super, hiper e protótipo), cada um com velocidade máxima, aceleração, peso, aderência e comportamento de drift próprios.
- **Garagem 3D** interativa: gire o carro com o mouse/dedo, troque pintura (16 cores), rodas (4 estilos) e compre melhorias de Motor, Pneus e Nitro (5 níveis).
- **Física de veículo**: aceleração progressiva com 6 marchas automáticas, aderência lateral limitada (understeer real), transferência de peso visual, freio de mão com derrapagem, inércia, rampas com inclinação, colisões entre carros e com obstáculos, faixa de terra com menos grip.
- **5 pistas** com identidade própria: Cidade Neon (prédios iluminados), Serra Verde (elevação e curvas fechadas), Rodovia Infinito (retas longas e guard-rails), Autódromo Velocità (zebra, arquibancadas, pilhas de pneus) e Dunas Escaldantes (deserto).
- **5 modos**: Corrida Rápida, Campeonato (5 etapas com pontuação e bônus de título), Contrarrelógio (recordes por pista), Corrida Livre e Eliminação (último colocado sai a cada 15 s).
- **IA adversária**: segue o traçado, freia para curvas pela curvatura, faz ultrapassagens com desvio lateral, evita colisões e responde ao jogador. 3 níveis de dificuldade.
- **4 câmeras**: perseguição, próxima, cockpit e cinemática (tecla C).
- **HUD completo**: velocímetro analógico com RPM e marcha, posição, volta, tempo, última volta, nitro e minimapa em tempo real.
- **Áudio procedural** (Web Audio): motor que acompanha o RPM, trocas de marcha, derrapagem, colisões, nitro, vento e música no menu — com opções para desligar.
- **Controles**:
  - Teclado: `W/↑` acelerar, `S/↓` frear (e ré), `A/D` ou `←/→` direção, `Espaço` freio de mão, `Shift` nitro, `C` câmera, `R` reposicionar, `Esc` pausar.
  - Toque: botões grandes de gás, freio, freio de mão, nitro, esquerda/direita, reset e câmera — com multi-toque (acelerar e virar ao mesmo tempo). Orientação paisagem durante as corridas.
- **Progressão**: moedas, recompensas por posição, desbloqueio de veículos, melhorias, recordes e estatísticas — salvamento automático no `localStorage`.
- **Otimização**: 3 níveis de qualidade (baixa/média/alta), ajuste automático por FPS, sombras apenas quando suportadas, instancing de vegetação/props, névoa de distância, partículas em pool e limpeza de memória entre corridas.

## Estrutura

```
index.html          Telas e HUD
css/style.css       Interface
js/main.js          Bootstrap
js/game.js          Loop, estados, cena do menu, qualidade
js/race.js          Gerenciador de corrida (modos, voltas, posições)
js/physics.js      Física do veículo
js/ai.js            Inteligência artificial
js/tracks.js        Pistas, cenários, colisores, iluminação
js/cars.js          Especificações e modelos 3D dos veículos
js/garage.js        Garagem 3D e personalização
js/camera.js        Câmeras
js/hud.js           HUD (velocímetro, minimapa)
js/particles.js     Fumaça, poeira, faíscas, marcas de pneu
js/audio.js         Áudio procedural
js/input.js         Teclado + multi-touch
js/save.js          Progressão e salvamento
js/config.js        Constantes de ajuste
test/simulate.mjs   Testes headless (física, pistas, IA, voltas)
```

## Testes

```bash
node test/simulate.mjs
```

Valida: construção das 5 pistas, aceleração/frenagem/virada/drift, anti-travamento, IA completando 3 voltas em cada pista, detecção de cruzamento de linha e integridade dos modelos.
