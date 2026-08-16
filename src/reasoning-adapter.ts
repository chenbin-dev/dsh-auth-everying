import { LlmAdapter, LlmError, ReasoningEffortId, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'

const ULTRA = ReasoningEffortId('ultra')
const PI_XHIGH = ReasoningEffortId('xhigh')

/** Add the provider-specific `ultra` option while retaining pi-ai's standard levels. */
export class CodexReasoningAdapter extends LlmAdapter {
  constructor(
    private readonly standard: PiAiAdapter,
    private readonly ultra: PiAiAdapter,
    private readonly ultraRoutes: ReadonlySet<string>,
  ) {
    super()
  }

  providerInfo(provider: string): LlmProviderInfo {
    return this.standard.providerInfo(provider)
  }

  providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return this.standard.providerRetryPolicy(provider)
  }

  listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.standard.listModels(provider)
  }

  async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const resolved = await this.standard.resolveModel(provider, model, signal)
    const reasoning = resolved.reasoning
    if (!this.ultraRoutes.has(provider) || reasoning === undefined) return resolved
    if (reasoning.efforts.some(effort => effort.id === ULTRA)) return resolved
    return {
      ...resolved,
      reasoning: {
        ...reasoning,
        efforts: [...reasoning.efforts, { id: ULTRA, name: 'Ultra' }],
      },
    }
  }

  /** Route `ultra` through a model descriptor whose xhigh slot sends the ultra wire value. */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.reasoningEffort !== ULTRA) return this.standard.stream(options)
    if (!this.ultraRoutes.has(options.provider)) {
      throw new LlmError(
        `provider "${options.provider}" model "${options.model}" does not support reasoning effort "ultra"`,
        'UNSUPPORTED_REASONING_EFFORT',
      )
    }
    return this.ultra.stream({ ...options, reasoningEffort: PI_XHIGH })
  }
}
