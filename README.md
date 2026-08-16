# dsh-auth-everying

`dsh-auth-everying` is a DeepSeek Harness plugin for importing local coding-platform login state and provider configuration. It lets you choose which imported models appear in the DSH model picker.

## Features

- Imports local Claude, Codex, Grok, Gemini, Copilot, OpenCode, and CC Switch configuration.
- Supports OAuth login for compatible official providers.
- Discovers models from OpenAI-compatible CC Switch gateways through `/v1/models` or `/models`.
- Exposes Codex `minimal`, `low`, `medium`, `high`, `xhigh`, and `max` levels for every model on a CC Switch Codex route.
- Preserves the configured Codex `model_reasoning_effort`. DSH displays Codex `ultra` as `xhigh` and keeps the `ultra` gateway alias when that dialect is configured.
- Supports Windows installation and build workflows.

## Requirements

- A working DeepSeek Harness installation with the `dsh` command available in PowerShell or a terminal.
- A web profile, because the settings panel is provided by the DSH web interface.
- Node.js 22.19 or later only when building the project from source.

## Install

After the package is published to npm, the shortest installation command is:

```sh
dsh plugin --profile web add dsh-auth-everying
```

Until the first npm release is published, install directly from the public GitHub repository:

Run these commands in PowerShell or a terminal:

```sh
dsh plugin --profile web add github:chenbin-dev/dsh-auth-everying
dsh web
```

The package name and the GitHub repository are different distribution channels. Publishing the repository does not by itself publish the npm package.

If DSH is already running, restart `dsh web` after installing or updating the plugin so the new bundle is loaded.

## First-Time Setup

1. Open the DSH web interface and go to **Settings > dsh-auth-everying**.
2. In **Sources**, select the local login or provider configuration to import.
3. Click the import action and wait for the scan to finish.
4. In **Imported**, enable the models that should be available in DSH.
5. Start a new conversation or refresh the model picker.

The plugin reads local configuration from common locations, including CC Switch, Codex, Claude, Grok, Gemini, and OpenCode. It does not require copying API keys into the project or into the README.

## CLI

Show available sources and imported routes:

```sh
dsh plugin --profile web exec dsh-auth-everying status
```

Import sources by ID after checking `status`:

```sh
dsh plugin --profile web exec dsh-auth-everying import live:codex-auth live:grok-auth
```

Use the source IDs reported by `status` when your local installation exposes different IDs.

## Troubleshooting

### The plugin does not appear in Settings

Confirm that the install command completed successfully, stop the existing `dsh web` process, and start it again. Also verify that the command uses the `web` profile.

### The imported route has no models

Open the plugin settings and run the source scan again. For a CC Switch OpenAI-compatible provider, confirm that its gateway is reachable and supports either `/v1/models` or `/models`. The configured default model is retained when the gateway does not provide a model list.

### The reasoning levels do not match the provider

For CC Switch Codex routes, every model exposes `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`. The configured `model_reasoning_effort` is retained as provider metadata rather than incorrectly limiting the selector to one level. When the gateway uses the Codex `ultra` dialect, DSH `xhigh` and `max` are sent as `ultra`.

### Windows installation or startup fails

Use Node.js 22.19 or later for source builds, restart DSH after installation, and ensure the `dsh` command is available in the same terminal where the plugin command is run.

## Development

```sh
git clone https://github.com/chenbin-dev/dsh-auth-everying.git
cd dsh-auth-everying
npm ci
npm run check
```

`npm run check` runs TypeScript checks, tests, and the production build.

Do not commit authentication files, local databases, API keys, tokens, certificates, or `.env` files. Test fixtures must use placeholder credentials only.

## License

Apache-2.0. See [LICENSE](LICENSE).

Project repository: <https://github.com/chenbin-dev/dsh-auth-everying>
