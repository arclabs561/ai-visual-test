/**
 * Video Adapter — VLM critique on recorded videos.
 *
 * Wraps the screenshot-only judge plumbing to accept videos. Supports two
 * provider paths:
 *
 *   - gemini (direct API): inline_data with mime_type video/mp4|webm
 *   - openrouter routed to google/*: video_url data URL (OpenAI-compatible
 *     payload with a video_url part type that OpenRouter accepts for
 *     video-native upstream models)
 *
 * Auto-transcodes oversized videos via ffmpeg before sending — OpenRouter
 * has been observed to 503 behind Cloudflare with HTML responses for inline
 * payloads above ~10MB base64. Transcoding to scale=640:-2,fps=10,crf=32
 * keeps a 2.5min tour under the cap.
 *
 * Quick start:
 *
 *   import { judgeVideo } from '@arclabs561/ai-visual-test/video';
 *   const result = await judgeVideo('tour.webm', 'Find UI bugs in this tour');
 *   // result: { score, issues, recommendations, judgment }
 *
 *   import { VideoJudge } from '@arclabs561/ai-visual-test/video';
 *   const judge = new VideoJudge({ provider: 'openrouter', model: 'google/gemini-3.1-pro-preview' });
 *   const result = await judge.judgeVideo('tour.webm', 'Critique the CA simulations', {
 *     videos: [{ path: 'light.webm', label: 'light theme' },
 *              { path: 'dark.webm',  label: 'dark theme' }],   // multi-video
 *     maxMB: 9,                                                // override cap
 *     transcode: { scale: '640:-2', fps: 10, crf: 32 },       // override params
 *     maxTokens: 16000,
 *   });
 */

import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { VLLMJudge } from './judge.mjs';
import { ProviderError, FileError } from './errors.mjs';

const DEFAULT_MAX_MB = 9;
const DEFAULT_TRANSCODE = { scale: '640:-2', fps: 10, crf: 32 };

// Provider/model combinations known to accept video. Anything else throws
// with a clear message — silently falling back to frame extraction would
// mask the user's intent to send video.
/** @param {string} provider @param {string} [model] */
function supportsVideo(provider, model) {
  if (provider === 'gemini') return true;
  if (provider === 'openrouter' && /^google\//.test(model || '')) return true;
  return false;
}

/** @param {string} p */
function mimeFromPath(p) {
  const ext = extname(p).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'video/mp4';
}

/** @param {string} videoPath @param {{scale:string,fps:number,crf:number}} [params] */
function transcode(videoPath, params = DEFAULT_TRANSCODE) {
  const out = join(tmpdir(), `aivt-video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp4`);
  const ff = spawnSync('ffmpeg', [
    '-y', '-i', videoPath,
    '-c:v', 'libx264', '-crf', String(params.crf), '-preset', 'fast',
    '-vf', `scale=${params.scale},fps=${params.fps}`, '-an', out,
  ], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (ff.status !== 0) {
    throw new FileError(
      `ffmpeg transcode failed (status ${ff.status}). ` +
      `Install ffmpeg or pass an already-small video. stderr: ${(ff.stderr || '').slice(0, 200)}`,
      basename(videoPath)
    );
  }
  return { path: out, mime: 'video/mp4' };
}

// Normalize one or many videos into [{path, mime, label, sentPath, sizeMB}].
/**
 * @param {string|string[]|{path:string,label?:string,mime?:string}[]} input
 * @param {number} maxMB
 * @param {{scale:string,fps:number,crf:number}} transcodeParams
 */
function prepareVideos(input, maxMB, transcodeParams) {
  const videos = Array.isArray(input)
    ? input.map((v) => (typeof v === 'string' ? { path: v } : v))
    : [{ path: input }];
  return videos.map((v) => {
    if (!v.path) throw new FileError('video entry missing path', String(v));
    statSync(v.path); // throws if missing
    const sizeMB = statSync(v.path).size / 1024 / 1024;
    let sent = { path: v.path, mime: v.mime || mimeFromPath(v.path) };
    if (sizeMB > maxMB) {
      const t = transcode(v.path, transcodeParams);
      sent = t;
    }
    return {
      path: v.path,
      label: v.label || basename(v.path),
      mime: sent.mime,
      sentPath: sent.path,
      sizeMB,
    };
  });
}

/** @param {string} prompt @param {{label:string,mime:string,sentPath:string}[]} videos */
function buildGeminiParts(prompt, videos) {
  /** @type {any[]} */
  const parts = [{ text: prompt }];
  for (const v of videos) {
    if (videos.length > 1) parts.push({ text: `\n--- Video: ${v.label} ---` });
    parts.push({
      inline_data: {
        mime_type: v.mime,
        data: readFileSync(v.sentPath).toString('base64'),
      },
    });
  }
  return parts;
}

/** @param {string} prompt @param {{label:string,mime:string,sentPath:string}[]} videos */
function buildOpenAIVideoContent(prompt, videos) {
  /** @type {any[]} */
  const content = [{ type: 'text', text: prompt }];
  for (const v of videos) {
    if (videos.length > 1) content.push({ type: 'text', text: `\n--- Video: ${v.label} ---` });
    content.push({
      type: 'video_url',
      video_url: {
        url: `data:${v.mime};base64,${readFileSync(v.sentPath).toString('base64')}`,
      },
    });
  }
  return content;
}

/**
 * Video judge — extends the screenshot judge with video-input HTTP paths.
 *
 * Reuses VLLMJudge for config (provider, apiKey, model), retries, error
 * normalization, and result shaping. Override only the API call to send a
 * video payload instead of base64 images.
 */
export class VideoJudge extends VLLMJudge {
  /** @param {object & {maxMB?:number, transcode?:object}} [options] */
  constructor(options = {}) {
    super(options);
    /** @type {any} */
    const opts = options;
    this.maxMB = opts.maxMB ?? DEFAULT_MAX_MB;
    this.transcodeParams = { ...DEFAULT_TRANSCODE, ...(opts.transcode || {}) };
  }

  /**
   * Judge a video (or array of videos) against a prompt.
   *
   * @param {string | string[] | {path:string,label?:string,mime?:string}[]} input
   *   One video path, an array of paths, or an array of objects with optional
   *   per-video labels. Multi-video calls send all videos in the same prompt.
   * @param {string} prompt - Critique instructions.
   * @param {object} [context]
   * @param {number} [context.maxTokens] - Override max output tokens.
   * @returns {Promise<object>} Same shape as VLLMJudge.judgeScreenshot.
   */
  async judgeVideo(input, prompt, context = {}) {
    if (!supportsVideo(this.provider, this.providerConfig?.model)) {
      throw new ProviderError(
        `Video input is not supported on provider '${this.provider}'` +
        (this.providerConfig?.model ? ` with model '${this.providerConfig.model}'` : '') +
        `. Supported: gemini (direct), openrouter with a google/* model. ` +
        `For other providers, extract frames yourself and use judgeScreenshot with a multi-image array.`,
        this.provider
      );
    }
    const videos = prepareVideos(input, this.maxMB, this.transcodeParams);
    const apiResponse = await this._callVideoProviderAPI(prompt, videos, context);
    const parsed = await this.providerAdapter.parseResponse(apiResponse);
    return this._buildResult({
      judgment: parsed.judgment,
      data: parsed.data,
      logprobs: parsed.logprobs,
      attempts: 1,
      responseTime: 0,
      imagePath: videos.map((v) => v.path).join('|'),
      context,
    });
  }

  /**
   * @param {string} prompt
   * @param {{label:string,mime:string,sentPath:string}[]} videos
   * @param {{maxTokens?:number}} context
   */
  async _callVideoProviderAPI(prompt, videos, context) {
    const maxTokens = context.maxTokens || 16000;
    const attempts = context.attempts ?? 3;
    const buildRequest = () => {
      if (this.provider === 'gemini') {
        const parts = buildGeminiParts(prompt, videos);
        return {
          url: `${this.providerConfig.apiUrl}/models/${this.providerConfig.model}:generateContent`,
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: { maxOutputTokens: maxTokens },
            }),
          },
        };
      }
      // OpenRouter (only google/* models reach here per supportsVideo guard)
      const content = buildOpenAIVideoContent(prompt, videos);
      return {
        url: `${this.providerConfig.apiUrl}/chat/completions`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
          body: JSON.stringify({
            model: this.providerConfig.model,
            messages: [{ role: 'user', content }],
            max_tokens: maxTokens,
          }),
        },
      };
    };
    // Retry on empty body / 5xx / transient network. OpenRouter occasionally
    // returns 200 with empty body under load (parses as "Unexpected end of
    // JSON input" downstream). Exponential backoff: 3s, 6s, 9s.
    /** @type {Response | null} */
    let lastRes = null;
    /** @type {Error | null} */
    let lastErr = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const { url, init } = buildRequest();
      try {
        const res = await fetch(url, init);
        if (res.ok) {
          // Peek at body — empty triggers retry (we need to stash, so consume
          // the stream into a Response we can parse downstream).
          const text = await res.text();
          if (text.trim().length > 0) {
            return new Response(text, { status: res.status, headers: res.headers });
          }
          lastRes = res;
        } else {
          lastRes = res;
          if (res.status < 500 && res.status !== 429) {
            // Non-retryable client error — return immediately for parser to surface.
            return res;
          }
        }
      } catch (e) {
        lastErr = /** @type {Error} */ (e);
      }
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    if (lastErr) throw lastErr;
    return /** @type {Response} */ (lastRes);
  }
}

/**
 * Convenience wrapper — single-call video judging without instantiating a class.
 *
 * @param {string | string[] | {path:string,label?:string,mime?:string}[]} input - See VideoJudge.judgeVideo.
 * @param {string} prompt - Critique instructions.
 * @param {object} [options] - Same as VLLMJudge constructor + maxMB/transcode/maxTokens.
 * @returns {Promise<object>} Critique result.
 */
export async function judgeVideo(input, prompt, options = {}) {
  const judge = new VideoJudge(options);
  return judge.judgeVideo(input, prompt, options);
}
