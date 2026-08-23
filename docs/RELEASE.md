# RELEASE.md — Protocolo de Publicacao

## Fluxo correto

1. Editar `module.json` → bump version
2. Commit: `git commit -m "v1.0.X: descricao"`
3. Tag: `git tag -a v1.0.X -m "v1.0.X"`
4. Push: `git push origin main && git push origin v1.0.X`
5. Workflow cria release automaticamente
6. NUNCA deletar release anterior

## Regra de ouro

**Corrigir release = nova versao patch.**

Nunca:
- Editar assets de release existente
- Deletar releases
- Deletar tags
- Force push

## Validacao

Apos push, checar:
- `gh release view v1.0.X` → assets module.json + module.zip
- URL `/releases/latest/download/module.json` → versao correta
- Foundry instala e carrega modulo

## Rollback

Se uma release quebrou:
1. Criar nova release com fix
2. NUNCA deletar a quebrada
3. Documentar o que deu errado em CHANGELOG.md
