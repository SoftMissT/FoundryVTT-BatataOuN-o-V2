# Batata Ou Não

Módulo para Foundry VTT v14+ que **realmente** otimiza a performance com benchmark de GPU, monitor em tempo real e controles granulares.

> Reescrito do zero a partir do [PotatoOrNot](https://github.com/fantasycalendar/FoundryVTT-PotatoOrNot) por Nelson (SoftMissT) Fluctlight Fellowship

## O que faz de verdade

### Benchmark Automático

- Detecta GPU via WebGL (`WEBGL_debug_renderer_info`)
- Coleta parâmetros GL (texture size, renderbuffer, uniforms)
- Mede FPS real do canvas durante 3 segundos
- Gera score de 0-100 e recomenda nível automaticamente

### Monitor Dinâmico

- Acompanha FPS a cada frame via `canvas.fps.render`
- Auto-degrada quando FPS cai abaixo do threshold
- Auto-escala quando FPS sobe acima do threshold
- Cooldown entre ajustes para evitar oscilação

### Controles Granulares

Cada feature pesada pode ser ligada/desligada individualmente:

| Feature | Impacto | O que controla |
| --------- | --------- | ---------------- |
| Sombras Suaves | Alto | `lightSoftEdges` |
| MSAA | Alto | Anti-aliasing multisample |
| Animações de Luz | Alto | Flames, torches |
| Animações de Visão | Alto | Token vision |
| FPS Máximo | Alto | Limite de framerate |
| Mipmap | Médio | Texturas afastadas |
| SMAA | Médio | Anti-aliasing morfológico |
| Efeitos Climáticos | Médio | Chuva, neve |
| Modo Fotosensível | Baixo | Reduz flashes |

### Presets Inteligentes

| Nível | Nome | O que aplica |
| ------- | ------ | -------------- |
| 0 | Batata | Tudo off, 10 FPS, modo fotosensível |
| 1 | Batata Boa | Equilibrado, 30 FPS |
| 2 | Premium | Tudo no máximo, 60 FPS, MSAA+SMAA |

## API Pública

```js
// Nível atual
PotatoOrNot.quality

// Definir nível
await PotatoOrNot.setQuality(2)

// Rodar benchmark
const result = await PotatoOrNot.benchmark(3000)
// { gpu, fps, score, tier, glParams }

// Monitor
PotatoOrNot.startMonitor({ autoAdjust: true, degradeThreshold: 15 })
PotatoOrNot.stopMonitor()
PotatoOrNot.monitor  // { active, avgFps, currentFps, tier }
PotatoOrNot.fpsHistory  // number[]

// Controles granulares
PotatoOrNot.granular  // [{ id, name, enabled, currentValue, impact }]
PotatoOrNot.toggleFeature("softShadows")
PotatoOrNot.setFeature("maxFPS", 30)
PotatoOrNot.resetFeatures(0)  // reset nível 0

// Info GPU
PotatoOrNot.getGPU()  // { vendor, renderer, version }
PotatoOrNot.getGLInfo()  // { maxTextureSize, ... }
```

## Hooks

| Hook | Argumento | Quando |
| ------ | ----------- | -------- |
| `BatataOuNaoReady` | | Módulo carregado |
| `BatataOuNaoBenchmarkComplete` | `BenchmarkResult` | Benchmark terminou |
| `BatataOuNaoQualityApplied` | `level` | Qualidade aplicada |
| `BatataOuNaoAutoDegrade` | `level, avgFps` | Auto-degradação |
| `BatataOuNaoAutoUpgrade` | `level, avgFps` | Auto-escala |

## Instalação

1. **Configurações do Módulo** → **Instalar Módulo**
2. URL: `https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json`
3. Ative o módulo

## Desenvolvimento

```
scripts/
  main.js        entry point, hooks init/ready
  settings.js    registro de settings
  quality.js     presets e aplicação
  benchmark.js   detecção GPU + benchmark
  monitor.js     FPS tracking + auto-degrade
  granular.js    controles individuais
  application.js ApplicationV2 dialog
  api.js         window.PotatoOrNot
  utils.js       batch, profiling, validation
```

## Licença

MIT
