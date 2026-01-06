# Caching Nuances and Subtleties

This document explores the subtle design decisions, edge cases, and nuanced behaviors in the caching implementation. These details matter for correctness, performance, and understanding why things work the way they do.

## Table of Contents

1. [Prompt Normalization Subtleties](#prompt-normalization-subtleties)
2. [Cache Key Generation Nuances](#cache-key-generation-nuances)
3. [Timestamp Dual-Purpose Design](#timestamp-dual-purpose-design)
4. [Vision vs Text Cache Coexistence](#vision-vs-text-cache-coexistence)
5. [Atomic Write Safety](#atomic-write-safety)
6. [Default Value Consistency](#default-value-consistency)
7. [Normalization Order Matters](#normalization-order-matters)
8. [JSON.stringify Stability](#jsonstringify-stability)

---

## Prompt Normalization Subtleties

### The Core Insight

Prompt normalization improves cache hit rates by treating semantically identical prompts (that differ only in formatting) as the same. But this creates a subtle tension:

**Tension**: Normalize too much → cache collisions (wrong cache hits)  
**Tension**: Normalize too little → cache misses (redundant API calls)

### Conservative Normalization Strategy

We chose **conservative normalization** (formatting only, no semantic changes):

```javascript
// ✅ NORMALIZED (formatting only):
'  test   prompt  ' → 'test prompt'  // Whitespace collapsed
'test\r\nprompt' → 'test\nprompt'    // Line endings normalized

// ❌ NOT NORMALIZED (would be too aggressive):
'Test Prompt' → 'test prompt'        // Case preserved
'Test: prompt!' → 'Test prompt'      // Punctuation preserved
```

**Why conservative?**
- Preserves semantic content (case, punctuation matter for LLM prompts)
- Avoids wrong cache hits (different prompts shouldn't collide)
- Only normalizes formatting (whitespace, line endings)

### The Original Prompt Preservation Subtlety

**Critical**: Normalization is ONLY for cache keys, NOT for API calls.

```javascript
// In callLLMCached():
const normalizedPrompt = normalizePrompt(prompt);  // For cache key
const response = await llmUtils.callLLM(prompt, ...);  // Original for API
```

**Why this matters:**
1. **Cache hit rates improve**: `'  prompt  '` and `'prompt'` hit same cache
2. **API receives original**: LLM gets the exact prompt user intended
3. **No semantic changes**: Only formatting normalized, content preserved

**The subtle bug if we normalized for API too:**
- User sends `'  important   spacing  '` (spacing might be intentional)
- We normalize to `'important spacing'` for API
- LLM might interpret differently (spacing can be semantic in prompts)

---

## Cache Key Generation Nuances

### Full Content Hashing (No Truncation)

**The Bug We Fixed**: Original code truncated prompts (>1000 chars) and gameState (>500 chars), causing collisions.

**The Fix**: Hash full content with SHA-256, no truncation.

```javascript
// ❌ OLD (BUGGY):
prompt: prompt.substring(0, 1000)  // Truncation causes collisions!

// ✅ NEW (CORRECT):
const keyString = JSON.stringify({ prompt, ... });  // Full content
return createHash('sha256').update(keyString).digest('hex');
```

**Why this matters:**
- Prompts that differ only after 1000 chars would collide
- Game states that differ only after 500 chars would collide
- Wrong cache hits = incorrect validation results

**The subtle edge case:**
- Prompt A: `'a'.repeat(1000) + 'SUFFIX_A'`
- Prompt B: `'a'.repeat(1000) + 'SUFFIX_B'`
- Old code: Same key (both truncated to first 1000 chars) = WRONG
- New code: Different keys (full content hashed) = CORRECT

### Type Field Prevents Collisions

**Critical Design Decision**: Vision and text caches share the same file but use different key spaces.

```javascript
// Vision cache key:
{ type: 'vision', imagePath, prompt, ... }

// Text cache key:
{ type: 'text', prompt, provider, ... }
```

**Why this matters:**
- Same prompt can be cached separately for vision vs text
- No collisions between vision and text cache entries
- Shared persistence (same file) but separate namespaces

**The subtle bug if type was missing:**
- Vision call: `prompt: "Is button visible?"` → cached
- Text call: `prompt: "Is button visible?"` → WRONG cache hit (vision result)
- Text call should get text-specific result, not vision result

### Default Value Consistency

**Subtle Bug Risk**: Default values must match between `generateTextLLMCacheKey()` and `callLLMCached()`.

```javascript
// In generateTextLLMCacheKey():
const { temperature = 0.1, maxTokens = 1000, ... } = options;

// In callLLMCached():
const { useCache = true, ...llmOptions } = options;
// llmOptions passed to generateTextLLMCacheKey()
```

**Why this matters:**
- If defaults don't match, cache misses occur even for "same" calls
- Example: Key generation uses `temperature: 0.1`, but call uses `temperature: undefined`
- Result: Different keys = cache miss = redundant API call

**The test that catches this:**
```javascript
const key1 = generateTextLLMCacheKey('prompt', 'gemini', {});
const key2 = generateTextLLMCacheKey('prompt', 'gemini', {
  temperature: 0.1,  // Explicit default
  maxTokens: 1000,   // Explicit default
});
assert.strictEqual(key1, key2);  // Must match!
```

---

## Timestamp Dual-Purpose Design

### Two Timestamps, Two Purposes

**Critical Subtlety**: We use TWO timestamps for different purposes:

1. **`_originalTimestamp`**: Creation time → used for **expiration** (7 days)
2. **`_lastAccessed`**: Access time → used for **LRU eviction** (least recently used)

### Why Two Timestamps?

**The Problem**: If we used one timestamp for both:
- Entry created 8 days ago, accessed today → should expire (old)
- Entry created today, accessed 8 days ago → should be evicted first (unused)

**The Solution**: Separate timestamps allow:
- **Expiration**: Based on creation time (age-based)
- **Eviction**: Based on access time (usage-based)

### The Bug We Fixed

**Original Bug**: All timestamps reset to `now` on every save, breaking 7-day expiration.

```javascript
// ❌ OLD (BUGGY):
timestamp: now  // All entries get current time on save!

// ✅ NEW (CORRECT):
timestamp: originalTimestamp  // Preserve original creation time
```

**Why this broke expiration:**
- Entry created 10 days ago
- Save happens → timestamp reset to `now`
- Expiration check: `now - now = 0 days` → NOT expired (WRONG!)
- Entry never expires until size limits hit

**The Fix**: Preserve `_originalTimestamp` across save/load cycles.

---

## Vision vs Text Cache Coexistence

### Shared File, Separate Namespaces

**Design Decision**: Vision and text caches share the same file (`cache.json`) but use different key spaces.

**Why share the file?**
- Same persistence strategy (7-day TTL, LRU eviction)
- Same failure domain (disk errors affect both the same way)
- Simpler implementation (one cache system, not two)

**Why separate key spaces?**
- Different data structures (vision: `{score, issues, ...}`, text: `{response}`)
- Different use cases (vision: screenshot validation, text: LLM extraction)
- Prevents collisions (same prompt can mean different things)

### The Type Field Ensures Separation

```javascript
// Vision key includes:
{ type: 'vision', imagePath, prompt, ... }

// Text key includes:
{ type: 'text', prompt, provider, ... }
```

**The subtle bug if type was missing:**
- Vision: `prompt: "Check button"` → cached with `{score: 8, issues: []}`
- Text: `prompt: "Check button"` → WRONG cache hit (gets vision result object)
- Text expects `{response: "..."}`, gets `{score: 8, issues: []}` → breaks

---

## Atomic Write Safety

### The Atomic Write Pattern

**Critical**: Cache writes use atomic file operations to prevent corruption.

```javascript
// 1. Write to temp file
writeFileSync(tempFile, JSON.stringify(cacheData), 'utf8');

// 2. Atomic rename (all-or-nothing)
renameSync(tempFile, CACHE_FILE);
```

**Why this matters:**
- If process crashes during write, old cache file is preserved
- If write succeeds but rename fails, temp file is cleaned up
- Cache file is never in partially-written state

### The Edge Case: Write Succeeds, Rename Fails

**Subtle Bug**: What if `writeFileSync` succeeds but `renameSync` fails?

**The Fix**: Clean up temp file if rename fails:

```javascript
if (writeSucceeded && !renameSucceeded) {
  unlinkSync(tempFile);  // Clean up orphaned temp file
}
```

**Why this matters:**
- Without cleanup, temp files accumulate
- Disk space leaks over time
- Temp files never become cache files (rename failed)

### Mutex Prevents Concurrent Writes

**Critical**: Async mutex ensures only one write happens at a time.

```javascript
const release = await cacheWriteMutex.acquire();
try {
  // Write cache
} finally {
  release();  // Always release, even on error
}
```

**Why this matters:**
- Without mutex, concurrent writes could corrupt cache file
- Two processes writing simultaneously → file corruption
- Mutex serializes writes (one at a time)

---

## Default Value Consistency

### The Consistency Requirement

**Subtle Bug Risk**: Default values must be identical in multiple places.

**Places defaults appear:**
1. `generateTextLLMCacheKey()` - for cache key generation
2. `callLLMCached()` - for actual LLM calls
3. `@arclabs561/llm-utils` - for API calls

**The Problem**: If defaults don't match:
- Cache key uses `temperature: 0.1` (default)
- LLM call uses `temperature: undefined` (no default)
- Different keys → cache miss → redundant API call

**The Solution**: Explicit defaults in `generateTextLLMCacheKey()`:

```javascript
const {
  temperature = 0.1,    // Explicit default
  maxTokens = 1000,     // Explicit default
  model = null,         // Explicit default
  tier = null           // Explicit default
} = options;
```

**Why explicit defaults matter:**
- Ensures cache key generation always uses same defaults
- Even if `@arclabs561/llm-utils` changes defaults, our cache keys stay consistent
- Prevents subtle cache miss bugs

---

## Normalization Order Matters

### The Normalization Pipeline

**Critical**: Order of normalization steps matters.

```javascript
return prompt
  .replace(/\r\n/g, '\n')           // 1. Line endings first
  .replace(/\r/g, '\n')              // 2. Handle old Mac
  .replace(/[ \t]+/g, ' ')          // 3. Collapse spaces/tabs
  .replace(/[ \t]*\n[ \t]*/g, '\n') // 4. Normalize line breaks
  .trim();                           // 5. Trim last
```

**Why order matters:**

**Example**: `'  line1\r\n  line2  '`

1. **If we trim first**: `'line1\r\n  line2'` → line break spacing not normalized
2. **If we normalize line breaks first**: `'  line1\n  line2  '` → spaces not collapsed
3. **Correct order**: Line endings → spaces → line breaks → trim

**The subtle bug if order was wrong:**
- `'line1 \r\n line2'` might not normalize correctly
- Different normalization = different cache keys = cache miss

---

## JSON.stringify Stability

### Object Key Order Stability

**Subtle Requirement**: `JSON.stringify()` key order must be stable for consistent cache keys.

**JavaScript Object Key Order** (ES2015+):
- String keys: Insertion order
- Number keys: Sorted numerically
- Symbol keys: After string/number keys

**Our Key Data Object**:
```javascript
const keyData = {
  type: 'text',        // String key (insertion order)
  prompt,              // String key
  provider,            // String key
  model,               // String key
  temperature,         // String key
  maxTokens,           // String key
  tier                 // String key
};
```

**Why this matters:**
- Same object, constructed same way → same JSON → same cache key
- Different construction order → different JSON → different cache key (WRONG!)

**The guarantee**: We always construct `keyData` in the same order, so `JSON.stringify()` is stable.

**The subtle bug if order was inconsistent:**
- Call 1: `{type, prompt, provider}` → key A
- Call 2: `{prompt, type, provider}` → key B (different order)
- Same data, different keys → cache miss

---

## Summary: Why These Subtleties Matter

1. **Prompt Normalization**: Improves cache hit rates without changing semantic content
2. **Full Content Hashing**: Prevents cache collisions for long prompts
3. **Type Field**: Prevents vision/text cache collisions
4. **Dual Timestamps**: Enables both expiration (age) and eviction (usage)
5. **Atomic Writes**: Prevents cache corruption on crashes
6. **Default Consistency**: Prevents cache misses from mismatched defaults
7. **Normalization Order**: Ensures all formatting variations normalize correctly
8. **JSON Stability**: Ensures consistent cache keys for same data

Each of these subtleties prevents a specific class of bugs:
- Wrong cache hits (collisions)
- Cache misses (inconsistent keys)
- Cache corruption (race conditions)
- Stale cache (broken expiration)

Understanding these nuances helps when debugging cache issues and when extending the caching system.

