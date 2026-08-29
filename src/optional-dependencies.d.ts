/** Optional runtime dependency used by the text-only structured extractor. */
declare module '@arclabs561/llm-utils' {
  export function extractJSON(response: string): unknown;
  export function callLLM(
    prompt: string,
    provider: string,
    apiKey: string | null,
    options: { tier: 'advanced'; temperature: number; maxTokens: number },
  ): Promise<string>;
}
