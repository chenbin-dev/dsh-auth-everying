# dsh-everything-oauth

把本机 coding 平台的登录态和配置 key 导入 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，不用再登一遍。

扫描路径对齐 [CC Switch](https://github.com/farion1231/cc-switch)：

- `~/.cc-switch/cc-switch.db`（Claude / Codex / Gemini / OpenCode 供应商，含 DeepSeek、Kimi）
- `~/.claude/settings.json` 与 macOS 钥匙串 `Claude Code-credentials`
- `~/.codex/auth.json`
- `~/.grok/auth.json`、`~/.grok/config.toml`
- `~/.config/opencode/opencode.json`
- `~/.gemini/.env`
- 进程环境变量

安装：

```sh
dsh plugin --profile web add github:kam74515-boop/dsh-everything-oauth
dsh web
```

打开 **设置 → Everything OAuth**：

1. **来源列表** — 勾选要导入的本机登录态 / key
2. **导入配置** — 只启用你要用的模型

没导入、没启用的模型不会出现在对话的模型选择器。
