<p align="center">
  <img src="assets/banner.webp" alt="Batata Ou Não" width="100%">
</p>

<h1 align="center">Batata Ou Não</h1>

<p align="center">
  <strong>Real client-side performance diagnostics for Foundry VTT.</strong>
</p>

<p align="center">
  <a href="https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest">
    <img src="https://img.shields.io/github/v/release/SoftMissT/FoundryVTT-BatataOuN-o-V2?label=release" alt="Latest release">
  </a>
  <img src="https://img.shields.io/badge/Foundry%20VTT-v13.350%20%E2%86%92%20v14.999-orange" alt="Foundry VTT compatibility">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license">
</p>

<p align="center">
  <a href="#english">English</a> ·
  <a href="#português-brasil">Português Brasil</a>
</p>

---

# English

## About

**Batata Ou Não** is a Foundry VTT module that benchmarks the current client, detects likely rendering bottlenecks, and recommends safer visual presets.

It measures the canvas, checks WebGL/GPU information, estimates scene weight, and helps users choose a quality profile that better matches their machine.

## Features

- Real client-side benchmark.
- FPS, frametime, p95/p99, 1% low FPS, stutter and long-frame metrics.
- GPU and WebGL renderer detection.
- Scene weight estimation.
- Dark diagnostic HUD with SVG performance graphs.
- Quality presets: Potato, Good Potato and Premium.
- Granular visual controls.
- Performance monitor.
- Journal report generation.
- Five languages: English, Português Brasil, Español, 中文（简体）, Русский.

## Compatibility

| Foundry VTT | Status            |
| :---------- | :---------------- |
| v13.350+    | Minimum supported |
| v14.x       | Verified          |
| v15+        | Not verified      |

## Installation

In Foundry VTT:

1. Open **Add-on Modules**.
2. Click **Install Module**.
3. Paste this manifest URL:

```text
https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json
```

4. Enable the module in your world.

## Recommended use

1. Open a real scene from your world.
2. Open **Batata Ou Não** from the module settings.
3. Run the benchmark.
4. Review the score, FPS, frametime, stutter and scene weight.
5. Apply the recommended preset.
6. Adjust granular controls if needed.
7. Generate a Journal report to save the result.

## Quality presets

| Preset      | Intended use                          |
| :---------- | :------------------------------------ |
| Potato      | Weak hardware, laptops, heavy scenes  |
| Good Potato | Balanced default for most users       |
| Premium     | Strong hardware and controlled scenes |

## Known limitations

This module is a diagnostic and tuning layer, not a universal performance fix.

It cannot fully solve oversized maps or videos, too many active modules, excessive lights/walls/tokens/tiles, disabled hardware acceleration, wrong GPU selection by the operating system, network/hosting issues, or heavy automation from game systems and other modules.

## Public API

When the module is loaded, the API is available at:

```js
window.PotatoOrNot;
```

Examples:

```js
// Current quality level
PotatoOrNot.quality;

// Run benchmark
const result = await PotatoOrNot.benchmark(6000);

// Apply quality level
await PotatoOrNot.setQuality(1);

// Create a Journal report from the last benchmark
await PotatoOrNot.createJournalReport();

// Monitor
PotatoOrNot.startMonitor({ autoAdjust: true });
PotatoOrNot.stopMonitor();
PotatoOrNot.monitor;

// GPU / WebGL
PotatoOrNot.getGPU();
PotatoOrNot.getGLInfo();
```

---

# Português Brasil

## Sobre

**Batata Ou Não** é um módulo para Foundry VTT que mede a performance real do cliente, detecta gargalos prováveis de renderização e recomenda presets visuais mais seguros.

Ele mede o canvas, verifica informações de GPU/WebGL, estima o peso da cena e ajuda o usuário a escolher um perfil de qualidade mais adequado para a máquina atual.

## Recursos

- Benchmark real do cliente.
- Métricas de FPS, frametime, p95/p99, 1% low FPS, stutter e frames longos.
- Detecção de GPU e renderer WebGL.
- Estimativa de peso da cena.
- HUD dark de diagnóstico com gráficos SVG.
- Presets de qualidade: Batata, Batata Boa e Premium.
- Controles visuais granulares.
- Monitor de performance.
- Geração de relatório no Journal.
- Cinco idiomas: English, Português Brasil, Español, 中文（简体）, Русский.

## Compatibilidade

| Foundry VTT | Status           |
| :---------- | :--------------- |
| v13.350+    | Mínimo suportado |
| v14.x       | Verificado       |
| v15+        | Não verificado   |

## Instalação

No Foundry VTT:

1. Abra **Add-on Modules**.
2. Clique em **Install Module**.
3. Cole a URL do manifesto:

```text
https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json
```

4. Ative o módulo no mundo.

## Uso recomendado

1. Abra uma cena real do seu mundo.
2. Abra **Batata Ou Não** nas configurações do módulo.
3. Rode o benchmark.
4. Verifique score, FPS, frametime, stutter e peso da cena.
5. Aplique o preset recomendado.
6. Ajuste controles granulares se necessário.
7. Gere um relatório no Journal para salvar o resultado.

## Presets de qualidade

| Preset     | Uso recomendado                                |
| :--------- | :--------------------------------------------- |
| Batata     | Hardware fraco, notebook ou cena pesada        |
| Batata Boa | Perfil equilibrado para a maioria dos usuários |
| Premium    | Hardware forte e cenas controladas             |

## Limitações conhecidas

Este módulo é uma camada de diagnóstico e ajuste, não uma solução universal de performance.

Ele não resolve sozinho mapas ou vídeos grandes demais, excesso de módulos ativos, excesso de luzes/paredes/tokens/tiles, aceleração por hardware desligada, sistema operacional usando a GPU errada, problemas de rede/hospedagem ou automações pesadas de sistemas e outros módulos.

## API pública

Quando o módulo estiver carregado, a API fica disponível em:

```js
window.PotatoOrNot;
```

Exemplos:

```js
// Nível de qualidade atual
PotatoOrNot.quality;

// Rodar benchmark
const result = await PotatoOrNot.benchmark(6000);

// Aplicar nível de qualidade
await PotatoOrNot.setQuality(1);

// Criar relatório Journal do último benchmark
await PotatoOrNot.createJournalReport();

// Monitor
PotatoOrNot.startMonitor({ autoAdjust: true });
PotatoOrNot.stopMonitor();
PotatoOrNot.monitor;

// GPU / WebGL
PotatoOrNot.getGPU();
PotatoOrNot.getGLInfo();
```

---

## License / Licença

MIT
