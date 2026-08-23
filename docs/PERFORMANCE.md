# PERFORMANCE.md — Como Medir

## Benchmark

O benchmark roda por 3 segundos e coleta:
- FPS medio do canvas via `canvas.fps.render`
- GPU info via `WEBGL_debug_renderer_info`
- Parametros GL (maxTextureSize, maxRenderbufferSize, etc.)

Score final = contribuicao FPS (0-60) + contribuicao GPU (0-25) + contribuicao GL caps (0-15)

## Monitor

O monitor hooka no ticker do PIXI e coleta FPS a cada frame.
Janela de sample: 120 frames (configuravel).

Auto-degrade: se FPS medio < 15 por 120 frames → baixa nivel.
Auto-upgrade: se FPS medio > 40 por 120 frames → sobe nivel.
Cooldown: 5000ms entre ajustes.

## Cenarios de Teste

### Cenario 1: Batata pura
- Nivel 0, 10 FPS, tudo off
- Esperado: canvas responsivo, sem efeitos visuais

### Cenario 2: Equilibrado
- Nivel 1, 30 FPS, animacoes on
- Esperado: boa experiencia na maioria dos PCs

### Cenario 3: Premium
- Nivel 2, 60 FPS, MSAA+SMAA
- Esperado: maxima qualidade, so em GPUs dedicadas

### Cenario 4: Auto-degrade
- Comecar no nivel 2, simular lag
- Esperado: degrada para nivel 1 ou 0 automaticamente

## Anti-Patterns

- Medir FPS com `performance.now()` em vez de `canvas.fps.render`
- Nao considerar `canvas.ready` antes de medir
- Rodar benchmark durante cena de transicao
- Coletar menos de 60 frames para decisao
