# dsh-everything-oauth

Import local coding-platform logins into [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) without signing in again.

Scans the same places [CC Switch](https://github.com/farion1231/cc-switch) cares about:

| Source | What is imported |
| --- | --- |
| `~/.cc-switch/cc-switch.db` | Claude / Codex / Gemini / OpenCode providers (DeepSeek, Kimi, official, …) |
| `~/.claude/settings.json` | `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` |
| macOS Keychain `Claude Code-credentials` | Claude subscription OAuth |
| `~/.codex/auth.json` | ChatGPT / Codex OAuth or `OPENAI_API_KEY` |
| `~/.grok/auth.json` + `config.toml` | SuperGrok OAuth and custom model keys |
| `~/.config/opencode/opencode.json` | OpenCode providers |
| `~/.gemini/.env` | `GEMINI_API_KEY` |
| process env | `ANTHROPIC_*`, `OPENAI_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY` |

Official routes: `claude-oauth`, `codex-oauth`, `grok-oauth`, `gemini-oauth`, `copilot-oauth`. CC Switch gateways become `everything-*` custom routes (Anthropic-compatible or OpenAI-compatible).

## Install

```sh
dsh plugin --profile web add github:kam74515-boop/dsh-everything-oauth
dsh web
```

Then **Settings → Everything OAuth**:

1. **Sources** — select local logins / keys
2. **Imported** — enable only the models you want in the picker

CLI:

```sh
dsh plugin --profile web exec dsh-everything-oauth status
dsh plugin --profile web exec dsh-everything-oauth import live:codex-auth live:grok-auth
```

Source files are read-only. OAuth refresh later may rotate tokens and sign the original CLI out.

Discoverable via the GitHub [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic.

## License

Apache-2.0
