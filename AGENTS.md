# Repository Guidelines

## Project Structure & Module Organization

This repository contains a WXT Manifest V3 browser extension and ASP.NET Core SignalR backend. Extension entrypoints live in `entrypoints/` for popup, dashboard, content scripts, background, and offscreen pages. Shared TypeScript code lives in `src/`: `app/` wires entrypoints, `entities/` holds domain models, `features/` holds use cases, `platforms/` contains marketplace adapters/parsers, and `shared/` contains browser, DOM, parsing, network, and storage helpers. Static assets are in `public/`. Tests mirror ownership under `tests/src/`, `tests/entrypoints/`, and `tests/e2e/`; fixtures and helpers are in `tests/fixtures/` and `tests/support/`. Backend code is under `server/src/`, with tests in `server/tests/Rasid.Server.Tests/`.

## Build, Test, and Development Commands

- `npm run dev:chrome` / `npm run dev:firefox`: start WXT development builds for each browser.
- `npm run build`: build Chrome and Firefox MV3 outputs into `dist/`.
- `npm test`: run test typechecking, Vitest unit tests, and Vitest integration tests.
- `npm run test:e2e:chrome` / `npm run test:e2e:firefox`: run browser smoke tests; Firefox also builds, lints with `web-ext`, and runs Firefox-specific Vitest checks.
- `npm run release:check`: run the full extension release gate.
- `dotnet restore server/src/Rasid.Server.sln --locked-mode`: restore backend packages from lock files.
- `dotnet build server/src/Rasid.Server.sln -c Release --no-restore`: build the backend.
- `dotnet test server/src/Rasid.Server.sln -c Release --no-build`: run backend xUnit tests.

## Coding Style & Naming Conventions

Use TypeScript ESM and keep modules within the existing `src/entities`, `src/features`, `src/platforms`, and `src/shared` boundaries. Follow `.editorconfig` and Prettier: UTF-8, LF, 4-space indentation, single quotes, semicolons, trailing commas, and 100-column wrapping. Run `npm run format:check`, `npm run lint`, or `npm run lint:fix` before broad changes. Backend targets `net10.0` with nullable references enabled.

## Testing Guidelines

Name TypeScript tests `*.test.ts` for Vitest and `*.spec.ts` for Playwright. Keep tests deterministic: do not call live marketplaces, AI providers, ChatGPT, or external SignalR services; use fixtures, fakes, and Playwright route fulfillment. Place new tests near the matching area, for example `tests/src/platforms/khamsat/adapter.test.ts`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits such as `fix(manifest): ...`, `ci(release): ...`, `docs(release): ...`, and `style(format): ...`. Keep subjects imperative and scoped when useful. Pull requests should describe the change, list checks run, link issues, and include screenshots or recordings for visible popup/dashboard/content-script changes. Note backend configuration or release-impacting changes explicitly.

## Security & Configuration Tips

Do not commit secrets or generated build output. For backend overrides, copy `server/src/appsettings.example.json` to ignored `server/src/appsettings.json`; replace `AdminToken` for non-local environments and avoid permissive CORS in production.
