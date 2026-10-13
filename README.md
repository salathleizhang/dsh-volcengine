# dsh-volcengine

DeepSeek Harness 的火山引擎（Volcano Engine / 火山方舟 Ark）插件组合包（bundle）。一个项目，两件事：

1. **调用模型** —— 通过 `cordis.patch.yml` 把内置的 `@deepseek-ai/dsh-llm-pi-ai` 配出三条 provider 路由，让火山方舟的模型进入模型选择器，直接驱动 agent：

   | 路由 | 计费 | Base URL | 内容 |
   |---|---|---|---|
   | `volcengine` | 按量付费（后付费） | `https://ark.cn-beijing.volces.com/api/v3` | 完整 chat 模型目录（DeepSeek / GLM / 豆包） |
   | `volcengine-agent-plan` | Agent Plan 订阅（AFP 抵扣） | `https://ark.cn-beijing.volces.com/api/plan/v3` | 全模态 + Harness 套餐的文本模型目录 |
   | `volcengine-coding` | Coding Plan 订阅 | `https://ark.cn-beijing.volces.com/api/coding/v3` | 编程模型目录 + 控制台托管的 `ark-code-latest`（Auto） |

2. **调用具体服务** —— 挂载本包自带的工具插件，用裸 `fetch` 调方舟的 OpenAI 兼容端点：

| 工具 | 作用 | 端点 |
|---|---|---|
| `volcengine_chat` | 调用任意方舟模型做一次性补全（文本 / 推理 / 多模态视觉） | `POST /chat/completions` |
| `volcengine_image_generate` | 文生图（豆包 Seedream / 即梦） | `POST /images/generations` |

`volcengine_chat` 传 `images: [{ url }]` 即可把图片发给视觉模型（`url` 支持 http/https 或 `data:` URI）：豆包 Seed 多模态系列（如 `doubao-seed-2-1-pro-260628`）或 DeepSeek V4.1-Flash（`deepseek-v4-1-flash-260910`，原生视觉理解）都可以。工具走按量付费的 `/api/v3`，不吃订阅套餐额度。

## 为什么不用火山官方 SDK

方舟的 chat 与图片生成是 **OpenAI 兼容 + Bearer API Key**，官方自己也是让你用 OpenAI SDK 或直接 HTTP 调。裸 `fetch` 更轻、无签名负担，和 `llm-deepseek` 一致。签名鉴权的服务（语音 TTS/ASR、视频点播等）才需要官方 `@volcengine/openapi`——见下方 roadmap。

## 构建

源码是 TypeScript，用 [tsdown](https://tsdown.dev) 打包成 `lib/index.mjs`。`@deepseek-ai/*` 保持 external，运行时由宿主提供（避免重复拷贝导致的 Symbol 冲突）。

```sh
npm install     # 或 pnpm install
npm run build   # tsdown → lib/index.mjs
npm run typecheck   # tsc --noEmit（可选）
```

`prepare` 脚本就是 `tsdown`，所以 **git 安装会自动构建**；本地 checkout 安装前需先手动 `npm run build`。

## 安装

### 本地 checkout（开发时）

```sh
npm install && npm run build   # 先构建出 lib/index.mjs
dsh plugin --profile web add .
dsh web
```

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:you/dsh-volcengine
```

git 安装会跑 `prepare` 自动构建（pnpm ≥10 首次会要求 `allowBuilds`，按提示把 `dsh-volcengine: true` 写进 profile 的 `pnpm-workspace.yaml` 后重跑）。

### 桌面 App（`desktop` profile）

桌面 App 的插件页只收 npm registry 的包名（`packageNameFromSpec` 直接拒绝 `file:`、路径和 URL），本地 checkout 的 bundle 装不进去，要按 App 自己的校验规则手工装进 `~/.dsh/profiles/desktop`：

1. `npm run build && npm pack`，把 tarball 放进 profile 的 `vendor/`。
2. `package.json`：`dependencies` 必须是**精确版本**（`"dsh-volcengine": "0.3.0"`，即本包 `package.json` 的 `version`；`link:` / `file:` 会被 `projectManifest` 判为非法），`dsh.profile.bundles` 追加 `"dsh-volcengine"`。
3. `pnpm-workspace.yaml` 加 `overrides` 把这个版本指到本地 tarball，再用 App 自带的 node/pnpm 跑一次 `pnpm install --ignore-scripts`；pnpm 会解出 `node_modules/dsh-volcengine` **真目录**（软链会被 `validateDesktopPluginGraph` 拒绝）并生成 `pnpm-lock.yaml`（App 将来重建 profile 时走 `--frozen-lockfile`）。
4. 重启 App 生效。

> 改了内容就要 bump 版本号：lockfile 用 sha512 钉住 tarball，同名覆盖会以 `ERR_PNPM_TARBALL_INTEGRITY` 拒绝（正是 App 重建 profile 走的那条路）。bump 后重新 `npm pack` 并重装，lock 会跟着更新。

> `peerDependencies` 不能写 `"*"`：App 用 `semver.satisfies` 校验，prerelease 宿主（`0.1.0-rc.20`）不满足 `*`，整个 profile 会被 `requires @deepseek-ai/dsh-tools@*, found 0.1.0-rc.20` 拒绝启动。写 `">=0.1.0-rc.0"`。

> 两个工具从 **`process.env`** 读 key（不吃托管凭据）：把 `ARK_API_KEY=...` 放进 `~/.dsh/.env`（App 启动时按 项目 `.env` > `~/.dsh/.env` 载入）。模型路由走托管凭据，`~/.dsh/.credentials.yaml` 里有 `ARK_API_KEY` 即可。

## 配置

API key 与模型 id 都在 `cordis.patch.yml` 里配置，可用你自己 profile 的 `cordis.patch.yml` 覆盖。三条路由各有一段 `llm-pi-ai.providers` 配置：

```yaml
- id: llm-pi-ai
  config:
    providers:
      volcengine:
        displayName: Volcano Ark
        apiKeyEnv: ARK_API_KEY
        api: openai-completions          # 按量付费路由沿用 chat 协议
        baseURL: https://ark.cn-beijing.volces.com/api/v3
        models: [ ... ]
      volcengine-agent-plan:
        displayName: Volcano Ark Agent Plan
        apiKeyEnv: ARK_API_KEY           # 换成 ARK_AGENT_PLAN_API_KEY 即可用独立密钥
        api: openai-responses
        baseURL: https://ark.cn-beijing.volces.com/api/plan/v3
        models: [ ... ]
      volcengine-coding:
        displayName: Volcano Ark Coding Plan
        apiKeyEnv: ARK_API_KEY           # 换成 ARK_CODING_API_KEY 即可用独立密钥
        api: openai-responses
        baseURL: https://ark.cn-beijing.volces.com/api/coding/v3
        models: [ ... ]
```

- 优先用 `apiKeyEnv` 引用环境变量（不要写死 key）；紧急情况下可写 `apiKey`。
- **一把 key 通吃**：账号级 API Key 在已订阅的每条路由上都能用，所以三条路由默认都读 `ARK_API_KEY`。要分 key 就把对应路由的 `apiKeyEnv` 改成 `ARK_AGENT_PLAN_API_KEY` / `ARK_CODING_API_KEY` 并在启动环境里导出。
- Tool 插件单独有一段 `volcengine` 行，配置 `chatModel` / `imageModel` 和它自己读的 `apiKeyEnv`（默认 `ARK_API_KEY`），`baseURL` 也可用 `ARK_BASE_URL` 覆盖。
- **别串端点**：套餐模型必须走 `/api/plan/v3` 或 `/api/coding/v3`。把套餐模型指到 `/api/v3` 不会消耗套餐额度，而是按量计费；反过来后付费模型走套餐端点会 404/无权限。

### 拿到 API key 与模型 id

1. 打开 [火山方舟控制台](https://console.volcengine.com/ark)，创建 **API Key**。key 是账号级的，能否用某条路由取决于账号是否订阅了对应套餐。
2. 想用 Agent Plan：到 [开通管理-Agent Plan](https://ark.volcengine.com/region:cn-beijing/subscription/agent-plan) 订阅；专属入口也见 [Agent Plan 活动页](https://www.volcengine.com/activity/agentplan)。
3. 想用 Coding Plan：到[方舟 Coding Plan 活动页](https://www.volcengine.com/activity/codingplan)订阅。
4. 模型 id 用本包预填的 **Model Name**（`deepseek-v4.1-flash` 这类），也可以换成控制台里的 **接入点 ID**（形如 `ep-2024xxxxxxxx-xxxxx`）。
5. 套餐端点会随账号订阅状态变化：没订阅 Agent Plan 时用普通 key 请求 `/api/plan/v3` 会返回 `AuthenticationError`（"The API key or AK/SK in the request is missing or invalid"），而不是模型错误——先去订套餐。

### 官方文档

- [Agent Plan 个人版 · DeepSeek Harness 接入](https://www.volcengine.com/docs/82379/2637928)
- [Coding Plan 个人版 · DeepSeek Harness 接入](https://www.volcengine.com/docs/82379/2637930)
- [Agent Plan 套餐概览（支持模型及 Harness）](https://www.volcengine.com/docs/82379/2366394)
- [Coding Plan 套餐概览（支持的模型）](https://www.volcengine.com/docs/82379/1925114)

## 支持的模型

`cordis.patch.yml` 预填了火山方舟各品牌当前 SOTA 模型，三条路由分开。下面两张套餐表里的每一项都用真实 key 在 `/api/coding/v3` 上逐个验过（模型 id 可用、`maxTokens` 不超过该模型接受的 `max_completion_tokens` 上限、声明为多模态的模型接受 `image_url` 输入）。

### `volcengine` — 按量付费 `/api/v3`（完整 chat 模型目录）

| 品牌 | 模型 ID | 名称 | 上下文 | 输入 |
|---|---|---|---|---|
| DeepSeek 深度求索 | `deepseek-v4-1-flash-260910` | DeepSeek-V4.1-Flash | 1M | 文本 + 图片 |
| DeepSeek 深度求索 | `deepseek-v4-pro-ga-260813` | DeepSeek-V4-Pro | 1M | 文本 |
| DeepSeek 深度求索 | `deepseek-v4-flash-ga-260731` | DeepSeek-V4-Flash | 1M | 文本 |
| 智谱 Zhipu | `glm-5-2-260617` | GLM-5.2 | 1M | 文本 |
| 智谱 Zhipu | `glm-5-3-flash-260828` | GLM-5.3-Flash | 1M | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2-1-pro-260628` | Doubao-Seed-2.1-Pro | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2-1-turbo-260628` | Doubao-Seed-2.1-Turbo | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-evolving` | Doubao-Seed-Evolving | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2-0-pro-260215` | Doubao-Seed-2.0-Pro | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2-0-lite-260428` | Doubao-Seed-2.0-Lite | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2-0-mini-260428` | Doubao-Seed-2.0-Mini | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2-0-code-preview-260215` | Doubao-Seed-2.0-Code | 262K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-1-8-251228` | Doubao-Seed-1.8 | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-1-6-251015` | Doubao-Seed-1.6 | 256K | 文本 |
| 豆包 Doubao | `doubao-seed-1-6-flash-250828` | Doubao-Seed-1.6-Flash | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-1-6-vision-250815` | Doubao-Seed-1.6-Vision | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-character-260628` | Doubao-Seed-Character | 256K | 文本 + 图片 |

按量付费路由的 id 带日期（随方舟上下架会变），**务必换成你账号里实际可用的 id / 接入点 `ep-xxx`**。

### `volcengine-agent-plan` — 方舟 Agent Plan `/api/plan/v3`

订阅套餐，按 Agent 燃料值（AFP）抵扣。全部 13 个文本模型如下（`kimi-k3` 与 Computer Use Agent 仅 Medium 及以上套餐可用，其余 Small 起就有）：

| 品牌 | 模型 ID | 名称 | 上下文 | 最大输出 | 输入 |
|---|---|---|---|---|---|
| DeepSeek 深度求索 | `deepseek-v4.1-flash` | DeepSeek-V4.1-Flash | 1M | 384K | 文本 + 图片 |
| DeepSeek 深度求索 | `deepseek-v4-pro` | DeepSeek-V4-Pro | 1M | 384K | 文本 |
| DeepSeek 深度求索 | `deepseek-v4-flash` | DeepSeek-V4-Flash | 1M | 384K | 文本 |
| 智谱 Zhipu | `glm-5.3` | GLM-5.3 | 1M | 128K | 文本 |
| 智谱 Zhipu | `glm-5.3-flash` | GLM-5.3-Flash | 1M | 128K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k3` | Kimi-K3 | 1M | 128K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k2.8-preview` | Kimi-K2.8-Preview | 1M | 128K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k2.7-code` | Kimi-K2.7-Code | 256K | 32K | 文本 + 图片 |
| MiniMax 稀宇 | `minimax-m3` | MiniMax-M3 | 1M | 128K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-evolving` | Doubao-Seed-Evolving | 1M | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2.1-pro` | Doubao-Seed-2.1-Pro | 1M | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2.1-lite` | Doubao-Seed-2.1-Lite | 1M | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2.0-mini` | Doubao-Seed-2.0-Mini | 256K | 128K | 文本 + 图片 |

套餐还带图片生成（`doubao-seedream-5-0-pro`）、视频生成（`doubao-seedance-2.0` / `2.0-fast` / `2.0-mini` / `2.5`，Large 起）、向量化（`doubao-embedding-vision`）、语音（`doubao-seed-tts-2.0` / `doubao-seed-asr-2.0`）和 Harness（专业数据集、豆包搜索、Agent 记忆等）。这些不是 chat 模型，模型选择器驱动不了；图片生成可用本文的 `volcengine_image_generate`（走按量付费），其余需要另接端点。

### `volcengine-coding` — 方舟 Coding Plan `/api/coding/v3`

与 Agent Plan 同一批文本模型 id，外加控制台托管的 `ark-code-latest`：

| 品牌 | 模型 ID | 名称 | 上下文 | 最大输出 | 输入 |
|---|---|---|---|---|---|
| DeepSeek 深度求索 | `deepseek-v4.1-flash` | DeepSeek-V4.1-Flash | 1M | 384K | 文本 + 图片 |
| DeepSeek 深度求索 | `deepseek-v4-pro` | DeepSeek-V4-Pro | 1M | 384K | 文本 |
| DeepSeek 深度求索 | `deepseek-v4-flash` | DeepSeek-V4-Flash | 1M | 384K | 文本 |
| 智谱 Zhipu | `glm-5.3` | GLM-5.3 | 1M | 128K | 文本 |
| 智谱 Zhipu | `glm-5.3-flash` | GLM-5.3-Flash | 1M | 128K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k3` | Kimi-K3 | 1M | 128K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k2.8-preview` | Kimi-K2.8-Preview | 1M | 128K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k2.7-code` | Kimi-K2.7-Code | 256K | 32K | 文本 + 图片 |
| MiniMax 稀宇 | `minimax-m3` | MiniMax-M3 | 1M | 128K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-evolving` | Doubao-Seed-Evolving | 1M | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2.1-pro` | Doubao-Seed-2.1-Pro | 1M | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2.1-lite` | Doubao-Seed-2.1-Lite | 1M | 256K | 文本 + 图片 |
| 豆包 Doubao | `doubao-seed-2.0-mini` | Doubao-Seed-2.0-Mini | 256K | 128K | 文本 + 图片 |
| 控制台托管 | `ark-code-latest` | Ark Code Auto | 256K | 128K | 文本 |

> `ark-code-latest` 是「你在开通管理里选定的模型 / Auto 模式」的别名，背后的模型会变，所以它的容量按保守值声明；要固定行为就直接选具体模型 id。

### API 协议与思考开关

- **协议**：两条套餐路由用 `api: openai-responses`（Ark 官方 DeepSeek Harness 文档就是这份配置，且 Ark 建议编程场景用 Responses，推理效果更好）。方舟在这两个 Base URL 上同时提供 `/responses` 和 `/chat/completions`，想换成 chat 协议就把该路由的 `api` 改成 `openai-completions`。另外这两条路由还有 Anthropic 兼容根地址（`/api/plan`、`/api/coding`），可配 `api: anthropic-messages`，本包默认不启用。
- **思考开关默认不配**：本包所有模型都**不声明 `reasoningEfforts`**，系统提示走 `system` 角色，模型在方舟侧按各自默认行为思考（`deepseek-v4-pro` / `v4.1-flash` / `glm-5.3` / `kimi-k3` 默认就开思考）。实测原因：一旦声明思考等级，用户选「off」时 pi-ai 会发 `thinking: {type: "disabled"}`，而 `glm-5.3`、`glm-5.3-flash`、`kimi-k2.7-code` 会返回 `thinking.type 'disabled' is not supported by this model`。
- 想给某个模型开思考控制，在该模型下加：

  ```yaml
  - id: deepseek-v4.1-flash
    reasoningEfforts: { off: disabled, high: high }
    compat: { thinkingFormat: deepseek, supportsDeveloperRole: false }
  ```

  这样 pi-ai 会发方舟原生的 `thinking: {type: enabled|disabled}` 和 `reasoning_effort`。方舟现在也接受 `developer` 角色（13 个模型实测都通过，旧版本 README 里「方舟不支持 developer 角色」的结论已过时），`supportsDeveloperRole: false` 只是保险。

## 模型选择

安装后，模型选择器里会出现 `Volcano Ark`（按量付费）、`Volcano Ark Agent Plan`、`Volcano Ark Coding Plan` 及上述路由里的模型；会话里切过去即可让 agent 用火山模型。想设为默认模型，改 `agent-default-model` 行或直接在 Web 模型页选择。

## Roadmap（方舟其它能力，暂未接工具）

方舟除了 chat 模型，还有这些能力，本插件目前只接了 chat + 文生图：

- **文生图（Seedream / 即梦）** —— 已有 `volcengine_image_generate`；新模型如 `doubao-seedream-5-0-pro-260628`、`doubao-seedream-4-5-251128` 可直接传 `model` 使用。Agent Plan 也含图片生成额度，但需要把工具指向 `/api/plan/v3`（本包工具默认走按量付费）。
- **视频生成（Seedance）** —— `seedance 2.0 / 2.0-fast / 2.5` 等；Agent Plan 的 Large / Max 套餐含视频额度。
- **Embeddings** —— `doubao-embedding-large-text`、`doubao-embedding-vision-251215`；Agent Plan 含 `doubao-embedding-vision`。
- **Rerank** —— `jina-reranker`、`bge-reranker-v2-m3` 等。
- **语音合成 / 识别（TTS / ASR）** —— 走豆包语音 WebSocket V3 + appid/access token，需引入官方 `@volcengine/openapi`；Agent Plan 的语音模型走 `/api/plan/v3`。

这些需要各自新增工具（`/embeddings`、`/rerank`、视频/语音端点等），需要的话可以按需加。

## 上传到 GitHub

```sh
cd dsh-volcengine
git init
git add .
git commit -m "init: dsh-volcengine bundle"
git branch -M main
git remote add origin https://github.com/<you>/dsh-volcengine.git
git push -u origin main
```

然后别人（或你自己换机器）就能用 `dsh plugin --profile web add github:<you>/dsh-volcengine` 安装。

## 许可

MIT
