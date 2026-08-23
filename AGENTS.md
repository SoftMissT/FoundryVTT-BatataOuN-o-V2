# AGENTS.md Batata Ou Nao

## Missao real

Este projeto e um modulo Foundry VTT v14+ para otimizacao real de performance no cliente.

O objetivo NAO e apenas trocar texto, README ou release.
O objetivo e medir FPS/GPU/capacidades WebGL, aplicar presets seguros e permitir controles granulares de recursos pesados do Foundry.

## Regras inegociaveis

1. **Nunca** deletar releases, tags ou assets existentes sem aprovacao explicita do operador.
2. **Nunca** usar `gh release delete`, `git push --delete`, `git tag -d`, `git push --force` ou comandos equivalentes.
3. **Nunca** alterar `module.json` sem sincronizar:
   - `version`
   - tag GitHub
   - release GitHub
   - `module.zip`
   - asset `module.json`
4. Toda release deve preservar historico. Corrigir release = nova versao patch.
5. Toda mudanca de performance precisa ter evidencia:
   - antes/depois
   - FPS medio
   - cenario testado
   - preset usado
6. O modulo deve continuar instalavel pelo Foundry usando:
   `https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json`
7. Codigo Foundry deve ser defensivo:
   - checar `canvas.ready`
   - nao quebrar se `canvas`, `game`, `PIXI` ou settings nao existirem
   - evitar loops custosos por frame
8. Logs de debug devem ser controlaveis. Nada de spam permanente no console.
9. O agente deve propor plano antes de modificar release, workflow ou manifest.

## Arquivos sensiveis

- `module.json`
- `.github/workflows/release.yml`
- `scripts/quality.js`
- `scripts/monitor.js`
- `scripts/benchmark.js`
- `scripts/granular.js`
- `scripts/settings.js`
- `scripts/api.js`

## Definition of Done

Uma mudanca so esta pronta quando:

- `module.json` tem versao correta.
- `module.zip` contem `module.json`, `scripts/`, `styles/`, `templates/`, `languages/` e `LICENSE`.
- A release correspondente existe.
- A URL `/releases/latest/download/module.json` responde com a versao correta.
- O modulo instala no Foundry.
- O README descreve comportamento real, nao promessa.
