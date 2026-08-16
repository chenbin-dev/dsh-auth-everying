# dsh-auth-everying

`dsh-auth-everying` 是 DeepSeek Harness 插件，用于导入本地编程平台的登录状态和供应商配置，并控制哪些已导入模型出现在 DSH 模型选择器中。

## 功能

- 导入本地 Claude、Codex、Grok、Gemini、Copilot、OpenCode 和 CC Switch 配置。
- 为兼容的官方供应商提供 OAuth 登录。
- 通过 `/v1/models` 或 `/models` 从 OpenAI 兼容的 CC Switch 网关发现模型。
- 按 Codex 软件提供 `low`、`medium`、`high`、`xhigh` 和 `max` 推理等级，并保持请求值不变；CC Switch Codex 路由隐藏不兼容的 `minimal`。
- 使用 `medium` 作为明确的 Codex 默认等级，避免 DSH 额外显示 `Default` 提供商默认项。
- 仅对声明或已知支持 `ultra` 的模型显示该等级；不支持推理的模型不会显示 `ultra`。
- 保留 Codex 配置中的 `model_reasoning_effort`，每个等级均按同名请求值发送，包括 `ultra`。
- 支持 Windows 环境下的安装和构建。

## 使用条件

- 已安装 DeepSeek Harness，并且 PowerShell 或终端可以直接执行 `dsh`。
- 使用 `web` profile，因为插件设置页面由 DSH Web 界面提供。
- 只有从源码构建时才需要 Node.js 22.19 或更高版本。

## 安装

npm 包发布后，普通用户可以直接使用包名安装：

```sh
dsh plugin --profile web add dsh-auth-everying
```

在首次 npm 版本发布之前，请直接从公开 GitHub 仓库安装：

在 PowerShell 或终端执行：

```sh
dsh plugin --profile web add github:chenbin-dev/dsh-auth-everying
dsh web
```

包名安装和 GitHub 仓库安装是两种不同的分发方式。仅将项目开源到 GitHub，并不会自动发布 npm 包。

如果 DSH 已经在运行，安装或更新插件后请重启 `dsh web`，确保加载新的插件构建产物。

## 首次使用

1. 打开 DSH Web 界面，进入 **设置 > dsh-auth-everying**。
2. 在 **来源** 中选择要导入的本地登录或供应商配置。
3. 执行导入并等待扫描完成。
4. 在 **已导入** 中启用需要在 DSH 使用的模型。
5. 新建对话或刷新模型选择器。

插件会读取 CC Switch、Codex、Claude、Grok、Gemini 和 OpenCode 等常见位置的本地配置。无需把 API Key 复制到项目文件或 README 中。

## 命令行

查看可用来源和已导入路由：

```sh
dsh plugin --profile web exec dsh-auth-everying status
```

先查看 `status` 输出，再按来源 ID 导入：

```sh
dsh plugin --profile web exec dsh-auth-everying import live:codex-auth live:grok-auth
```

不同本地配置可能产生不同的来源 ID，请以 `status` 输出为准。

## 常见问题

### 设置中没有显示插件

确认安装命令已经成功完成，停止正在运行的 `dsh web`，再重新启动。同时确认安装命令使用的是 `web` profile。

### 导入后的路由没有模型

打开插件设置并重新扫描来源。对于 CC Switch 的 OpenAI 兼容供应商，请确认网关可访问，并支持 `/v1/models` 或 `/models`。当网关无法返回模型列表时，插件仍会保留配置中的默认模型。

### 推理等级与供应商不一致

对于 CC Switch Codex 路由，选择器与 Codex 软件一致，显示 `low`、`medium`、`high`、`xhigh` 和 `max`，隐藏 `minimal`。插件使用 `medium` 作为明确默认等级，因此 DSH 不会额外显示 `Default` 提供商默认项。`ultra` 按具体模型判断：插件优先读取网关返回的推理能力；网关没有能力字段时，仅对已知的 GPT-5.6 Codex 别名启用。图片模型、自动审查模型等不支持该等级的模型不会显示 `ultra`。每个等级均按同名请求值发送。

### Windows 安装或启动失败

从源码构建时使用 Node.js 22.19 或更高版本；安装插件后重启 DSH；并确认执行插件命令的终端能够找到 `dsh` 命令。

## 开发

```sh
git clone https://github.com/chenbin-dev/dsh-auth-everying.git
cd dsh-auth-everying
npm ci
npm run check
```

`npm run check` 会依次执行 TypeScript 检查、测试和生产构建。

不要提交认证文件、本地数据库、API Key、Token、证书或 `.env` 文件。测试夹具只能使用占位凭据。

## 许可证

Apache-2.0，详见 [LICENSE](LICENSE)。

项目仓库：<https://github.com/chenbin-dev/dsh-auth-everying>
