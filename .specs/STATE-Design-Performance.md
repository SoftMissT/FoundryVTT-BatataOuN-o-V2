---
title: "Batata Ou Não — Design e performance da HUD"
created: "2026-10-03"
last_updated: "2026-10-03"
status: active
type: spec
agents_allowed: ["ALL"]
---

# Design e performance da HUD

## Objetivo

Melhorar a leitura e a responsividade da HUD sem trocar o contrato do benchmark, dos presets ou da API pública.

## Escopo

- Consolidar tokens, responsividade e estados de foco/hover/reduced-motion no CSS.
- Preservar imagens, gráficos, controles granulares e exportações existentes.
- Evitar listeners duplicados em re-render e reduzir trabalho de atualização da HUD.
- Manter compatibilidade declarada com Foundry v13.350–v14.999.

## Critérios de aceitação

- A HUD permanece operável por mouse, teclado e leitores de tela.
- Cards de protocolo continuam como radiogroup com foco roving.
- Cada render liga no máximo um conjunto de handlers ao root da HUD.
- O loop vivo não cria intervalos ou hooks duplicados.
- CSS não usa `transition: all`, não remove foco e não força overflow horizontal.
- Testes estáticos, sintaxe e diff check passam; QA visual/runtime Foundry fica explicitamente separado.

## Fora de escopo

- Alterar versão, tag, release ou manifest.
- Prometer ganho de FPS sem benchmark antes/depois em cenário real.
- Alterar permissões GM/jogador.

## Fontes

- Context7: Foundry VTT v14 `ApplicationV2`, `HandlebarsApplicationMixin`, `renderApplicationV2` e `canvasReady`.
- Direção visual existente do módulo; WCAG 2.2 AA como piso de acessibilidade.
