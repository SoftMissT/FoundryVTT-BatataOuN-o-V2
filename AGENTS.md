# AGENTS.md Batata Ou Não

## Missão real

Este projeto é um módulo Foundry VTT v14+ para otimização real de performance no cliente.

O objetivo NÃO é apenas trocar texto, README ou release.

O objetivo é medir FPS/GPU/capacidades WebGL, aplicar presets seguros e permitir controles granulares de recursos pesados do Foundry.

## Regras inegociáveis

1. **Nunca** deletar releases, tags ou assets existentes sem aprovação explícita do operador.

2. **Nunca** usar comandos destrutivos sem aprovação explícita:
   - `gh release delete`
   - `git push --delete`
   - `git tag -d`
   - `git push --force`
   - comandos equivalentes

3. **Nunca** alterar a versão em `module.json` sem sincronizar:
   - `version`
   - tag GitHub
   - release GitHub
   - asset `module.json`
   - asset `module.zip`

4. Toda release deve preservar histórico. Corrigir release = nova versão patch.

5. Toda mudança de performance precisa ter critério de verificação:
   - antes/depois quando possível
   - FPS médio quando aplicável
   - cenário testado
   - preset usado
   - impacto esperado

6. O módulo deve continuar instalável pelo Foundry usando:

   `https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json`

7. Código Foundry deve ser defensivo:
   - checar `canvas.ready` quando depender do canvas
   - não quebrar se `canvas`, `game`, `PIXI` ou settings não existirem
   - evitar loops custosos por frame
   - evitar hooks/tickers duplicados
   - evitar spam permanente no console

8. Logs de debug devem ser controláveis por setting ou flag interna.

9. O agente deve propor plano antes de modificar:
   - release
   - tag
   - workflow
   - manifest
   - versão do módulo

## Arquivos sensíveis

- `module.json`
- `.github/workflows/release.yml`
- `.gitignore`
- `scripts/quality.js`
- `scripts/monitor.js`
- `scripts/benchmark.js`
- `scripts/granular.js`
- `scripts/settings.js`
- `scripts/api.js`

## Definition of Done mudança comum

Uma mudança comum só está pronta quando:

- O código alterado tem objetivo claro.
- O README não promete comportamento inexistente.
- O módulo não quebra se APIs do Foundry estiverem ausentes.
- Logs de debug não fazem spam permanente.
- Nenhum artefato gerado foi commitado por acidente.
- `module.zip` não está versionado no Git.

## Definition of Done release

Uma release só está pronta quando:

- `module.json` tem a versão correta.
- A tag corresponde à versão de `module.json`.
- A release correspondente existe.
- A release contém os assets:
  - `module.json`
  - `module.zip`
- `module.zip` contém:
  - `module.json`
  - `scripts/`
  - `styles/`
  - `templates/`
  - `languages/`
  - `LICENSE`
- A URL `/releases/latest/download/module.json` responde com a versão correta.
- O módulo instala no Foundry.
