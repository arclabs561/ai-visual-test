/** Video-native VLM reviews built on the shared provider and output contracts. */

import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { VLLMJudge } from '#judge';
import { FileError, ProviderError, TimeoutError, ValidationError } from './errors.mjs';
import { createReviewTask, type ReviewOutcome } from '#review-contract';
import { resolveTaskStructuredOutput } from '#structured-output';
import { executeStructuredTask } from '#structured-task';
import type { ConfigOptions, ValidationContext, ValidationResult } from './public-contract.js';
import type {
  ProviderAdapter,
  ProviderConfig,
  ProviderContent,
  ProviderVideoMime,
  StructuredOutputSpec,
} from '#provider-adapters';

const DEFAULT_MAX_MB = 9;
const DEFAULT_MAX_TOKENS = 16_000;
const DEFAULT_TRANSCODE: VideoTranscodeOptions = { scale: '640:-2', fps: 10, crf: 32 };
const VIDEO_MIMES: ReadonlySet<ProviderVideoMime> = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
/** One retry is enough for a contract repair; do not turn malformed output into a loop. */
const MAX_VIDEO_RETRIES = 1;

export interface VideoInputEntry {
  path: string;
  label?: string;
  mime?: ProviderVideoMime;
}

export type VideoInput = string | string[] | VideoInputEntry[];

export interface VideoTranscodeOptions {
  scale: string;
  fps: number;
  crf: number;
}

export interface VideoJudgeOptions extends ConfigOptions {
  maxMB?: number;
  /** Aggregate source payload limit for a multi-video request. Defaults to maxMB. */
  maxTotalMB?: number;
  transcode?: Partial<VideoTranscodeOptions>;
}

export interface VideoContext extends ValidationContext {
  maxTokens?: number;
  /** Number of provider attempts, including the first. Retained for compatibility. */
  attempts?: number;
  /** Number of bounded retries for transport or output-contract failures. */
  maxRetries?: number;
  retryBaseDelay?: number;
  retryMaxDelay?: number;
  timeout?: number;
  structuredOutput?: boolean;
  legacyOutputFallback?: boolean;
}

interface PreparedVideo {
  path: string;
  label: string;
  mime: ProviderVideoMime;
  sentPath: string;
  temporary: boolean;
}

interface VideoBuildResultInput {
  judgment: string;
  data: Record<string, unknown>;
  logprobs: unknown;
  attempts: number;
  responseTime: number;
  imagePath: string;
  context: VideoContext;
  reviewOutcome: ReviewOutcome;
  outputFormat: string;
  structuredOutput: StructuredOutputSpec;
}

/**
 * The video adapter intentionally declares only the base-judge members it
 * consumes. Runtime inheritance remains VLLMJudge, while emitted public
 * declarations do not expose its legacy JS declaration graph.
 */
interface VideoJudgeBaseInstance {
  provider: string;
  apiKey: string;
  providerConfig: ProviderConfig;
  providerAdapter: ProviderAdapter;
  enabled: boolean;
  config: { performance: { timeout: number } };
  _validateAndSanitizePrompt(prompt: string, context: VideoContext): string;
  _buildResult(input: VideoBuildResultInput): Promise<ValidationResult>;
  judgeScreenshot(imagePath: string | string[], prompt: string, context?: ValidationContext): Promise<ValidationResult>;
}

type VideoJudgeBaseConstructor = new (options: VideoJudgeOptions) => VideoJudgeBaseInstance;
const VideoJudgeBase = VLLMJudge as unknown as VideoJudgeBaseConstructor;

function supportsVideo(provider: string, model: unknown): boolean {
  return provider === 'gemini'
    || (provider === 'openrouter' && typeof model === 'string' && /^google\//.test(model));
}

function mimeFromPath(path: string): ProviderVideoMime {
  switch (extname(path).toLowerCase()) {
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.mov': return 'video/quicktime';
    default: throw new ValidationError('Unsupported video format. Supported: mp4, webm, mov');
  }
}

function finitePositive(value: unknown, name: string, { integer = false }: { integer?: boolean } = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new ValidationError(`${name} must be a finite ${integer ? 'positive integer' : 'positive number'}`);
  }
  return value;
}

function retriesFrom(context: VideoContext): number {
  const requested = context.maxRetries ?? (context.attempts === undefined ? 1 : finitePositive(context.attempts, 'attempts', { integer: true }) - 1);
  if (!Number.isInteger(requested) || requested < 0 || requested > MAX_VIDEO_RETRIES) {
    throw new ValidationError(`maxRetries must be an integer from 0 to ${MAX_VIDEO_RETRIES}`);
  }
  return requested;
}

function transcodeOptions(input: Partial<VideoTranscodeOptions> | undefined): VideoTranscodeOptions {
  const options = { ...DEFAULT_TRANSCODE, ...input };
  if (typeof options.scale !== 'string' || options.scale.trim().length === 0) {
    throw new ValidationError('transcode.scale must be a nonempty string');
  }
  finitePositive(options.fps, 'transcode.fps');
  finitePositive(options.crf, 'transcode.crf');
  return options;
}

function transcode(videoPath: string, params: VideoTranscodeOptions): { path: string; mime: ProviderVideoMime } {
  const output = join(tmpdir(), `aivt-video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp4`);
  const result = spawnSync('ffmpeg', [
    '-y', '-i', videoPath,
    '-c:v', 'libx264', '-crf', String(params.crf), '-preset', 'fast',
    '-vf', `scale=${params.scale},fps=${params.fps}`, '-an', output,
  ], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (result.error || result.status !== 0 || !existsSync(output)) {
    rmSync(output, { force: true });
    const detail = result.error?.message ?? (result.stderr || '').slice(0, 200);
    throw new FileError(`ffmpeg transcode failed. Install ffmpeg or pass an already-small video. ${detail}`, basename(videoPath));
  }
  return { path: output, mime: 'video/mp4' };
}

function cleanupVideos(videos: PreparedVideo[]): void {
  for (const video of videos) {
    if (video.temporary) rmSync(video.sentPath, { force: true });
  }
}

function normaliseInput(input: VideoInput): VideoInputEntry[] {
  const entries = Array.isArray(input)
    ? input.map(entry => typeof entry === 'string' ? { path: entry } : entry)
    : [{ path: input }];
  if (entries.length === 0) throw new ValidationError('At least one video is required');
  return entries;
}

function prepareVideos(
  input: VideoInput,
  maxMB: number,
  maxTotalMB: number,
  params: VideoTranscodeOptions,
  runTranscode: (videoPath: string, options: VideoTranscodeOptions) => { path: string; mime: ProviderVideoMime },
): PreparedVideo[] {
  const prepared: PreparedVideo[] = [];
  let totalBytes = 0;
  try {
    for (const entry of normaliseInput(input)) {
      if (!entry || typeof entry.path !== 'string' || entry.path.trim().length === 0) {
        throw new ValidationError('Every video entry requires a nonempty path');
      }
      const mime = entry.mime ?? mimeFromPath(entry.path);
      if (!VIDEO_MIMES.has(mime)) throw new ValidationError(`Unsupported video MIME type: ${String(entry.mime)}`);
      let stats;
      try {
        stats = statSync(entry.path);
      } catch (error) {
        throw new FileError('Video not found or unreadable', basename(entry.path), { cause: error instanceof Error ? error.message : String(error) });
      }
      if (!stats.isFile()) throw new FileError('Video path must reference a file', basename(entry.path));
      const shouldTranscode = stats.size > maxMB * 1024 * 1024;
      const sent = shouldTranscode ? runTranscode(entry.path, params) : { path: entry.path, mime };
      if (statSync(sent.path).size > maxMB * 1024 * 1024) {
        if (shouldTranscode) rmSync(sent.path, { force: true });
        throw new FileError(`Video remains larger than ${maxMB}MB after preparation`, basename(entry.path));
      }
      totalBytes += statSync(sent.path).size;
      if (totalBytes > maxTotalMB * 1024 * 1024) {
        if (shouldTranscode) rmSync(sent.path, { force: true });
        throw new FileError(`Combined video payload exceeds ${maxTotalMB}MB`, basename(entry.path));
      }
      prepared.push({
        path: entry.path,
        label: typeof entry.label === 'string' && entry.label.trim() ? entry.label : basename(entry.path),
        mime: sent.mime,
        sentPath: sent.path,
        temporary: shouldTranscode,
      });
    }
    return prepared;
  } catch (error) {
    cleanupVideos(prepared);
    throw error;
  }
}

function videoContent(videos: PreparedVideo[]): ProviderContent[] {
  const content: ProviderContent[] = [];
  for (const video of videos) {
    if (videos.length > 1) content.push({ type: 'text', text: `--- Video: ${video.label} ---` });
    content.push({ type: 'video', mime: video.mime, data: readFileSync(video.sentPath).toString('base64') });
  }
  return content;
}

/** Video-native judge with provider-owned payload serialization. */
export class VideoJudge extends VideoJudgeBase {
  readonly maxMB: number;
  readonly maxTotalMB: number;
  readonly transcodeParams: VideoTranscodeOptions;

  constructor(options: VideoJudgeOptions = {}) {
    super(options);
    this.maxMB = finitePositive(options.maxMB ?? DEFAULT_MAX_MB, 'maxMB');
    this.maxTotalMB = finitePositive(options.maxTotalMB ?? this.maxMB, 'maxTotalMB');
    this.transcodeParams = transcodeOptions(options.transcode);
  }

  /** Override in a controlled environment when ffmpeg is supplied externally. */
  protected transcodeVideo(videoPath: string, options: VideoTranscodeOptions): { path: string; mime: ProviderVideoMime } {
    return transcode(videoPath, options);
  }

  async judgeVideo(input: VideoInput, prompt: string, context: VideoContext = {}): Promise<ValidationResult> {
    if (!supportsVideo(this.provider, this.providerConfig?.model)) {
      throw new ProviderError(
        `Video input is not supported on provider '${this.provider}'. Supported: gemini (direct), openrouter with a google/* model.`,
        this.provider,
        { retryable: false },
      );
    }
    if (!this.enabled) throw new ProviderError('Video provider is disabled', this.provider, { retryable: false, failureKind: 'disabled' });

    const safePrompt = this._validateAndSanitizePrompt(prompt, context);
    const maxTokens = finitePositive(context.maxTokens ?? DEFAULT_MAX_TOKENS, 'maxTokens', { integer: true });
    const maxRetries = retriesFrom(context);
    const videos = prepareVideos(input, this.maxMB, this.maxTotalMB, this.transcodeParams, (path, options) => this.transcodeVideo(path, options));
    const task = createReviewTask('scalar', context.legacyOutputFallback !== false);
    const structuredOutput = resolveTaskStructuredOutput({
      provider: this.provider,
      model: this.providerConfig.model,
      taskName: task.name,
      schema: task.schema,
      enabled: context.structuredOutput !== false,
    });
    const fullPrompt = `${safePrompt}\n\nOUTPUT CONTRACT\nReturn only JSON matching this schema:\n${JSON.stringify(structuredOutput.schema)}`;
    const timeout = context.timeout ?? this.config.performance.timeout;
    finitePositive(timeout, 'timeout', { integer: true });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    let attempts = 0;

    try {
      const timedOut = new Promise<never>((_, reject) => {
        const rejectTimeout = () => reject(new TimeoutError(
          `Video API call timed out after ${timeout}ms`, timeout, { provider: this.provider, attempts: attempts || 1 },
        ));
        if (controller.signal.aborted) rejectTimeout();
        else controller.signal.addEventListener('abort', rejectTimeout, { once: true });
      });
      const execution = executeStructuredTask<ReviewOutcome>({
        adapter: this.providerAdapter,
        call: {
          content: videoContent(videos),
          signal: controller.signal,
          apiKey: this.apiKey,
          config: this.providerConfig,
          maxOutputTokens: maxTokens,
        },
        prompt: fullPrompt,
        task,
        structuredOutput,
        maxRetries,
        // A retry cannot spend longer sleeping than the entire request deadline.
        baseDelay: Math.min(context.retryBaseDelay ?? 0, timeout),
        maxDelay: Math.min(context.retryMaxDelay ?? 0, timeout),
        onAttempt: attempt => { attempts = attempt; },
      });
      const result = await Promise.race([execution, timedOut]);
      return await this._buildResult({
        judgment: result.judgment,
        data: result.data,
        logprobs: result.logprobs,
        attempts: result.attempts,
        responseTime: Date.now() - started,
        imagePath: videos.map(video => video.path).join('|'),
        context,
        reviewOutcome: result.outcome,
        outputFormat: result.format,
        structuredOutput: result.structuredOutput,
      });
    } catch (error) {
      if (error instanceof TimeoutError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Video API call timed out after ${timeout}ms`, timeout, { provider: this.provider, attempts: attempts || 1 });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupVideos(videos);
    }
  }
}

/** Convenience wrapper for one video review. */
export async function judgeVideo(input: VideoInput, prompt: string, options: VideoJudgeOptions & VideoContext = {}): Promise<ValidationResult> {
  const judge = new VideoJudge(options);
  return judge.judgeVideo(input, prompt, options);
}
