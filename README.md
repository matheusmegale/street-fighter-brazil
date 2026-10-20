# Brasil Fighters

Jogo de luta 2D estilo arcade (inspirado em Street Fighter II), feito com **Phaser 3 + Vite** em JavaScript puro.
Obra de humor e paródia fictícia com caricaturas da política brasileira — sem intenção de representar fatos reais.

## Executar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes automatizados (Vitest)
npm run build      # build de produção em dist/
npm run preview    # serve o build de produção
```

Não há backend nem serviços externos: a fonte (Press Start 2P, OFL) é empacotada localmente e todo o áudio é sintetizado com Web Audio.

## Controles

| Ação | Jogador 1 | Jogador 2 | Gamepad |
|---|---|---|---|
| Mover / pular / agachar | A D W S | ← → ↑ ↓ | D-pad ou analógico |
| Soco fraco / forte | F / G | K / L | X / Y |
| Chute fraco / forte | H / J | ; / ' (Ç / ~ no ABNT2) | A / B |
| Especial | R | O | RB / LB |
| Superataque | T | P | RT / LT |

- **Defender:** segure a direção contrária ao adversário (agachado + trás defende golpes baixos; golpes aéreos precisam de defesa em pé).
- **Especiais:** botão de especial sozinho = especial neutro; **para frente + especial** = especial de avanço; **baixo + especial** = terceiro especial.
- **Super:** com a barra de ENERGIA cheia ("SUPER!").
- **ESC** pausa a luta. **F1** mostra hitboxes (azul = hurtbox, vermelho = hitbox, branco = pushbox, laranja = projétil).
- Os controles são lidos pela **posição física** da tecla (`KeyboardEvent.code`) e podem ser remapeados em *Configurações* (salvos no navegador).
- Teclados baratos podem não registrar muitas teclas ao mesmo tempo (*ghosting*); se isso acontecer, remapeie as teclas ou use um gamepad.

### Golpes especiais

| | Neutro | Para frente | Baixo | Super |
|---|---|---|---|---|
| **Bolsonaro** | Tiro Certeiro (projétil de energia) | Motociata (avanço de moto, derruba) | Chute na Esquerda (chute avançando, derruba) | Brasil Acima de Tudo |
| **Lula** | Discurso do Povo (estrela, mais lenta) | Chute do Povo (chute avançando, derruba) | Paz e Diálogo (área, invulnerável no início) | União do Brasil (onda com vários hits) |

## Modos

- **Jogar / Contra CPU:** IA com três dificuldades (Fácil, Normal, Difícil). A CPU só "enxerga" o adversário com atraso de reação (30 / 18 / 12 frames), então nunca reage de forma sobre-humana.
- **Versus Local:** dois jogadores no mesmo teclado (ou teclado + gamepads).
- Melhor de 3 rounds, 99 segundos, vitória por K.O. ou tempo, empate (cada lado ganha o round; 2×2 = DRAW GAME), revanche e volta ao menu.

## Arquitetura

```
src/
  combat/      lógica pura (sem Phaser): Simulation (passo fixo 60 Hz), CombatSystem (hits,
               defesa, combos, projéteis), HitboxSystem, MoveSystem (frame data), Match (rounds)
  entities/    Fighter (máquina de estados) e Projectile (com pool)
  ai/          FighterAI — produz o mesmo objeto de entrada que o teclado
  characters/  configurações dos lutadores (dados) + registro em index.js
  input/       bindings (mapeamento puro, testado) e InputManager (teclado/gamepad)
  view/        render: FighterSprite, efeitos, projéteis, cut-in do super, cenário procedural
  ui/          HUD e texto arcade
  audio/       efeitos e músicas sintetizados (Web Audio)
  scenes/      Boot, Menu, Select, Fight, Result, Settings
tools/         extract_sprites.py + tools/frames/<id>.json (mapa manual dos frames)
source-art/    folhas originais geradas por IA
public/assets/characters/<id>/   atlas gerado (png + json), retrato, arte do super
tests/         Vitest: combate, rounds, IA, controles e personagens reais
```

- A **simulação é determinística e independente da renderização**: as cenas só leem o estado e reagem aos eventos (`hit`, `block`, `ko`, `super`...). Hitstop e o congelamento do super acontecem dentro da simulação.
- Colisões usam **hitboxes / hurtboxes / pushboxes** declaradas na configuração de cada golpe — nunca a sobreposição dos sprites.
- Não existe lógica específica de personagem no motor; tudo vem da configuração.

## Sprites

As folhas fornecidas são composições ilustradas (não spritesheets técnicos). `tools/extract_sprites.py` recorta cada frame a partir de retângulos medidos à mão em `tools/frames/<id>.json`, remove o fundo azul-marinho (componentes conectados + preenchimento a partir da borda, para não "furar" os ternos escuros), descarta pedaços de frames vizinhos e textos, calcula o pivô nos pés e empacota um atlas Phaser (JSON hash com `pivot` por frame). Também gera `tools/out/<id>-contact.png` para conferência visual.

```bash
pip install Pillow numpy
npm run sprites            # regenera todos os atlas
```

Para trocar por spritesheets técnicos no futuro basta gerar um `atlas.json` com os mesmos nomes de frame — as configurações dos personagens não mudam.

## Adicionar um personagem

1. Coloque a folha em `source-art/` e crie `tools/frames/<id>.json` com os retângulos (`npm run sprites`).
2. Crie `src/characters/<id>.js` copiando a estrutura de `lula.js`: stats, hurtboxes, golpes (frame data + hitbox + frames), especiais (`neutral` / `forward` / `down`), super, animações, rostos do HUD e frase de vitória.
3. Registre em `src/characters/index.js`. O teste `tests/characters.test.js` passa a cobrir o novo lutador automaticamente.

## Limitações conhecidas

- As animações têm de 1 a 5 frames e algum "tremor" entre poses, porque a folha foi gerada por IA (proporções e escalas variam entre linhas; parte disso é compensada com `frameScale` por grupo de frames).
- Não há frames próprios de defesa, vitória ou levantar: são reaproveitados frames de guarda, pulo (punho erguido) e agachado.
- "WALK BACK" da folha mostra o personagem de costas; o andar para trás usa o andar para frente invertido. "CROUCH WALK" e as paletas alternativas não são usados.
- Os painéis largos (super e Paz e Diálogo) viram cut-in ou frame de área; os projéteis de Tiro Certeiro, Discurso do Povo e União do Brasil são procedurais.
- Na fonte Press Start 2P, maiúsculas acentuadas (Ê, Õ, É) aparecem menores para caber na célula de 8×8 px.
- O balanceamento foi ajustado com partidas CPU × CPU (54% × 46% no geral, com leve vantagem do Lula no Normal); ainda não houve rodada de testes com jogadores humanos.
- Suporte a gamepad usa o layout padrão da Gamepad API e não pôde ser testado com um controle físico neste ambiente.
