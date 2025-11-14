# Cache Timestamp Invariants: Critical Implementation Details

## Overview

The cache system in `src/cache.mjs` uses two different timestamps for different purposes. This document explains the critical invariants to prevent future breakage.

## Two Timestamp System

### 1. `timestamp` (Creation Time) - For Expiration

**Location**: `src/cache.mjs:136, 189, 196`

**Purpose**: Determines if cache entry is older than MAX_CACHE_AGE (7 days)

**Storage**: 
- In file: `{ key: { data: {...}, timestamp: number } }`
- In memory: `entry._originalTimestamp`

**Critical Invariant**: 
- **MUST NOT be reset on save** - This was the bug (2025-01)
- Original timestamp must be preserved across save/load cycles
- Used for 7-day expiration logic

**What breaks if changed**:
- If timestamp is reset to `now` on every save, old entries get new timestamps
- 7-day expiration breaks - entries never expire
- Cache grows unbounded, consuming disk space

**Bug History**:
```javascript
// WRONG (the bug):
timestamp: now  // Resets ALL entries to current time

// CORRECT (the fix):
timestamp: originalTimestamp  // Preserve original creation time
```

### 2. `_lastAccessed` (Access Time) - For LRU Eviction

**Location**: `src/cache.mjs:197, 272`

**Purpose**: Determines which entries to evict when cache exceeds MAX_CACHE_SIZE

**Storage**: In memory only (not saved to file, recalculated on load)

**Critical Invariant**:
- Updated every time entry is accessed (`getCached`)
- Used for LRU (Least Recently Used) eviction
- Separate from expiration logic

**What breaks if changed**:
- LRU eviction would be incorrect
- Most recently used entries might be evicted instead of least recently used
- Cache performance degrades

## Cache Key Generation

**Location**: `src/cache.mjs:78-102`

**Critical Invariant**: **MUST hash full content, never truncate**

**Why**:
- Truncating prompts (1000 chars) causes collisions
- Truncating gameState (500 chars) causes collisions
- Different inputs with same prefix = same cache key = wrong cache hit

**What breaks if changed**:
- Cache collisions return wrong results
- Different prompts with same prefix get same cached result
- Validation results become incorrect

**Implementation**:
```javascript
// CORRECT: Hash full content
const keyString = JSON.stringify({
  imagePath,
  prompt,  // Full, not truncated
  gameState: JSON.stringify(context.gameState)  // Full, not truncated
});
return createHash('sha256').update(keyString).digest('hex');
```

## Save/Load Cycle

**Load** (`loadCache`):
1. Read cache file
2. Filter expired entries (based on `timestamp`)
3. Preserve `_originalTimestamp` in memory

**Save** (`saveCache`):
1. Preserve `timestamp` from `_originalTimestamp` (don't reset!)
2. Remove `_originalTimestamp` from data before saving (it's metadata)
3. Sort by `_lastAccessed` for LRU eviction
4. Keep only MAX_CACHE_SIZE most recently accessed entries

**Critical**: The save operation must preserve original timestamps, not reset them.

## Edge Cases

### Empty Cache
- Returns empty Map, no errors

### Corrupted Cache File
- Gracefully handles malformed JSON
- Returns empty cache (prevents DoS from corrupted files)

### Missing Cache Directory
- Automatically creates directory on init
- No errors if directory doesn't exist

### Concurrent Writes ✅ FIXED
- **OLD**: Simple boolean lock (`cacheWriteLock`) - not thread-safe
- **NEW**: Proper async mutex (`async-mutex` Mutex) - thread-safe
- Prevents race conditions in async save operations
- Ensures only one save operation happens at a time

## Testing Requirements

Any changes must:
1. Test that timestamps are preserved across save/load
2. Test that 7-day expiration works correctly
3. Test that LRU eviction works correctly
4. Test that cache key collisions don't occur
5. Test edge cases (corrupted file, missing directory, etc.)

## Related Code

- `src/cache.mjs` - Full implementation
- `test/cache.test.mjs` - Tests for cache behavior
- `src/constants.mjs` - MAX_CACHE_AGE, MAX_CACHE_SIZE constants

