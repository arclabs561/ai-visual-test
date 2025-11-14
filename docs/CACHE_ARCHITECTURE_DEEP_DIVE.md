# Cache Architecture Deep Dive

## Overview: We Have THREE Different Cache Systems

This codebase has **three separate, independent cache systems** that don't know about each other:

1. **VLLM Cache** (`src/cache.mjs`) - File-based, persistent, for API responses
2. **Batch Optimizer Cache** (`src/batch-optimizer.mjs`) - In-memory Map, for request batching
3. **Temporal Preprocessing Cache** (`src/temporal-preprocessor.mjs`) - In-memory object, for temporal aggregations

## System 1: VLLM Cache (File-Based, Persistent)

**Location**: `src/cache.mjs`

**Purpose**: Cache VLLM API responses to disk to avoid redundant API calls

**Storage**: File-based JSON (`test-results/vllm-cache/cache.json`)

**Key Generation**: SHA-256 hash of `{imagePath, prompt, testType, frame, score, viewport, gameState}`

**Lifetime**: 7 days (MAX_CACHE_AGE)

**Size Limits**: 
- 1000 entries (MAX_CACHE_SIZE)
- 100MB file size (MAX_CACHE_SIZE_BYTES)

**Eviction**: LRU (Least Recently Used) - sorts by `_lastAccessed` timestamp

**Weird Things**:

### 1. Timestamp Reset on Save ✅ FIXED

**The Bug** (FIXED 2025-01):
```javascript
// OLD CODE (BUGGY):
const entries = Array.from(cache.entries())
  .map(([key, value]) => ({
    key,
    value,
    timestamp: now // All entries get current timestamp on save - WRONG!
  }))
```

**Problem**: Every time we save the cache, ALL entries got a NEW timestamp (current time). This meant:
- Old entries that should expire didn't expire
- The 7-day expiration was effectively broken
- Entries never aged out based on creation time

**Impact**: Cache file grew unbounded until size limits hit, then LRU eviction kicked in

**The Fix**: 
- Preserve `_originalTimestamp` from loaded cache
- Only set `timestamp: now` for NEW entries
- Use `_originalTimestamp` for expiration checks
- Use `_lastAccessed` for LRU eviction

**Status**: ✅ Fixed - timestamps are now preserved correctly

### 2. LRU Eviction Uses `_lastAccessed`, But Timestamp is Reset

**The Logic**:
- Sort by `_lastAccessed` (oldest first)
- Keep last `MAX_CACHE_SIZE` entries
- But then set `timestamp: now` for ALL entries

**Problem**: 
- We sort by `_lastAccessed` for eviction
- But we reset `timestamp` to `now` for expiration
- These are two different timestamps doing two different things
- `_lastAccessed` is for LRU, `timestamp` is for expiration
- But resetting `timestamp` breaks expiration

**What Should Happen**:
- Preserve original `timestamp` from loaded cache
- Only update `timestamp` for NEW entries
- Use `_lastAccessed` for LRU eviction
- Use `timestamp` for expiration

### 3. Cache Write Lock ✅ FIXED

**The Lock** (FIXED 2025-01):
```javascript
// OLD CODE (BUGGY):
let cacheWriteLock = false; // Simple boolean flag - not thread-safe!

// NEW CODE (FIXED):
import { Mutex } from 'async-mutex';
const cacheWriteMutex = new Mutex(); // Proper async mutex
```

**Problem** (FIXED): 
- Old code used a simple boolean flag, not a proper mutex
- In Node.js, this worked because JavaScript is single-threaded
- But async operations could still interleave, causing race conditions
- No proper queue for waiting writes

**The Fix**:
- Replaced boolean flag with `async-mutex` Mutex
- Proper async mutual exclusion for concurrent save operations
- Ensures only one save operation happens at a time
- Prevents race conditions in async file I/O

**Status**: ✅ Fixed - now uses proper async mutex for thread-safe writes

### 4. Cache Instance is Singleton, But Reset on initCache()

**The Pattern**:
```javascript
let cacheInstance = null; // Singleton

function getCache() {
  if (!cacheInstance) {
    cacheInstance = loadCache();
  }
  return cacheInstance;
}

export function initCache(cacheDir) {
  // ...
  cacheInstance = null; // Reset instance to reload
}
```

**Problem**:
- `initCache()` resets `cacheInstance = null`
- But doesn't actually reload it
- Next `getCache()` call will reload, but timing is weird
- If `initCache()` is called after `getCache()`, the old instance is still in memory

**What Should Happen**:
- Either reload immediately in `initCache()`
- Or document that reset happens on next `getCache()` call

### 5. Cache Key Truncation ✅ FIXED

**The Bug** (FIXED 2025-01):
```javascript
// OLD CODE (BUGGY):
prompt: prompt.substring(0, 1000), // Truncated - causes collisions!
gameState: context.gameState ? JSON.stringify(context.gameState).substring(0, 500) : ''
```

**Problem**: 
- Prompts longer than 1000 chars were truncated
- Game state longer than 500 chars was truncated
- Different prompts/states with same prefix = same cache key = wrong cache hit

**The Fix**:
- Hash the FULL content with SHA-256
- No truncation - SHA-256 handles arbitrary length
- Cryptographically unlikely collisions

**Status**: ✅ Fixed - full content is now hashed

## System 2: Batch Optimizer Cache (In-Memory Map)

**Location**: `src/batch-optimizer.mjs`

**Purpose**: Cache requests within a batch to avoid duplicate API calls

**Storage**: In-memory `Map` (not persistent)

**Key Generation**: String concatenation of `imagePath`, `promptHash`, `contextHash`

**Lifetime**: Process lifetime (cleared on process exit)

**Size Limits**: None (grows unbounded)

**Eviction**: None (cleared manually with `clearCache()`)

**Weird Things**:

### 1. Cache Key is String Concatenation, Not Hash

**The Code**:
```javascript
_getCacheKey(imagePath, prompt, context) {
  const promptHash = prompt ? prompt.substring(0, 100).replace(/\s+/g, '') : '';
  const contextHash = context ? JSON.stringify(context).substring(0, 50) : '';
  return `${imagePath}-${promptHash}-${contextHash}`;
}
```

**Problems**:
- Not a hash, just string concatenation
- Truncation again (100 chars prompt, 50 chars context)
- Collision risk
- No collision detection

**Why It's Weird**: VLLM cache uses SHA-256 hash, but batch optimizer uses string concatenation

### 2. No Size Limits or Eviction

**The Code**:
```javascript
this.cache = cacheEnabled ? new Map() : null;
// No size limits, no eviction
```

**Problem**: 
- Cache grows unbounded
- In long-running processes, memory leak
- No LRU, no TTL, nothing

**Why It Works**: Usually used for short-lived batch operations, so memory doesn't accumulate

**Why It's Weird**: Different from VLLM cache which has limits

### 3. Cache Check Happens Twice

**The Code**:
```javascript
// First check in _queueRequest
if (this.cache && this.cache.has(cacheKey)) {
  return this.cache.get(cacheKey);
}

// Second check in _processQueue (after queuing)
if (this.cache && this.cache.has(cacheKey)) {
  resolve(this.cache.get(cacheKey));
  return;
}
```

**Why**: Race condition protection - another request might have cached it while this one was queued

**Is This Weird?**: Actually makes sense, but could be cleaner

## System 3: Temporal Preprocessing Cache (In-Memory Object)

**Location**: `src/temporal-preprocessor.mjs`

**Purpose**: Cache expensive temporal aggregations during low-activity periods

**Storage**: In-memory object (`preprocessedCache`)

**Key Generation**: None (single cache object, not keyed)

**Lifetime**: Instance lifetime (5 seconds default, `cacheMaxAge`)

**Size Limits**: None (single object, not a map)

**Eviction**: Time-based (age > `cacheMaxAge`) or count-based (>20% note count change)

**Weird Things**:

### 1. Single Cache Object, Not Keyed

**The Code**:
```javascript
this.preprocessedCache = {
  aggregated: null,
  multiScale: null,
  coherence: null,
  prunedNotes: null,
  patterns: null,
  lastPreprocessTime: 0,
  noteCount: 0
};
```

**Problem**: 
- Only ONE cache entry (the most recent preprocessing)
- If you preprocess notes A, then notes B, notes A cache is lost
- Not a map, just a single object

**Why It Works**: Designed for sequential processing (process notes as they come in)

**Why It's Weird**: Different from other caches which are keyed maps

### 2. Cache Validity is Complex

**The Code**:
```javascript
isCacheValid(notes) {
  if (!this.preprocessedCache.aggregated) return false;
  
  const age = Date.now() - this.preprocessedCache.lastPreprocessTime;
  if (age > this.cacheMaxAge) return false; // 5 seconds
  
  // Check if note count changed significantly
  const noteCountDiff = Math.abs(notes.length - this.preprocessedCache.noteCount);
  if (noteCountDiff > notes.length * 0.2) return false; // >20% change
  
  return true;
}
```

**Problems**:
- Two different invalidation strategies (age + count)
- 20% threshold is arbitrary
- Doesn't check if notes actually changed (just count)
- Could have same count but different notes → stale cache

**What Should Happen**:
- Check note content, not just count
- Or hash notes to detect changes
- Or use more sophisticated diff

### 3. Partial Cache Validity

**The Code**:
```javascript
isCachePartiallyValid(notes) {
  if (!this.preprocessedCache.aggregated) return false;
  
  const age = Date.now() - this.preprocessedCache.lastPreprocessTime;
  if (age > this.cacheMaxAge * 2) return false; // Too old even for incremental
  
  return true;
}
```

**Problem**: 
- "Partially valid" means "old but not too old"
- Used for incremental aggregation
- But `_incrementalAggregation()` just calls `aggregateTemporalNotes()` (not actually incremental)

**The Lie**: Says "incremental" but does full recomputation

### 4. Background Preprocessing Doesn't Block

**The Code**:
```javascript
async preprocessInBackground(notes, options = {}) {
  // Skip if already preprocessing
  if (this.preprocessingInProgress) {
    return; // Just return, don't wait
  }
  
  this.preprocessingInProgress = true;
  // ... do expensive work
  this.preprocessingInProgress = false;
}
```

**Problem**: 
- If preprocessing is in progress, we just return
- No queue, no waiting
- Next call might start another preprocessing (race condition)
- The lock (`preprocessingInProgress`) prevents concurrent preprocessing, but doesn't queue

**What Should Happen**:
- Queue preprocessing requests
- Or wait for current preprocessing to finish
- Or cancel and restart with new notes

## Cross-System Issues

### 1. No Coordination Between Caches

**Problem**: 
- VLLM cache caches API responses
- Batch optimizer cache caches requests (before API call)
- Temporal preprocessing cache caches aggregations (after notes collected)

**They Don't Know About Each Other**:
- VLLM cache doesn't know about batch optimizer cache
- Batch optimizer cache doesn't know about VLLM cache
- Temporal preprocessing cache is completely separate

**Impact**: 
- Could cache the same thing in multiple places
- Memory waste
- Inconsistent invalidation

### 2. Different Key Generation Strategies

- **VLLM Cache**: SHA-256 hash of full context
- **Batch Optimizer**: String concatenation with truncation
- **Temporal Preprocessing**: No keys (single object)

**Why This Matters**: 
- Different strategies = different collision risks
- Different invalidation strategies
- Hard to reason about cache behavior

### 3. Different Persistence Strategies

- **VLLM Cache**: File-based, persistent across runs
- **Batch Optimizer**: In-memory, lost on process exit
- **Temporal Preprocessing**: In-memory, lost on instance destruction

**Why This Matters**: 
- VLLM cache survives restarts
- Other caches don't
- Inconsistent behavior

## What's Actually Weird

### 1. VLLM Cache Timestamp Reset

**The Bug**: Every save resets ALL timestamps to `now`, breaking 7-day expiration

**Impact**: Cache never expires based on age, only on size limits

**Fix Needed**: Preserve original timestamps, only update for new entries

### 2. Temporal Preprocessing "Incremental" is a Lie

**The Bug**: `_incrementalAggregation()` just calls `aggregateTemporalNotes()` (full recomputation)

**Impact**: No performance benefit from "incremental" path

**Fix Needed**: Actually implement incremental aggregation, or remove the lie

### 3. Cache Key Truncation in Multiple Places

**The Bug**: Both VLLM cache and batch optimizer truncate keys, causing collisions

**Impact**: Wrong cache hits, incorrect results

**Fix Needed**: Hash full content, don't truncate

### 4. No Coordination Between Caches

**The Bug**: Three independent cache systems, no coordination

**Impact**: Memory waste, inconsistent behavior

**Fix Needed**: Unified cache interface, or at least coordination layer

## Recommendations

### Immediate Fixes

1. **Fix VLLM Cache Timestamp Reset**:
   - Preserve original `timestamp` from loaded cache
   - Only set `timestamp: now` for NEW entries
   - Use `_lastAccessed` for LRU, `timestamp` for expiration

2. **Fix Temporal Preprocessing Incremental**:
   - Either implement real incremental aggregation
   - Or remove the "incremental" path and always do full computation

3. **Fix Cache Key Truncation**:
   - Hash full content, don't truncate
   - Use SHA-256 for all cache keys

### Long-Term Improvements

1. **Unified Cache Interface**:
   - Single cache abstraction
   - Multiple backends (file, memory, etc.)
   - Consistent key generation
   - Coordinated invalidation

2. **Proper Cache Coordination**:
   - VLLM cache and batch optimizer cache should coordinate
   - Avoid duplicate caching
   - Shared invalidation

3. **Better Temporal Preprocessing Cache**:
   - Keyed cache (not single object)
   - Proper incremental aggregation
   - Queue for preprocessing requests

## Context: Why This Happened

Looking at git history:
- `cache.mjs` changed 4 times in 2 months
- `batch-optimizer.mjs` changed 4 times
- `temporal-preprocessor.mjs` is new (just added)

**Evolution**:
1. Started with VLLM cache (file-based, persistent)
2. Added batch optimizer cache (in-memory, for batching)
3. Added temporal preprocessing cache (in-memory, for aggregations)

**Why Separate**: Each was added for different reasons, at different times, by different needs

**Why Weird**: No one stepped back to unify them

## Summary

**Three Cache Systems**:
1. VLLM Cache: File-based, persistent, for API responses
2. Batch Optimizer Cache: In-memory Map, for request batching
3. Temporal Preprocessing Cache: In-memory object, for aggregations

**Key Weirdnesses**:
1. VLLM cache resets timestamps on save (breaks expiration)
2. Temporal preprocessing "incremental" is a lie (does full recomputation)
3. Cache key truncation causes collisions
4. No coordination between caches

**Impact**: 
- Memory waste
- Wrong cache hits
- Broken expiration
- Inconsistent behavior

**Priority**: Fix timestamp reset (high), fix incremental lie (medium), unify caches (long-term)

