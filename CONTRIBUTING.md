# Contributing

Thank you for your interest in improving **Batata Ou Não**.

This project is a Foundry VTT module focused on real client-side performance diagnostics. Changes should be defensive, measurable, and safe for existing worlds.

---

## Development setup

Clone the repository and work on a feature branch:

```bash
git checkout -b feat/my-change
```

Do not commit generated release artifacts such as `module.zip`.

---

## Local validation

Before opening a pull request or publishing a release, run:

```bash
node --check scripts/main.js
node --check scripts/api.js
node --check scripts/application.js
node --check scripts/benchmark.js
node --check scripts/journal.js
node --check scripts/quality.js
node --check scripts/granular.js
node --check scripts/monitor.js
node --check scripts/settings.js
node --check scripts/utils.js

node -e "for (const f of ['module.json','languages/pt-BR.json','languages/en.json','languages/es.json','languages/zh-CN.json','languages/ru.json']) { JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('OK', f) }"
```

Recommended manual test in Foundry VTT:

```text
[ ] module installs from the manifest URL
[ ] world opens without console errors
[ ] module settings open
[ ] Batata Ou Não dialog opens
[ ] benchmark runs
[ ] SVG graphs render
[ ] Journal report is created
[ ] quality preset applies
[ ] language files load correctly
[ ] no permanent console spam
```

---

## Code guidelines

- Guard Foundry globals such as `game`, `canvas`, `ui`, `PIXI` and `foundry`.
- Check `canvas.ready` before canvas-dependent work.
- Avoid hooks, tickers or intervals that can be registered more than once.
- Avoid expensive loops per frame.
- Avoid permanent console output; use debug settings for diagnostic logs.
- Treat missing Foundry settings as expected compatibility cases.
- Do not classify unavailable FPS as real `0 FPS`.
- Prefer clear failure states over silent broken behavior.
- Keep user-facing text localized.

---

## Release rules

This project uses GitHub releases with two release assets:

- `module.json`
- `module.zip`

Rules:

- `module.json.version` must match the Git tag.
- Tags must use `vX.Y.Z`.
- `module.zip` is a release artifact and must not be committed.
- Old releases must not be deleted to fix mistakes.
- Release fixes must be published as a new patch version.
- Do not use destructive Git or GitHub commands unless explicitly approved.

Example:

```bash
# module.json version must be 1.0.10
git tag v1.0.10
git push origin v1.0.10
```

The stable manifest URL must remain:

```text
https://github.com/SoftMissT/FoundryVTT-BatataOuN-o-V2/releases/latest/download/module.json
```

---

## Pull request checklist

```text
[ ] JS syntax check passed
[ ] JSON validation passed
[ ] Foundry manual test completed
[ ] README updated if user-facing behavior changed
[ ] CHANGELOG updated
[ ] module.json version changed only when preparing a release
[ ] no generated zip/build artifacts committed
```
