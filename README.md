# Batata Ou Não

**Batata Ou Não** é um módulo para Foundry VTT focado em **diagnóstico e ajuste real de performance do cliente**.

Ele não promete milagre. Ele mede o estado do canvas, identifica gargalos prováveis e aplica perfis de qualidade mais seguros para reduzir custo de renderização em cenas pesadas.

> Reescrito a partir do conceito do PotatoOrNot para uma versão mais prática, com benchmark, monitoramento e presets granulares para Foundry VTT moderno.

---

## Objetivo

Foundry VTT roda sobre canvas WebGL. Mesmo em uma máquina forte, uma cena pode ficar pesada por causa de:

* muitos efeitos de luz;
* visão dinâmica;
* animações de token/luz;
* mapas ou vídeos grandes;
* módulos com hooks pesados;
* assets não otimizados;
* aceleração por hardware desligada;
* navegador ou Windows usando a GPU errada.

Este módulo existe para ajudar o usuário a responder:

> "Meu Foundry está rodando bem ou está virando batata?"

---

## Status do projeto

Este módulo está em fase de estabilização.

Prioridades atuais:

* corrigir o monitor de FPS em tempo real;
* tornar o benchmark resistente quando `canvas.fps.render` não estiver disponível;
* validar settings core antes de aplicar;
* evitar hooks/tickers duplicados;
* melhorar a documentação de release;
* impedir releases/tags quebradas.

---

## O que o módulo faz

### Benchmark

O benchmark coleta informações do ambiente gráfico e tenta medir FPS real do canvas.

Ele considera:

* GPU detectada via WebGL;
* renderer WebGL;
* capacidades como textura máxima e renderbuffer;
* FPS médio durante uma janela de teste;
* qualidade recomendada para o cliente atual.

Se o FPS não puder ser medido de forma confiável, o módulo informa isso claramente. `0 FPS` não é tratado como diagnóstico real de performance — o painel mostra **"FPS indisponível"** e nenhuma recomendação é gerada sem medição válida.

---

### Monitor de Performance

O monitor acompanha o FPS do canvas durante a sessão.

Objetivo do monitor:

* mostrar FPS atual;
* mostrar FPS médio;
* detectar queda persistente;
* sugerir ou aplicar downgrade de qualidade;
* evitar ajuste agressivo a cada frame;
* manter cooldown entre mudanças.

O monitor é leve: um único ticker callback, publicação de amostra no máximo 1x por segundo, sem spam no console e sem rerender da interface a cada frame.

---

### Presets de Qualidade

O módulo trabalha com três perfis:

| Perfil     | Uso recomendado                       | Intenção                                  |
| ---------- | ------------------------------------- | ----------------------------------------- |
| Batata     | hardware fraco, notebook, cena pesada | reduzir custo visual ao máximo            |
| Batata Boa | maioria dos usuários                  | equilíbrio entre qualidade e estabilidade |
| Premium    | máquina forte e cena controlada       | manter qualidade alta                     |

Os presets atuam sobre configurações de performance do Foundry, como:

* modo de performance;
* FPS máximo;
* sombras suaves;
* mipmap;
* MSAA;
* SMAA;
* animações de luz;
* animações de visão;
* modo fotosensível quando aplicável.

Settings que não existirem na versão do Foundry são **pulados com segurança** — o módulo nunca quebra por setting ausente.

---

## Controles Granulares

Cada usuário pode ajustar recursos individuais.

| Controle           | Impacto esperado                      |
| ------------------ | ------------------------------------- |
| Sombras suaves     | reduz custo de luzes e blur           |
| MSAA               | reduz custo de antialiasing           |
| SMAA               | reduz custo de antialiasing           |
| Mipmap             | altera tratamento de texturas em zoom |
| Animações de luz   | reduz custo de efeitos animados       |
| Animações de visão | reduz custo de atualização visual     |
| FPS máximo         | limita consumo de CPU/GPU             |
| Modo fotosensível  | reduz flashes e efeitos agressivos    |

Os controles granulares refletem o **estado real aplicado no cliente** — o valor mostrado é lido diretamente das settings do Foundry, não de defaults internos.

---

## O que este módulo NÃO faz

Este módulo não substitui boas práticas de otimização de world.

Ele não consegue resolver sozinho:

* mapas gigantes em PNG;
* vídeos enormes;
* dezenas de módulos pesados ativos;
* cenas com excesso de paredes, luzes e tokens;
* navegador sem aceleração por hardware;
* Windows usando GPU integrada em vez da dedicada;
* problemas de rede ou upload do host;
* sistema de jogo com automações muito pesadas.

Use o módulo como diagnóstico e camada de ajuste, não como cura universal.

---

## Checklist de otimização real

Antes de culpar o hardware, verifique:

* [ ] Aceleração por hardware está ativa no navegador ou app Foundry.
* [ ] Windows está usando a GPU dedicada para o Foundry/browser.
* [ ] O mundo foi testado com módulos desativados.
* [ ] A cena usa assets WebP/WebM quando possível.
* [ ] Vídeos foram exportados com FPS e bitrate razoáveis.
* [ ] Luzes animadas foram reduzidas.
* [ ] Visão dinâmica foi testada em cena pesada.
* [ ] O FPS máximo foi limitado para clientes fracos.
* [ ] O monitor do Batata Ou Não mostra FPS real, não "0" por falha de medição.

---

## Instalação

No Foundry VTT:

1. Abra **Add-on Modules**.
2. Clique em **Install Module**.
3. Cole a URL do manifesto:

```text
https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json
```

4. Ative o módulo no mundo.

---

## Uso

Abra o painel do módulo nas configurações.

Fluxo recomendado:

1. Abra uma cena real da sua mesa.
2. Rode o benchmark.
3. Verifique FPS atual e FPS médio.
4. Aplique o preset recomendado.
5. Teste movimento, visão, luzes e animações.
6. Ajuste controles granulares se necessário.
7. Compare antes/depois.

---

## API pública

Quando o módulo estiver carregado, a API fica disponível em:

```js
window.PotatoOrNot
```

Exemplos:

```js
// Nível atual
PotatoOrNot.quality

// Aplicar qualidade
await PotatoOrNot.setQuality(1)

// Rodar benchmark
const result = await PotatoOrNot.benchmark(3000)

// Monitor
PotatoOrNot.startMonitor({ autoAdjust: true })
PotatoOrNot.stopMonitor()
PotatoOrNot.monitor

// GPU / WebGL
PotatoOrNot.getGPU()
PotatoOrNot.getGLInfo()
```

---

## Hooks

| Hook                           | Quando                        |
| ------------------------------ | ----------------------------- |
| `BatataOuNaoReady`             | módulo terminou inicialização |
| `BatataOuNaoBenchmarkComplete` | benchmark terminou            |
| `BatataOuNaoQualityApplied`    | preset foi aplicado           |
| `BatataOuNaoMonitorTick`       | monitor publicou nova amostra |
| `BatataOuNaoAutoDegrade`       | monitor reduziu qualidade     |
| `BatataOuNaoAutoUpgrade`       | monitor aumentou qualidade    |

---

## Desenvolvimento

Estrutura principal:

```text
scripts/
  main.js          entrada do módulo
  settings.js      registro e leitura de settings
  quality.js       presets de qualidade
  benchmark.js     GPU/WebGL/FPS benchmark
  monitor.js       coleta de FPS e auto-ajuste
  granular.js      controles individuais
  application.js   interface ApplicationV2
  api.js           API pública
  utils.js         helpers defensivos
```

---

## Regras de release

Este projeto usa releases GitHub com assets:

* `module.json`
* `module.zip`

Regras:

* `module.json.version` deve bater com a tag.
* A tag deve seguir `vX.Y.Z`.
* `module.zip` é artefato de release e não deve ser commitado.
* Releases antigas não devem ser apagadas para corrigir erro.
* Correção de release deve gerar nova versão patch.

---

## Licença

MIT
