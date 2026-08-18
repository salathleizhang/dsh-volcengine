/**
 * Minimal Volcengine Ark client for the OpenAI-compatible bearer endpoints.
 *
 * Ark's chat-completions and image-generations endpoints share one API key
 * (`ARK_API_KEY`) and one base URL (`https://ark.cn-beijing.volces.com/api/v3`),
 * authenticated with an `Authorization: Bearer` header. No AK/SK signing is
 * involved, so a thin `fetch` wrapper is enough — the same posture the shipped
 * DeepSeek adapter takes. Signed services (speech, video, ...) would need
 * `@volcengine/openapi` instead.
 */

/** Error raised for any Ark request failure, carrying a stable `code`. */
export class ArkError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ArkError'
    this.code = code
    this.status = status
  }
}

/** The public Ark endpoint, overridable via `baseURL` config or `ARK_BASE_URL`. */
export const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

/** Connection facts resolved per call so a changed key/model reaches the next request. */
export interface VolcengineOptions {
  baseURL: string
  apiKey: string
  chatModel: string
  imageModel: string
}

export interface ArkRequest {
  baseURL: string
  apiKey: string
  path: string
  body: unknown
  signal?: AbortSignal
}

function statusToCode(status: number): string {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400 || status === 422) return 'INVALID_REQUEST'
  if (status >= 500) return 'SERVER'
  return `HTTP_${status}`
}

/**
 * POST JSON to an Ark endpoint and return the parsed response body.
 * @throws {ArkError}
 */
export async function arkPost<T>(input: ArkRequest): Promise<T> {
  const { baseURL, apiKey, path, body, signal } = input
  const res = await fetch(baseURL.replace(/\/+$/, '') + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    let detail = text
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string }
      detail = parsed?.error?.message ?? parsed?.message ?? text
    } catch {
      // Non-JSON error body: keep the raw text.
    }
    throw new ArkError(`Volcengine Ark ${res.status}: ${detail}`, statusToCode(res.status), res.status)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ArkError('Volcengine Ark returned a non-JSON success body', 'MALFORMED_RESPONSE', res.status)
  }
}
