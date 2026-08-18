import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { arkPost } from './ark.ts'
import type { VolcengineOptions } from './ark.ts'

/** One image sent to a vision model: a public URL or a `data:` URI. */
export interface ChatImage {
  url: string
}

interface ArkMessage {
  content?: string
  reasoning_content?: string
}

interface ArkChoice {
  message?: ArkMessage
  finish_reason?: string
}

interface ArkUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface ArkChatResponse {
  model?: string
  choices?: ArkChoice[]
  usage?: ArkUsage
}

/**
 * `volcengine_chat` — call any Volcengine Ark model for a one-shot completion,
 * text or multimodal (vision) when `images` is supplied.
 *
 * Distinct from the driving model: the agent uses this to hand a sub-task to a
 * specific Ark model (a vision model to read an image, a reasoning model for a
 * hard problem, a cheaper model for a trivial rewrite) without switching the
 * whole session's provider.
 *
 * @param options resolves connection facts per call.
 */
export function volcengineChatTool(options: () => VolcengineOptions) {
  return defineTool({
    name: 'volcengine_chat',
    description:
      'Call any Volcengine Ark model for a one-shot completion. Use this to invoke a specific Ark model for a sub-task; the model id may be an Ark model id or an inference endpoint id (ep-xxx). Pass `images` with URLs to send pictures to a vision model.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'The user prompt to send.' },
      images: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: { type: 'string', required: true, description: 'Image URL (http/https) or data: URI.' },
          },
        },
        description: 'Optional images to send to a vision model.',
      },
      model: { type: 'string', description: 'Ark model id or endpoint id (ep-xxx); defaults to the configured chatModel.' },
      system: { type: 'string', description: 'Optional system prompt.' },
      maxTokens: { type: 'number', description: 'Optional maximum output tokens.' },
      temperature: { type: 'number', description: 'Optional sampling temperature.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          reasoning: { type: 'string' },
          model: { type: 'string', required: true },
          finishReason: { type: 'string' },
          usage: {
            type: 'object',
            additionalProperties: false,
            properties: {
              promptTokens: { type: 'number' },
              completionTokens: { type: 'number' },
              totalTokens: { type: 'number' },
            },
          },
        },
      },
      render: (_args, value) => {
        const blocks: ContentBlock[] = []
        if (value.reasoning) blocks.push({ type: 'text', text: `[reasoning]\n${value.reasoning}` })
        blocks.push({ type: 'text', text: value.text })
        return blocks
      },
    },
    async execute(args, exec) {
      const opt = options()
      const model = args.model ?? opt.chatModel
      if (!model) throw new Error('dsh-volcengine: no model selected; pass `model` or configure chatModel')

      const messages: Array<{ role: string; content: string | unknown[] }> = []
      if (args.system) messages.push({ role: 'system', content: args.system })

      const images = args.images ?? []
      if (images.length > 0) {
        const parts: unknown[] = [{ type: 'text', text: args.prompt }]
        for (const image of images) parts.push({ type: 'image_url', image_url: { url: image.url } })
        messages.push({ role: 'user', content: parts })
      } else {
        messages.push({ role: 'user', content: args.prompt })
      }

      const body: Record<string, unknown> = { model, messages, stream: false }
      if (args.maxTokens !== undefined) body.max_tokens = args.maxTokens
      if (args.temperature !== undefined) body.temperature = args.temperature

      const data = await arkPost<ArkChatResponse>({
        baseURL: opt.baseURL,
        apiKey: opt.apiKey,
        path: '/chat/completions',
        body,
        signal: exec.signal,
      })
      const choice = data.choices?.[0] ?? {}
      const message = choice.message ?? {}

      return {
        text: message.content ?? '',
        ...(message.reasoning_content ? { reasoning: message.reasoning_content } : {}),
        model: data.model ?? model,
        ...(choice.finish_reason ? { finishReason: choice.finish_reason } : {}),
        ...(data.usage
          ? {
              usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              },
            }
          : {}),
      }
    },
  })
}
