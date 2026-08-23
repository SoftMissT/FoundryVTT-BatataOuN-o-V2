# PLAN.md — Iteracao Atual

## Objetivo

Estabilizar o repositorio para que releases funcionem automaticamente via tag push.

## Tarefas

### Concluido
- [x] Fase 0.5: .gitignore hardenado
- [x] Fase 1: AGENTS.md com governance
- [x] Fase 2: Workflow tag-triggered
- [x] Fase 3: module.json v1.0.5
- [x] Fase 4: Docs GSD (STATE, SPEC, PERFORMANCE, RELEASE, ROADMAP, PLAN)

### Pendente
- [ ] Fase 5: Commit + tag v1.0.5 + push
- [ ] Teste: workflow cria release corretamente
- [ ] Teste: Foundry instala via manifest URL

## Criterio de sucesso

- Nenhuma release/tag apagada
- module.json version sincronizada com tag
- Workflow valida versao antes de publicar
- Release v1.0.5 criada com module.json + module.zip
- URL `/releases/latest/download/module.json` responde
