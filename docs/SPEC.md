# SPEC.md — Especificacao do Modulo

## O que o modulo faz

Batata Ou Nao detecta se o computador do jogador e uma "batata" e configura os graficos automaticamente para a melhor experiencia possivel.

## Features

### 1. Benchmark de GPU
- Detecao via WebGL (`WEBGL_debug_renderer_info`)
- Coleta de parametros GL (texture size, renderbuffer, uniforms)
- Medicao de FPS real do canvas por 3 segundos
- Score de 0-100 com recomENDACAO de nivel

### 2. Monitor Dinamico
- FPS tracking em tempo real via `canvas.fps.render`
- Auto-degrade quando FPS cai abaixo do threshold
- Auto-escal quando FPS sobe acima do threshold
- Cooldown entre ajustes para evitar oscillacao

### 3. Controles Granulares
9 features individuais com impact badge:

| Feature | Impacto | Setting |
|---------|---------|---------|
| Sombras Suaves | Alto | lightSoftEdges |
| MSAA | Alto | msaa |
| Animacoes de Luz | Alto | lightAnimation |
| Animacoes de Visao | Alto | visionAnimation |
| FPS Maximo | Alto | maxFPS |
| Mipmap | Medio | mipmap |
| SMAA | Medio | smaa |
| Efeitos Climaticos | Medio | weatherEffects |
| Modo Fotosensivel | Baixo | photosensitiveMode |

### 4. Presets

| Nivel | Nome | Configuracao |
|-------|------|--------------|
| 0 | Batata | Tudo off, 10 FPS, modo fotosensivel |
| 1 | Batata Boa | Equilibrado, 30 FPS |
| 2 | Premium | Tudo no maximo, 60 FPS, MSAA+SMAA |

## API Publica

```js
PotatoOrNot.quality
await PotatoOrNot.setQuality(2)
const result = await PotatoOrNot.benchmark(3000)
PotatoOrNot.startMonitor({ autoAdjust: true })
PotatoOrNot.toggleFeature("softShadows")
PotatoOrNot.granular
PotatoOrNot.monitor
```

## Hooks

| Hook | Quando |
|------|--------|
| BatataOuNaoReady | Modulo carregado |
| BatataOuNaoBenchmarkComplete | Benchmark terminou |
| BatataOuNaoQualityApplied | Qualidade aplicada |
| BatataOuNaoAutoDegrade | Auto-degradacao |
| BatataOuNaoAutoUpgrade | Auto-escalacao |
