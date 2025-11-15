#!/usr/bin/env node
/**
 * Enhanced Secret Detection Script for Pre-commit Hook
 * 
 * Detects common patterns of secrets, API keys, passwords, and credentials
 * in staged files to prevent accidental commits.
 * 
 * Features:
 * - Pattern-based detection
 * - Entropy analysis for random-looking strings
 * - Obfuscation detection (base64, hex, string concatenation)
 * - Configuration file support (.secretsignore)
 * - Git history scanning (optional)
 * - Performance optimizations
 * - Red team tested against common bypass techniques
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Calculate Shannon entropy for a string
function calculateEntropy(str) {
  const len = str.length;
  if (len === 0) return 0;
  
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

// Check if string has high entropy (likely random/secret)
function hasHighEntropy(str, minEntropy = 3.5) {
  if (str.length < 10) return false;
  return calculateEntropy(str) >= minEntropy;
}

// Decode base64 string
function decodeBase64(str) {
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

// Decode hex string
function decodeHex(str) {
  try {
    if (!/^[0-9a-fA-F]+$/.test(str)) return null;
    return Buffer.from(str, 'hex').toString('utf-8');
  } catch {
    return null;
  }
}

// Decode Unicode escape sequences
function decodeUnicode(str) {
  try {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
      return String.fromCharCode(parseInt(code, 16));
    });
  } catch {
    return null;
  }
}

// Reverse a string
function reverseString(str) {
  return str.split('').reverse().join('');
}

// Check if a string looks like base64
function looksLikeBase64(str) {
  if (str.length < 10) return false;
  // Base64 chars: A-Z, a-z, 0-9, +, /, = (padding)
  return /^[A-Za-z0-9+/=]+$/.test(str) && str.length % 4 === 0;
}

// Check if a string looks like hex
function looksLikeHex(str) {
  if (str.length < 10) return false;
  return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

// Extract potential secrets from decoded strings
function checkDecodedValue(decoded, original, line, lineNum, filepath, issues) {
  if (!decoded || decoded.length < 10) return;
  
  // Check if decoded value matches secret patterns
  const secretPatterns = [
    /^sk-[a-zA-Z0-9]{32,}/,
    /^ghp_[a-zA-Z0-9]{36}/,
    /^AIza[0-9A-Za-z_-]{35}/,
    /^AKIA[0-9A-Z]{16}/,
    /^xox[bapors]-[0-9a-zA-Z-]{10,}/,
  ];
  
  for (const pattern of secretPatterns) {
    if (pattern.test(decoded)) {
      issues.push({
        file: filepath,
        line: lineNum + 1,
        type: 'Obfuscated Secret (decoded)',
        match: decoded.substring(0, 8) + '...',
        context: line.trim().substring(0, 100),
        original: original.substring(0, 20) + '...',
        entropy: calculateEntropy(decoded).toFixed(2),
      });
      return;
    }
  }
  
  // Check entropy of decoded value
  if (hasHighEntropy(decoded, 3.0) && decoded.length >= 20) {
    issues.push({
      file: filepath,
      line: lineNum + 1,
      type: 'Potential Obfuscated Secret (high entropy after decode)',
      match: decoded.substring(0, 8) + '...',
      context: line.trim().substring(0, 100),
      original: original.substring(0, 20) + '...',
      entropy: calculateEntropy(decoded).toFixed(2),
    });
  }
}

// Patterns to detect secrets (case-insensitive)
const SECRET_PATTERNS = [
  // API Keys
  { pattern: /(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i, name: 'API Key', checkEntropy: true },
  { pattern: /(gemini|openai|anthropic|claude)[_-]?api[_-]?key\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i, name: 'Provider API Key', checkEntropy: true },
  
  // Common API key formats
  { pattern: /sk-[a-zA-Z0-9]{32,}/, name: 'OpenAI/Anthropic Secret Key' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Secret Key' },
  { pattern: /rk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe Restricted Key' },
  { pattern: /AIza[0-9A-Za-z_-]{35}/, name: 'Google API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/, name: 'GitHub OAuth Token' },
  { pattern: /ghu_[a-zA-Z0-9]{36}/, name: 'GitHub User-to-Server Token' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/, name: 'GitHub Server-to-Server Token' },
  { pattern: /ghr_[a-zA-Z0-9]{36}/, name: 'GitHub Refresh Token' },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/, name: 'GitHub Fine-grained Token' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
  { pattern: /aws[_-]?(access[_-]?key[_-]?id|secret[_-]?access[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{20,})['"]?/i, name: 'AWS Credentials', checkEntropy: true },
  
  // Azure
  { pattern: /[a-z0-9]{32}=/, name: 'Azure Storage Key' },
  
  // Slack tokens
  { pattern: /xox[bapors]-[0-9a-zA-Z-]{10,}/, name: 'Slack Token' },
  
  // Passwords
  { pattern: /(password|passwd|pwd)\s*[:=]\s*['"]?([^'"]{8,})['"]?/i, name: 'Password', checkEntropy: true },
  { pattern: /(secret|secret[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-/+=]{16,})['"]?/i, name: 'Secret Key', checkEntropy: true },
  
  // Tokens
  { pattern: /(token|bearer)\s*[:=]\s*['"]?([a-zA-Z0-9_\-./+=]{20,})['"]?/i, name: 'Token', checkEntropy: true },
  { pattern: /(auth[_-]?token|auth[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-/+=]{20,})['"]?/i, name: 'Auth Token', checkEntropy: true },
  
  // Private keys
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, name: 'Private Key' },
  { pattern: /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/, name: 'EC Private Key' },
  { pattern: /-----BEGIN\s+DSA\s+PRIVATE\s+KEY-----/, name: 'DSA Private Key' },
  { pattern: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/, name: 'SSH Private Key' },
  { pattern: /-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----/, name: 'PGP Private Key' },
  
  // Database credentials
  { pattern: /(database[_-]?url|db[_-]?url|connection[_-]?string)\s*[:=]\s*['"]?([^\s'"]*:\/\/[^\s'"]*:[^\s'"]*@[^\s'"]+)['"]?/i, name: 'Database URL with Credentials' },
  { pattern: /(mongodb|postgres|mysql|redis|postgresql)[_:\/]+[^\s'"]*:[^\s'"]*@/i, name: 'Database Connection String' },
  
  // Backup and temporary env files (should never be committed)
  { pattern: /\.env\.(bak|backup|old|save|tmp)/i, name: 'Backup Environment File' },
  { pattern: /\.env\.bak/i, name: 'Backup Environment File (.env.bak)' },
  { pattern: /\.env\.backup/i, name: 'Backup Environment File (.env.backup)' },
  
  // URLs with embedded credentials
  { pattern: /https?:\/\/[a-zA-Z0-9_\-]+:[a-zA-Z0-9_\-]+@/, name: 'URL with Embedded Credentials' },
  
  // JWT tokens (basic pattern)
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, name: 'JWT Token' },
  
  // OAuth
  { pattern: /(client[_-]?secret|oauth[_-]?secret)\s*[:=]\s*['"]?([a-zA-Z0-9_\-/+=]{16,})['"]?/i, name: 'OAuth Secret', checkEntropy: true },
  
  // Generic long base64-like strings (potential secrets) - only if high entropy
  { pattern: /['"]?([A-Za-z0-9+/=]{40,})['"]?\s*[,;}\]]/, name: 'Potential Secret (long base64-like string)', checkEntropy: true },
  
  // Twilio
  { pattern: /SK[0-9a-f]{32}/, name: 'Twilio API Key' },
  
  // Mailgun
  { pattern: /key-[0-9a-f]{32}/, name: 'Mailgun API Key' },
  
  // SendGrid
  { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, name: 'SendGrid API Key' },
  
  // Obfuscation patterns
  { pattern: /(atob|Buffer\.from|btoa)\s*\(['"]([A-Za-z0-9+/=]{20,})['"]/i, name: 'Base64 Decode Function', checkDecode: true },
  { pattern: /Buffer\.from\s*\(['"]([0-9a-fA-F]{20,})['"],\s*['"]hex['"]/i, name: 'Hex Decode Function', checkDecode: true },
  { pattern: /['"]([A-Za-z0-9+/=]{40,})['"]\s*\.(toString|split|join)/i, name: 'Potential Obfuscated Secret', checkDecode: true },
  
  // Standalone hex-encoded secrets (40+ chars, high entropy)
  { pattern: /['"]?([0-9a-fA-F]{40,})['"]?\s*[,;}\]]/, name: 'Potential Hex-encoded Secret', checkDecode: true, checkEntropy: true },
  
  // String manipulation patterns (reverse, split/join, substring)
  { pattern: /['"]([a-zA-Z0-9_\-]{20,})['"]\s*\.split\(['"]\s*['"]\)\s*\.reverse\(\)\s*\.join\(['"]\s*['"]\)/i, name: 'String Reversal Obfuscation', checkDecode: true },
  { pattern: /['"]([a-zA-Z0-9_\-]{20,})['"]\s*\.split\(['"]\s*['"]\)\s*\.join\(['"]\s*['"]\)/i, name: 'String Split/Join Obfuscation', checkDecode: true },
  { pattern: /\.substring\([^)]+\)\s*\+\s*\.substring\([^)]+\)/i, name: 'Substring Concatenation Obfuscation' },
  
  // Unicode escape sequences
  { pattern: /\\u[0-9a-fA-F]{4}/g, name: 'Unicode Escape Sequence', checkUnicode: true },
  
  // Template literals with expressions
  { pattern: /`[^`]*\$\{[^}]+\}[^`]*`/, name: 'Template Literal with Expression', checkTemplate: true },
  
  // Variable names that might contain secrets (broader pattern)
  { pattern: /(credential|cred|auth|key|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?([a-zA-Z0-9_\-/+=]{20,})['"]?/i, name: 'Credential Variable', checkEntropy: true },
  
  // String concatenation patterns (multi-line)
  { pattern: /['"]([a-zA-Z0-9_\-]{10,})['"]\s*\+\s*['"]([a-zA-Z0-9_\-]{10,})['"]/, name: 'String Concatenation (potential secret)', checkEntropy: true },
  
  // Comments with secrets
  { pattern: /\/\/.*(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?([a-zA-Z0-9_\-/+=]{20,})['"]?/i, name: 'Secret in Comment' },
  { pattern: /\/\*.*(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?([a-zA-Z0-9_\-/+=]{20,})['"]?.*\*\//i, name: 'Secret in Block Comment' },
];

// Files to exclude from secret detection
const EXCLUDE_PATTERNS = [
  /\.test\.(mjs|js)$/,
  /test\//,
  /\.md$/,
  /\.json$/,
  /package-lock\.json$/,
  /\.git\//,
  /node_modules\//,
  /\.env\.example$/,
  /\.env\.sample$/,
  /CHANGELOG\.md$/,
  /LICENSE$/,
  /\.secretsignore$/,
  // But DO NOT exclude .env.bak, .env.backup, etc. - these should be detected!
];

// Patterns that are allowed (false positives)
const ALLOWED_PATTERNS = [
  /process\.env\./,  // Environment variable references are OK
  /config\.apiKey/,  // Config object references are OK
  /['"]test[_-]?key['"]/,  // Test keys
  /['"]example[_-]?key['"]/,  // Example keys
  /['"]your[_-]?api[_-]?key['"]/,  // Placeholder text
  /['"]placeholder['"]/,  // Placeholders
  /['"]xxx['"]/,  // Placeholders
  /['"]REPLACE['"]/,  // Placeholders
  /['"]YOUR[_-]?KEY['"]/,  // Placeholders
  /['"]fake[_-]?key['"]/,  // Fake keys
  /['"]dummy[_-]?key['"]/,  // Dummy keys
  /['"]sample[_-]?key['"]/,  // Sample keys
  /['"]mock[_-]?key['"]/,  // Mock keys
  /base64[_-]?encode/i,  // Base64 encoding functions
  /base64[_-]?decode/i,  // Base64 decoding functions
  /red[_-]?team/i,  // Red team test files
  /^#.*\.env\.(bak|backup|old)/,  // Comments in .gitignore about backup files
  /\.gitignore.*\.env\.(bak|backup|old)/,  // .gitignore patterns for backup files
  /^\s*\.env\.(bak|backup|old|save|tmp)\s*$/,  // .gitignore entries for backup files
  /^\s*\*\.env\.(bak|backup|old)\s*$/,  // .gitignore glob patterns for backup files
];

/**
 * Load .secretsignore file if it exists
 */
function loadSecretsIgnore() {
  const ignoreFile = join(process.cwd(), '.secretsignore');
  if (!existsSync(ignoreFile)) {
    return { patterns: [], files: [] };
  }
  
  try {
    const content = readFileSync(ignoreFile, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    const patterns = [];
    const files = [];
    
    for (const line of lines) {
      if (line.startsWith('pattern:')) {
        patterns.push(new RegExp(line.substring(8).trim()));
      } else if (line.startsWith('file:')) {
        files.push(line.substring(5).trim());
      } else {
        // Assume it's a file pattern
        files.push(line);
      }
    }
    
    return { patterns, files };
  } catch (error) {
    console.warn(`Warning: Could not read .secretsignore: ${error.message}`);
    return { patterns: [], files: [] };
  }
}

/**
 * Get staged files from git
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    return [];
  }
}

/**
 * Check if file should be excluded
 */
function shouldExcludeFile(filepath, secretsIgnore) {
  // Check built-in exclusions
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(filepath))) {
    return true;
  }
  
  // Check .secretsignore file patterns
  if (secretsIgnore.files.some(pattern => {
    // Simple glob-like matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(filepath);
    }
    return filepath.includes(pattern);
  })) {
    return true;
  }
  
  return false;
}

/**
 * Check if match is an allowed pattern (false positive)
 */
function isAllowedMatch(match, line, filepath, secretsIgnore) {
  // Check built-in allowed patterns
  if (ALLOWED_PATTERNS.some(pattern => pattern.test(line))) {
    return true;
  }
  
  // Check .secretsignore patterns
  if (secretsIgnore.patterns.some(pattern => pattern.test(line))) {
    return true;
  }
  
  return false;
}

/**
 * Detect secrets in a file
 */
function detectSecretsInFile(filepath, secretsIgnore) {
  const issues = [];
  
  try {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    
    // Also check the full content for multi-line patterns
    const fullContent = content;
    
    lines.forEach((line, lineNum) => {
      SECRET_PATTERNS.forEach(({ pattern, name, checkEntropy = false, checkDecode = false }) => {
        // Ensure pattern is global for matchAll
        const flags = pattern.flags || '';
        const globalPattern = flags.includes('g') 
          ? pattern 
          : new RegExp(pattern.source, flags + 'g');
        
        try {
          const matches = [...line.matchAll(globalPattern)];
          
          matches.forEach(match => {
            // Skip if it's an allowed pattern
            if (isAllowedMatch(match, line, filepath, secretsIgnore)) {
              return;
            }
            
            // Extract the secret value (usually in match[2] or match[1] or match[0])
            const secretValue = match[2] || match[1] || match[0];
            
            if (!secretValue) {
              return;
            }
            
            // Skip if it's clearly a placeholder or example
            if (secretValue.length < 10) {
              return;
            }
            
            // For patterns that require entropy check, verify entropy
            if (checkEntropy && !hasHighEntropy(secretValue)) {
              return;
            }
            
            // For decode patterns, try to decode and check
            if (checkDecode) {
              if (looksLikeBase64(secretValue)) {
                const decoded = decodeBase64(secretValue);
                checkDecodedValue(decoded, secretValue, line, lineNum, filepath, issues);
              } else if (looksLikeHex(secretValue)) {
                const decoded = decodeHex(secretValue);
                checkDecodedValue(decoded, secretValue, line, lineNum, filepath, issues);
              } else {
                // Try reversing the string (common obfuscation)
                const reversed = reverseString(secretValue);
                if (hasHighEntropy(reversed, 3.0) && reversed.length >= 20) {
                  checkDecodedValue(reversed, secretValue, line, lineNum, filepath, issues);
                }
              }
            }
            
            // Check Unicode escapes
            if (pattern.source.includes('checkUnicode') || /\\u[0-9a-fA-F]{4}/.test(secretValue)) {
              const unicodeDecoded = decodeUnicode(secretValue);
              if (unicodeDecoded && unicodeDecoded !== secretValue) {
                checkDecodedValue(unicodeDecoded, secretValue, line, lineNum, filepath, issues);
              }
            }
            
            // Mask the secret for display
            const masked = secretValue.length > 8 
              ? secretValue.substring(0, 4) + '...' + secretValue.substring(secretValue.length - 4)
              : '***';
            
            issues.push({
              file: filepath,
              line: lineNum + 1,
              type: name,
              match: masked,
              context: line.trim().substring(0, 100), // First 100 chars of line
              entropy: checkEntropy ? calculateEntropy(secretValue).toFixed(2) : null,
            });
          });
        } catch (error) {
          // Skip patterns that cause errors (e.g., invalid regex)
          // Silently continue
        }
      });
      
      // Check for base64/hex encoded strings that might be secrets
      if (looksLikeBase64(line) && line.length >= 40) {
        const decoded = decodeBase64(line.trim());
        if (decoded) {
          checkDecodedValue(decoded, line.trim(), line, lineNum, filepath, issues);
        }
      }
      
      if (looksLikeHex(line) && line.length >= 40) {
        const decoded = decodeHex(line.trim());
        if (decoded) {
          checkDecodedValue(decoded, line.trim(), line, lineNum, filepath, issues);
        }
      }
    });
    
    // Enhanced multi-line string concatenation detection
    // Track string concatenation across multiple lines
    let concatBuffer = [];
    let concatStartLine = 0;
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      // Check for string concatenation patterns
      const concatPattern = /(['"])([a-zA-Z0-9_\-]{10,})\1\s*\+\s*(['"])([a-zA-Z0-9_\-]{10,})\3/g;
      let concatMatch;
      while ((concatMatch = concatPattern.exec(line)) !== null) {
        const combined = concatMatch[2] + concatMatch[4];
        if (hasHighEntropy(combined) && combined.length >= 20) {
          if (!isAllowedMatch(concatMatch, line, filepath, secretsIgnore)) {
            issues.push({
              file: filepath,
              line: lineNum + 1,
              type: 'Potential Secret (string concatenation)',
              match: combined.substring(0, 8) + '...',
              context: line.trim().substring(0, 100),
              entropy: calculateEntropy(combined).toFixed(2),
            });
          }
        }
      }
      
      // Track multi-line concatenation
      const multiLineConcat = /['"]([^'"]{10,})['"]\s*\+/;
      if (multiLineConcat.test(line)) {
        const match = line.match(multiLineConcat);
        if (match) {
          if (concatBuffer.length === 0) concatStartLine = lineNum + 1;
          concatBuffer.push(match[1]);
        }
      } else if (concatBuffer.length > 0) {
        // End of concatenation - check combined value
        const combined = concatBuffer.join('');
        if (hasHighEntropy(combined, 3.0) && combined.length >= 20) {
          const fullContext = lines.slice(Math.max(0, concatStartLine - 1), lineNum + 1).join(' ').trim();
          if (!isAllowedMatch({}, fullContext, filepath, secretsIgnore)) {
            issues.push({
              file: filepath,
              line: concatStartLine,
              type: 'Potential Secret (multi-line concatenation)',
              match: combined.substring(0, 8) + '...',
              context: fullContext.substring(0, 100),
              entropy: calculateEntropy(combined).toFixed(2),
            });
          }
        }
        concatBuffer = [];
      }
      
      // Check for string manipulation patterns
      const reversePattern = /['"]([a-zA-Z0-9_\-]{20,})['"]\s*\.split\(['"]\s*['"]\)\s*\.reverse\(\)\s*\.join\(['"]\s*['"]\)/i;
      const reverseMatch = line.match(reversePattern);
      if (reverseMatch) {
        const reversed = reverseString(reverseMatch[1]);
        if (hasHighEntropy(reversed, 3.0) && reversed.length >= 20) {
          checkDecodedValue(reversed, reverseMatch[1], line, lineNum, filepath, issues);
        }
      }
      
      // Check for Unicode escapes
      if (/\\u[0-9a-fA-F]{4}/.test(line)) {
        const unicodeDecoded = decodeUnicode(line);
        if (unicodeDecoded && unicodeDecoded !== line) {
          checkDecodedValue(unicodeDecoded, line, line, lineNum, filepath, issues);
        }
      }
      
      // Check template literals
      const templatePattern = /`([^`]*)\$\{([^}]+)\}([^`]*)`/g;
      let templateMatch;
      while ((templateMatch = templatePattern.exec(line)) !== null) {
        // Check if template literal contains high-entropy content
        const templateContent = templateMatch[1] + templateMatch[2] + templateMatch[3];
        if (hasHighEntropy(templateContent, 3.0) && templateContent.length >= 20) {
          if (!isAllowedMatch(templateMatch, line, filepath, secretsIgnore)) {
            issues.push({
              file: filepath,
              line: lineNum + 1,
              type: 'Potential Secret (template literal)',
              match: templateContent.substring(0, 8) + '...',
              context: line.trim().substring(0, 100),
              entropy: calculateEntropy(templateContent).toFixed(2),
            });
          }
        }
      }
    }
    
  } catch (error) {
    // File might be binary or not readable, skip it
    if (error.code !== 'ENOENT') {
      console.warn(`Warning: Could not read ${filepath}: ${error.message}`);
    }
  }
  
  return issues;
}

/**
 * Scan git history for secrets (optional, can be slow)
 */
function scanGitHistory(secretsIgnore) {
  try {
    // Only scan last 10 commits to avoid being too slow
    const output = execSync('git log --all --pretty=format:"%H" -10', { encoding: 'utf-8' });
    const commits = output.trim().split('\n').filter(Boolean);
    
    const issues = [];
    for (const commit of commits) {
      try {
        const diff = execSync(`git show ${commit} --name-only --pretty=format:`, { encoding: 'utf-8' });
        const files = diff.trim().split('\n').filter(Boolean);
        
        for (const file of files) {
          if (shouldExcludeFile(file, secretsIgnore)) continue;
          
          try {
            const content = execSync(`git show ${commit}:${file}`, { encoding: 'utf-8' });
            const fileIssues = detectSecretsInFileContent(content, file, secretsIgnore);
            if (fileIssues.length > 0) {
              issues.push(...fileIssues.map(issue => ({
                ...issue,
                commit,
                inHistory: true,
              })));
            }
          } catch (e) {
            // File might not exist in that commit, skip
          }
        }
      } catch (e) {
        // Skip commits that can't be read
      }
    }
    
    return issues;
  } catch (error) {
    // Git history scanning is optional, fail silently
    return [];
  }
}

/**
 * Detect secrets in file content (for git history scanning)
 */
function detectSecretsInFileContent(content, filepath, secretsIgnore) {
  const issues = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineNum) => {
    SECRET_PATTERNS.forEach(({ pattern, name, checkEntropy = false, checkDecode = false }) => {
      const flags = pattern.flags || '';
      const globalPattern = flags.includes('g') 
        ? pattern 
        : new RegExp(pattern.source, flags + 'g');
      
      try {
        const matches = [...line.matchAll(globalPattern)];
        
        matches.forEach(match => {
          if (isAllowedMatch(match, line, filepath, secretsIgnore)) {
            return;
          }
          
          const secretValue = match[2] || match[1] || match[0];
          if (!secretValue || secretValue.length < 10) {
            return;
          }
          
          if (checkEntropy && !hasHighEntropy(secretValue)) {
            return;
          }
          
          if (checkDecode) {
            if (looksLikeBase64(secretValue)) {
              const decoded = decodeBase64(secretValue);
              checkDecodedValue(decoded, secretValue, line, lineNum, filepath, issues);
            } else if (looksLikeHex(secretValue)) {
              const decoded = decodeHex(secretValue);
              checkDecodedValue(decoded, secretValue, line, lineNum, filepath, issues);
            }
          }
          
          const masked = secretValue.length > 8 
            ? secretValue.substring(0, 4) + '...' + secretValue.substring(secretValue.length - 4)
            : '***';
          
          issues.push({
            file: filepath,
            line: lineNum + 1,
            type: name,
            match: masked,
            context: line.trim().substring(0, 100),
            entropy: checkEntropy ? calculateEntropy(secretValue).toFixed(2) : null,
          });
        });
      } catch (error) {
        // Skip
      }
    });
  });
  
  return issues;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const scanHistory = args.includes('--scan-history');
  
  const secretsIgnore = loadSecretsIgnore();
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0 && !scanHistory) {
    return 0;
  }
  
  const allIssues = [];
  
  // Scan staged files
  stagedFiles.forEach(file => {
    if (shouldExcludeFile(file, secretsIgnore)) {
      return;
    }
    
    const issues = detectSecretsInFile(file, secretsIgnore);
    allIssues.push(...issues);
  });
  
  // Optionally scan git history
  if (scanHistory) {
    console.log('Scanning git history (this may take a moment)...');
    const historyIssues = scanGitHistory(secretsIgnore);
    allIssues.push(...historyIssues);
  }
  
  if (allIssues.length > 0) {
    console.error('\n❌ SECRET DETECTION FAILED\n');
    console.error('Potential secrets detected:\n');
    
    // Group by file
    const byFile = {};
    allIssues.forEach(issue => {
      if (!byFile[issue.file]) {
        byFile[issue.file] = [];
      }
      byFile[issue.file].push(issue);
    });
    
    Object.entries(byFile).forEach(([file, issues]) => {
      console.error(`  ${file}:`);
      issues.forEach(({ line, type, match, context, entropy, commit, inHistory, original }) => {
        console.error(`    Line ${line}: ${type}`);
        console.error(`    Match: ${match}`);
        if (original) {
          console.error(`    Original (encoded): ${original}`);
        }
        if (entropy) {
          console.error(`    Entropy: ${entropy} (high entropy indicates likely secret)`);
        }
        if (inHistory) {
          console.error(`    Found in commit: ${commit?.substring(0, 8)} (already committed!)`);
        }
        console.error(`    Context: ${context}`);
        console.error('');
      });
    });
    
    console.error('Please remove secrets before committing.');
    console.error('If this is a false positive, add an exclusion pattern to .secretsignore');
    console.error('See scripts/detect-secrets.mjs for configuration options.\n');
    
    return 1;
  }
  
  return 0;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('detect-secrets.mjs')) {
  process.exit(main());
}

export { detectSecretsInFile, getStagedFiles, calculateEntropy, hasHighEntropy };
