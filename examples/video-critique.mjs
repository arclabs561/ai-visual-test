#!/usr/bin/env node
/**
 * Video critique example.
 *
 * Sends a recorded video (e.g. a Playwright tour, screen recording, demo)
 * to a video-capable VLM for free-form critique. Auto-transcodes oversized
 * videos via ffmpeg before upload.
 *
 * Run:
 *   node examples/video-critique.mjs path/to/video.webm
 *   node examples/video-critique.mjs path/to/light.webm path/to/dark.webm  # multi-video
 *
 * Requires:
 *   OPENROUTER_API_KEY  (default — uses google/gemini-3.1-pro-preview)
 *   OR GEMINI_API_KEY   (set VIDEO_PROVIDER=gemini)
 *   ffmpeg in PATH if any video > 9MB (auto-transcoded to keep payload small)
 *
 * Configure via env:
 *   VIDEO_PROVIDER  'openrouter' | 'gemini' (default: openrouter)
 *   VIDEO_MODEL     model id (default: google/gemini-3.1-pro-preview for OR,
 *                              gemini-3-pro-preview for direct gemini)
 *   VIDEO_MAX_MB    transcode trigger (default: 9)
 */

import { judgeVideo } from '@arclabs561/ai-visual-test/video';

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('usage: video-critique.mjs <video.webm> [video2.webm ...]');
  process.exit(1);
}

const provider = process.env.VIDEO_PROVIDER || 'openrouter';
const model = process.env.VIDEO_MODEL ||
  (provider === 'openrouter' ? 'google/gemini-3.1-pro-preview' : 'gemini-3-pro-preview');
const maxMB = parseInt(process.env.VIDEO_MAX_MB || '9', 10);

const prompt = `You are reviewing a recorded video for visual / UX issues.

Report each issue on one line in this format:
[SEVERITY] MM:SS — short description

Severities: CRITICAL, MAJOR, MINOR, NITPICK.
Be specific. Cite timestamps as MM:SS. Skip generic praise.`;

const input = paths.length === 1
  ? paths[0]
  : paths.map((p, i) => ({ path: p, label: `video ${i + 1}` }));

console.error(`provider: ${provider}`);
console.error(`model:    ${model}`);
console.error(`videos:   ${paths.length}`);

const result = await judgeVideo(input, prompt, { provider, model, maxMB, maxTokens: 16000 });
console.log(result.judgment || JSON.stringify(result, null, 2));
