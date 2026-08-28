import type { ConfigOptions, ValidationContext, ValidationResult } from '../index.js';

export class VideoJudge {
  constructor(options?: ConfigOptions);
  judgeScreenshot(imagePath: string | string[], prompt: string, context?: ValidationContext): Promise<ValidationResult>;
  judgeVideo(input: string | string[] | Array<{ path: string; label?: string; mime?: string }>, prompt: string, context?: ValidationContext): Promise<ValidationResult>;
}
export function judgeVideo(input: string | string[] | Array<{ path: string; label?: string; mime?: string }>, prompt: string, context?: ValidationContext): Promise<ValidationResult>;
