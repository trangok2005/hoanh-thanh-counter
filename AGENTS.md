# Hoành Thánh Counter - Agent Instructions

## Run
```bash
python -m http.server 8000
# open http://localhost:8000
```
No build, no runtime deps. Pure ES modules. Deploy-ready for GitHub Pages
(relative paths, `.js` extensions, `.nojekyll` at repo root).

## Test
```bash
node --test tests/*.test.js
```
Tests cover pure logic only (domain, report formatter, parser, prompt, retry,
errors, storage). No install needed.

## Architecture
- **js/main.js** — composition root only, wires everything, no logic
- **js/config.js** — CATEGORIES, METRICS, MENU (12 items), REPORT_GROUPS,
  PAYMENT_CHANNELS, REPORT_FORMAT, AI_CONFIG, storage keys, constants
- **js/domain/** — `quantity.js`, `validateConfig.js`, `Order.js`, `Report.js`,
  `calculate.js`, `reportFormatter.js` (no DOM, no ui/ai/storage imports)
- **js/storage/** — `LocalStorageRepository.js` (+ ReportStorageRepository),
  `StatePersistence.js`, `SaveState.js`
- **js/ai/** — `providers.js`, `tasks/OrderScanTask.js`, `parser.js`, `image.js`,
  `retry.js`, `ScanService.js`, `errors.js`
- **js/ui/** — dom helpers, Tabs, views, dialogs (render + events only)
- **js/app/ScanController.js** — orchestrates scan flow (token + abort)

Dependency direction:
```
ui → (dom, config)
app → ai, domain
ai → domain, config
storage → config
domain → config (no ai/ui/storage, no DOM)
main.js wires everything
```

## Key Conventions
- `StatePersistence` depends only on `{ load, save }`; repositories are generic.
- `ScanService` receives `{ provider, task, menu, categories }`; provider returns
  raw text, task builds prompt and parses it. Adding a scan type = add a task.
- Adding menu items: edit `MENU` in `config.js` (include `category`,
  `reportGroup`, `aliases`). Order, totals, prompt, parser, report auto-adapt.
- Adding metrics: edit `METRICS` + `yields`; `calculateOrder` is generic.
- Adding payment channels / report groups: edit `PAYMENT_CHANNELS` /
  `REPORT_GROUPS`; report UI and text formatter auto-adapt.
- Adding AI provider: extend `VisionProvider`/`OpenAICompatibleProvider`, add to
  `REGISTRY`, update `createProvider(...)` in `main.js`.
- Report text format lives in one place: `domain/reportFormatter.js`.

## Environment
- `.env` holds API keys (gitignored)
- OpenRouter endpoint/models in `AI_CONFIG`

## Gotchas
- API key lives only in RAM (`main.js:103`), never persisted or logged.
- `Order` uses pub/sub; subscribe before bootstrap.
- Order persistence payload is `{ version: 1, servings: {...} }`; debounce 10ms.
- Report persistence debounce 250ms; key `hoanh-thanh-counter:report:v1`.
- Storage migration: only version 1 supported, else returns null.
- `Order.getTotals()` counts only categories with `hasYields: true`; use
  `order.isEmpty()` for hints/reset/merge decisions.
- Tabs use `#dem-mon` / `#bao-cao`; tab buttons id `tab-btn-*`, panels `tab-*`.
- Tests mock `localStorage` globally.
