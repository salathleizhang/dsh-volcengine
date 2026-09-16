# dsh-volcengine

DeepSeek Harness 的火山引擎（Volcano Engine / 火山方舟 Ark）插件组合包（bundle）。一个项目，两件事：

1. **调用模型** —— 通过 `cordis.patch.yml` 把内置的 `@deepseek-ai/dsh-llm-pi-ai` 配出两条 provider 路由，让火山方舟的模型进入模型选择器，直接驱动 agent：`volcengine`（按量付费 `/api/v3`，DeepSeek / GLM / 豆包 Doubao）与 `volcengine-coding`（方舟 Coding Plan `/api/coding/v3`，Kimi / MiniMax / GLM）。
2. **调用具体服务** —— 挂载本包自带的工具插件，用裸 `fetch` 调方舟的 OpenAI 兼容端点：

| 工具 | 作用 | 端点 |
|---|---|---|
| `volcengine_chat` | 调用任意方舟模型做一次性补全（文本 / 推理 / 多模态视觉） | `POST /chat/completions` |
| `volcengine_image_generate` | 文生图（豆包 Seedream / 即梦） | `POST /images/generations` |

`volcengine_chat` 传 `images: [{ url }]` 即可把图片发给视觉模型（`url` 支持 http/https 或 `data:` URI）：豆包 Seed 多模态系列（如 `doubao-seed-2-1-pro-260628`）或 DeepSeek V4.1-Flash（`deepseek-v4-1-flash-260910`，原生视觉理解）都可以。

## 为什么不用火山官方 SDK

方舟的 chat 与图片生成是 **OpenAI 兼容 + Bearer API Key**，官方自己也是让你用 OpenAI SDK 或直接 HTTP 调。裸 `fetch` 更轻、无签名负担，和 `llm-deepseek` 一致。签名鉴权的服务（语音 TTS/ASR、视频点播等）才需要官方 `@volcengine/openapi`——见下方 roadmap。

## 构建

源码是 TypeScript，用 [tsdown](https://tsdown.dev) 打包成 `lib/index.js`。`@deepseek-ai/*` 保持 external，运行时由宿主提供（避免重复拷贝导致的 Symbol 冲突）。

```sh
npm install     # 或 pnpm install
npm run build   # tsdown → lib/index.js
npm run typecheck   # tsc --noEmit（可选）
```

`prepare` 脚本就是 `tsdown`，所以 **git 安装会自动构建**；本地 checkout 安装前需先手动 `npm run build`。

## 安装

### 本地 checkout（开发时）

```sh
npm install && npm run build   # 先构建出 lib/index.js
dsh plugin --profile web add .
dsh web
```

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:you/dsh-volcengine
```

git 安装会跑 `prepare` 自动构建（pnpm ≥10 首次会要求 `allowBuilds`，按提示把 `dsh-volcengine: true` 写进 profile 的 `pnpm-workspace.yaml` 后重跑）。

## 配置

API key 与模型 id 都在 `cordis.patch.yml` 的 `volcengine` 行里配置，可用你自己 profile 的 `cordis.patch.yml` 覆盖：

```yaml
- id: volcengine
  config:
    apiKeyEnv: ARK_API_KEY       # 存放 API key 的环境变量名
    baseURL: https://ark.cn-beijing.volces.com/api/v3
    chatModel: deepseek-v4-pro-ga-260813
    imageModel: doubao-seedream-4-0-250828
```

- 优先用 `apiKeyEnv` 引用环境变量（不要写死 key）；紧急情况下可写 `apiKey`。
- `ARK_API_KEY` 在启动环境中导出即可；`baseURL` 也可用 `ARK_BASE_URL` 覆盖。
- Coding Plan 路由（Kimi / MiniMax）用独立的 `ARK_CODING_API_KEY`，见下方「支持的模型」。

### 拿到 API key 与模型 id

1. 打开 [火山方舟控制台](https://console.volcengine.com/ark)，开通模型、创建 **API Key**（按量付费路由）。
2. 想用 Kimi / MiniMax，需订阅 [方舟 Coding Plan](https://www.volcengine.com/activity/codingplan)，把 plan 密钥放到 `ARK_CODING_API_KEY`。
3. 模型 id 用控制台里显示的 **模型 ID**，或你创建的 **接入点 ID**（形如 `ep-2024xxxxxxxx-xxxxx`）——两者都能作为 `model` 传。
4. `cordis.patch.yml` 里预填的模型 id 只是示例，**务必换成你账号里实际可用的 id**。

## 支持的模型

`cordis.patch.yml` 预填了火山方舟各品牌当前 SOTA 模型，两条路由分开：

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

### `volcengine-coding` — 方舟 Coding Plan `/api/coding/v3`

Kimi / MiniMax / GLM 只通过 Coding Plan 订阅提供（需单独的 plan 密钥）：

| 品牌 | 模型 ID | 名称 | 上下文 | 输入 |
|---|---|---|---|---|
| Kimi 月之暗面 | `kimi-k2.6` | Kimi-K2.6 | 262K | 文本 + 图片 |
| Kimi 月之暗面 | `kimi-k2.7-code` | Kimi-K2.7-Code | 262K | 文本 + 图片 |
| MiniMax 稀宇 | `minimax-m3` | MiniMax-M3 | 512K | 文本 + 图片 |
| 智谱 Zhipu | `glm-5.3-flash` | GLM-5.3-Flash | 1M | 文本 + 图片 |

> 模型 id 只是示例，**务必换成你账号里实际可用的 id / 接入点 `ep-xxx`**（尤其按量付费路由，模型随方舟上下架会变）。

> **为什么不给模型配「思考」开关？** 方舟的 chat 接口只接受 `system/assistant/user/tool` 四种消息角色，而 pi-ai 对推理型模型会把系统提示当 `developer` 角色发送，方舟会回 `400 InvalidParameter`。所以本插件的模型一律按**非推理模型**声明：系统提示走 `system` 角色（正常可用），模型在方舟侧仍按各自默认行为出结果（推理内容照常在 `reasoning_content` 返回）。这是方舟 + pi-ai 的已知限制，等方舟支持 `developer` 角色后可放开思考开关。

## 模型选择

安装后，模型选择器里会出现 `Volcano Ark`、`Volcano Ark Coding Plan` 及上述路由里的模型；会话里切过去即可让 agent 用火山模型。想设为默认模型，改 `agent-default-model` 行或直接在 Web 模型页选择。

## Roadmap（方舟其它能力，暂未接工具）

方舟除了 chat 模型，还有这些能力，本插件目前只接了 chat + 文生图：

- **文生图（Seedream / 即梦）** —— 已有 `volcengine_image_generate`；新模型如 `doubao-seedream-5-0-pro-260628`、`doubao-seedream-4-5-251128` 可直接传 `model` 使用。
- **视频生成（Seedance）** —— `seedance 2.0 / 2.0-fast / 2.5` 等。
- **Embeddings** —— `doubao-embedding-large-text`、`doubao-embedding-vision-251215`。
- **Rerank** —— `jina-reranker`、`bge-reranker-v2-m3` 等。
- **语音合成 / 识别（TTS / ASR）** —— 走豆包语音 WebSocket V3 + appid/access token，需引入官方 `@volcengine/openapi`。

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
