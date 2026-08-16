# Changelog

All notable changes to this project are documented in this file.

Package name: `dsh-auth-everying`.

## 0.1.4 - 2026-08-16

### Fixed

- Keep Codex `xhigh` and `max` mapped to their exact wire values.
- Add a separate `ultra` effort for CC Switch Codex routes.
- Send `ultra` only for the `ultra` selector instead of rewriting `xhigh` or `max`.

## 0.1.3 - 2026-08-16

### Fixed

- Expose `minimal`, `low`, `medium`, `high`, `xhigh`, and `max` for every model on a CC Switch Codex route.
- Preserve the configured Codex reasoning effort without rewriting unrelated levels.
- Keep discovered models such as `gpt-5.6-sol` from inheriting the configured model's single effort restriction.

## 0.1.2 - 2026-08-16

### Fixed

- Preserve CC Switch Codex `model_reasoning_effort` for the configured model instead of exposing generic DSH reasoning levels.
- Preserve Codex `ultra` as a provider-specific effort while keeping its gateway value unchanged.
- Migrate already imported CC Switch routes when their model or reasoning metadata is stale.

## 0.1.1 - 2026-08-16

### Fixed

- Parse CC Switch Codex TOML custom-provider settings, including the default model, gateway URL, and Responses wire API.
- Discover models from OpenAI-compatible `/v1/models` and `/models` endpoints while preserving configured path prefixes.
- Refresh previously imported CC Switch Codex routes whose model lists were empty.
- Declare runtime dependencies so plugin installation does not rely on optional peer installation.
- Avoid Windows lifecycle failures by removing build-on-install and using `npx.cmd` when the build helper is invoked manually.

### Tests

- Cover CC Switch Codex TOML parsing and OpenAI-compatible model-list endpoint construction.
