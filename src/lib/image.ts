import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { arkPost } from './ark.ts'
import type { VolcengineOptions } from './ark.ts'

interface ArkImageItem {
  url?: string
  b64_json?: string
}

interface ArkImageResponse {
  model?: string
  data?: ArkImageItem[]
}

/**
 * `volcengine_image_generate` — text-to-image via Ark's OpenAI-compatible
 * `/images/generations` endpoint (Doubao Seedream / 即梦 models).
 *
 * @param options resolves connection facts per call.
 */
export function volcengineImageTool(options: () => VolcengineOptions) {
  return defineTool({
    name: 'volcengine_image_generate',
    description:
      'Generate images from a text prompt using a Volcengine Ark image model (Doubao Seedream / 即梦). Returns image URLs.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Text prompt describing the image.' },
      model: { type: 'string', description: 'Ark image model id; defaults to the configured imageModel.' },
      size: { type: 'string', description: 'Image size, e.g. "1024x1024".' },
      n: { type: 'number', description: 'Number of images, 1 to 4 (default 1).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          images: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { url: { type: 'string', required: true } },
            },
          },
          model: { type: 'string', required: true },
        },
      },
      render: (_args, value) => value.images.map((img): ContentBlock => ({ type: 'text', text: img.url })),
    },
    async execute(args, exec) {
      const opt = options()
      const model = args.model ?? opt.imageModel
      if (!model) throw new Error('dsh-volcengine: no image model selected; pass `model` or configure imageModel')

      const n = args.n ?? 1
      if (!Number.isInteger(n) || n < 1 || n > 4) {
        throw new Error('dsh-volcengine: n must be an integer between 1 and 4')
      }

      const body: Record<string, unknown> = { model, prompt: args.prompt, response_format: 'url', n }
      if (args.size) body.size = args.size

      const data = await arkPost<ArkImageResponse>({
        baseURL: opt.baseURL,
        apiKey: opt.apiKey,
        path: '/images/generations',
        body,
        signal: exec.signal,
      })
      const images = (data.data ?? []).map((item) => ({ url: item.url ?? item.b64_json ?? '' }))
      return { images, model: data.model ?? model }
    },
  })
}
