#!/usr/bin/env node
/**
 * Script to create a new shared LLM utility repository
 * 
 * Usage: node scripts/create-llm-utils-repo.mjs [repo-name]
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SECURITY: Sanitize repo name to prevent path traversal
const rawRepoName = process.argv[2] || 'llm-utils';
// Only allow alphanumeric, hyphens, underscores, and dots (for npm scopes)
const sanitizedRepoName = rawRepoName.replace(/[^a-zA-Z0-9._-]/g, '_');
const REPO_NAME = sanitizedRepoName.substring(0, 100); // Limit length
const REPO_PATH = join(__dirname, '..', '..', REPO_NAME);

// Additional security: Ensure path doesn't escape parent directory
const resolvedPath = resolve(REPO_PATH);
const resolvedParent = resolve(__dirname, '..', '..');
if (!resolvedPath.startsWith(resolvedParent)) {
  throw new Error('Path traversal detected in repository name');
}

async function createRepo() {
  console.log(`Creating shared LLM utility repo: ${REPO_NAME}`);
  
  // Check if directory already exists
  if (existsSync(REPO_PATH)) {
    console.error(`❌ Directory ${REPO_PATH} already exists`);
    process.exit(1);
  }
  
  try {
    // Create directory structure
    console.log('Creating directory structure...');
    mkdirSync(REPO_PATH, { recursive: true });
    mkdirSync(join(REPO_PATH, 'src'), { recursive: true });
    mkdirSync(join(REPO_PATH, 'src', 'providers'), { recursive: true });
    mkdirSync(join(REPO_PATH, 'test'), { recursive: true });
    
    // Create package.json
    const packageJson = {
      name: `@arclabs561/${REPO_NAME}`,
      version: '0.1.0',
      description: 'Shared LLM utility library for text-only LLM calls across multiple providers',
      type: 'module',
      main: 'src/index.mjs',
      exports: {
        '.': './src/index.mjs',
        './providers': './src/providers/index.mjs',
      },
      scripts: {
        test: 'node --test test/*.test.mjs',
        'test:watch': 'node --test --watch test/*.test.mjs',
      },
      keywords: [
        'llm',
        'openai',
        'anthropic',
        'gemini',
        'ai',
        'text-generation',
      ],
      author: 'arclabs561 <henry@henrywallace.io>',
      license: 'MIT',
      engines: {
        node: '>=18.0.0',
      },
    };
    
    writeFileSync(
      join(REPO_PATH, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n'
    );
    
    // Create README
    const readme = `# ${REPO_NAME}

Shared LLM utility library for text-only LLM calls.

## Features

- Unified API for OpenAI, Anthropic (Claude), and Google (Gemini)
- Auto-detection of provider from environment variables
- Simple, consistent interface across providers
- Error handling and retries
- JSON extraction utilities

## Installation

\`\`\`bash
npm install @arclabs561/${REPO_NAME}
\`\`\`

## Usage

\`\`\`javascript
import { callLLM, detectProvider } from '@arclabs561/${REPO_NAME}';

// Auto-detect provider from environment
const provider = detectProvider();
if (provider) {
  const response = await callLLM('Your prompt here', provider.provider, provider.apiKey);
  console.log(response);
}
\`\`\`

## Environment Variables

The library auto-detects providers from these environment variables:

- \`GEMINI_API_KEY\` - Google Gemini
- \`OPENAI_API_KEY\` - OpenAI
- \`ANTHROPIC_API_KEY\` - Anthropic Claude
- \`VLM_PROVIDER\` - Explicit provider selection (gemini, openai, claude)
- \`API_KEY\` - Fallback (defaults to gemini)

## License

MIT
`;
    
    writeFileSync(join(REPO_PATH, 'README.md'), readme);
    
    // Create .gitignore
    const gitignore = `node_modules/
*.log
.DS_Store
.env
.env.local
coverage/
.nyc_output/
`;
    
    writeFileSync(join(REPO_PATH, '.gitignore'), gitignore);
    
    // Create basic source files
    const detectorCode = `/**
 * Auto-detect LLM provider from environment variables
 */

export function detectProvider() {
  const explicitProvider = process.env.VLM_PROVIDER?.trim().toLowerCase();
  if (explicitProvider && ['gemini', 'openai', 'claude'].includes(explicitProvider)) {
    const apiKey = process.env[\`\${explicitProvider.toUpperCase()}_API_KEY\`] || process.env.API_KEY;
    if (apiKey) {
      return { provider: explicitProvider, apiKey };
    }
  }
  
  // Auto-detect from API keys (priority: gemini > openai > claude)
  if (process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'claude', apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.API_KEY) {
    return { provider: 'gemini', apiKey: process.env.API_KEY };
  }
  
  return null;
}
`;
    
    writeFileSync(join(REPO_PATH, 'src', 'detector.mjs'), detectorCode);
    
    const indexCode = `/**
 * Main exports for LLM utility library
 */

export { detectProvider } from './detector.mjs';
export { callLLM } from './client.mjs';
export { LLMClient } from './client.mjs';
`;
    
    writeFileSync(join(REPO_PATH, 'src', 'index.mjs'), indexCode);
    
    // Create placeholder client.mjs (to be filled with extracted code)
    const clientCode = `/**
 * Unified LLM client
 * 
 * TODO: Extract common LLM calling code from:
 * - scripts/check-docs-bloat.mjs
 * - scripts/validate-commit-msg.mjs
 * - src/data-extractor.mjs
 */

import { detectProvider } from './detector.mjs';

/**
 * Call LLM API (text-only)
 */
export async function callLLM(prompt, provider, apiKey, options = {}) {
  const {
    temperature = 0.1,
    maxTokens = 1000,
    model = null,
  } = options;
  
  switch (provider) {
    case 'gemini': {
      const response = await fetch(
        \`https://generativelanguage.googleapis.com/v1beta/models/\${model || 'gemini-2.0-flash-exp'}:generateContent\`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens
            }
          })
        }
      );
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    
    case 'openai': {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${apiKey}\`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }
    
    case 'claude': {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-haiku-20241022',
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      return data.content?.[0]?.text || '';
    }
    
    default:
      throw new Error(\`Unsupported provider: \${provider}\`);
  }
}

/**
 * LLM Client class
 */
export class LLMClient {
  constructor(options = {}) {
    const detected = detectProvider();
    this.provider = options.provider || detected?.provider || 'gemini';
    this.apiKey = options.apiKey || detected?.apiKey;
    this.temperature = options.temperature || 0.1;
    this.maxTokens = options.maxTokens || 1000;
    this.model = options.model || null;
    
    if (!this.apiKey) {
      throw new Error('No API key provided and none found in environment');
    }
  }
  
  async complete(prompt, options = {}) {
    return callLLM(prompt, this.provider, this.apiKey, {
      temperature: options.temperature || this.temperature,
      maxTokens: options.maxTokens || this.maxTokens,
      model: options.model || this.model,
    });
  }
}
`;
    
    writeFileSync(join(REPO_PATH, 'src', 'client.mjs'), clientCode);
    
    console.log(`✅ Created repository structure at ${REPO_PATH}`);
    console.log('\nNext steps:');
    console.log(`  1. cd ${REPO_PATH}`);
    console.log('  2. git init');
    console.log(`  3. gh repo create ${REPO_NAME} --private --source=. --remote=origin`);
    console.log('  4. git add .');
    console.log('  5. git commit -m "feat: initial commit"');
    console.log('  6. git push -u origin main');
    console.log('\nThen extract common LLM code from existing projects into this repo.');
  } catch (error) {
    console.error('Error creating repo:', error.message);
    process.exit(1);
  }
}

createRepo();

