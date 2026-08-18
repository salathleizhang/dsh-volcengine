# dsh-volcengine

DeepSeek Harness 的火山引擎（Volcano Engine / 火山方舟 Ark）插件组合包（bundle）。一个项目，两件事：

1. **调用模型** —— 通过 `cordis.patch.yml` 把内置的 `@deepseek-ai/dsh-llm-pi-ai` 配出一条 `volcengine` provider 路由，让火山方舟的模型（DeepSeek / 豆包 Doubao）进入模型选择器，直接驱动 agent。
2. **调用具体服务** —— 挂载本包自带的工具插件，用裸 `fetch` 调方舟的 OpenAI 兼容端点：

| 工具 | 作用 | 端点 |
|---|---|---|
| `volcengine_chat` | 调用任意方舟模型做一次性补全（文本 / 推理 / 多模态视觉） | `POST /chat/completions` |
| `volcengine_image_generate` | 文生图（豆包 Seedream / 即梦） | `POST /images/generations` |

`volcengine_chat` 传 `images: [{ url }]` 即可把图片发给视觉模型（`url` 支持 http/https 或 `data:` URI），模型用豆包 vision 系列（如 `doubao-1-5-vision-pro-32k-250115`）。

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
    chatModel: deepseek-v3-250324
    imageModel: doubao-seedream-4-0-250828
```

- 优先用 `apiKeyEnv` 引用环境变量（不要写死 key）；紧急情况下可写 `apiKey`。
- `ARK_API_KEY` 在启动环境中导出即可；`baseURL` 也可用 `ARK_BASE_URL` 覆盖。

### 拿到 API key 与模型 id

1. 打开 [火山方舟控制台](https://console.volcengine.com/ark)，开通模型、创建 **API Key**。
2. 模型 id 用控制台里显示的 **模型 ID**，或你创建的 **接入点 ID**（形如 `ep-2024xxxxxxxx-xxxxx`）——两者都能作为 `model` 传。
3. `cordis.patch.yml` 里预填的模型 id 只是示例，**务必换成你账号里实际可用的 id**。

## 模型选择

安装后，模型选择器里会出现 `Volcano Ark` 及上述路由里的模型；会话里切过去即可让 agent 用火山模型。想设为默认模型，改 `agent-default-model` 行或直接在 Web 模型页选择。

## Roadmap

- **语音合成 / 识别（TTS / ASR）** —— 走豆包语音 WebSocket V3 + appid/access token，届时引入官方 `@volcengine/openapi`。
- **视频生成（Seedance）**、**Rerank**、**Embeddings** 等按需加工具。

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
