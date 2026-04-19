/**
 * Critique Extractors — parse free-text VLM critiques into structured issues,
 * cluster across judges for consensus, and detect spirals across iterations.
 *
 * These are pure functions over text and lists. They assume the prompt asks
 * the VLM to emit one issue per line in a recognizable severity-anchored
 * format, e.g.:
 *
 *   [SEVERITY] MM:SS — short description
 *   [FIXED]    MM:SS — was-broken-now-clean description
 *
 * The default regex tolerates a small amount of free text between the
 * timestamp and the dash so judges that inject a region/mode tag (e.g.
 * `[MAJOR] 00:42 light — desc`) still parse. Severity is case-insensitive.
 *
 * Intended as a substrate for tour-style iterated critique loops where the
 * same scenes are re-judged across many code changes; the cluster+spiral
 * pair lets a thin script do all the consensus work without redoing the
 * regex/clustering plumbing.
 *
 * Quick start:
 *
 *   import { extractIssues, findConsensus, detectSpirals }
 *     from '@arclabs561/ai-visual-test/extractors';
 *
 *   const flashIssues = extractIssues(flashCritiqueText);
 *   const proIssues   = extractIssues(proCritiqueText);
 *   const clusters    = findConsensus({ flash: flashIssues, pro: proIssues });
 *   const prevFixedSecs = extractFixedTimestamps(prevIterText)
 *     .map(({timestamp}) => timestampToSeconds(timestamp));
 *   const spirals = detectSpirals({ flash: flashIssues, pro: proIssues }, new Set(prevFixedSecs));
 */

const DEFAULT_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'NITPICK', 'FIXED'];

/**
 * Convert MM:SS or HH:MM:SS to total seconds.
 * @param {string} ts
 * @returns {number}
 */
export function timestampToSeconds(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

/**
 * Extract issue lines from a critique text.
 *
 * Matches `[SEVERITY] MM:SS [optional tag] (— or – or - or :) desc` lines,
 * tolerating up to 40 chars of inline tag text between timestamp and the
 * dash/colon separator.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {string[]} [opts.severities] - allowed severity tokens (default
 *   CRITICAL/MAJOR/MINOR/NITPICK/FIXED)
 * @returns {{severity:string, timestamp:string, desc:string}[]}
 */
export function extractIssues(text, opts = {}) {
  const sevs = opts.severities || DEFAULT_SEVERITIES;
  const sevPattern = sevs.join('|');
  const re = new RegExp(
    `\\[(${sevPattern})\\]\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)[^—–\\-:\\n]{0,40}[—–\\-:]\\s*(.+)`,
    'gi'
  );
  /** @type {{severity:string, timestamp:string, desc:string}[]} */
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push({
      severity: m[1].toUpperCase(),
      timestamp: m[2],
      desc: m[3].trim(),
    });
  }
  return out;
}

/**
 * Extract just the FIXED-tagged items from a critique. Convenience wrapper
 * over extractIssues for the spiral-detection use case.
 *
 * @param {string} text
 * @param {object} [opts]
 * @returns {{severity:string, timestamp:string, desc:string}[]}
 */
export function extractFixedTimestamps(text, opts = {}) {
  return extractIssues(text, { ...opts, severities: ['FIXED'] });
}

/**
 * Cluster issues across multiple judges by timestamp window. A cluster is
 * "consensus" iff it contains items from >= minJudges distinct judges.
 *
 * @param {Record<string, {severity:string,timestamp:string,desc:string}[]>} byJudge
 *   Map of judge-name → issues from extractIssues.
 * @param {object} [opts]
 * @param {number} [opts.windowSeconds=5] - cluster radius in seconds
 * @param {number} [opts.minJudges=2] - minimum distinct judges per cluster
 * @returns {{cluster: any[], judges: string[]}[]}
 *   Sorted by min severity (CRITICAL first), then by earliest timestamp.
 */
export function findConsensus(byJudge, opts = {}) {
  const win = opts.windowSeconds ?? 5;
  const minJudges = opts.minJudges ?? 2;
  /** @type {any[]} */
  const all = [];
  for (const [judge, issues] of Object.entries(byJudge)) {
    for (const i of issues) all.push({ ...i, judge, sec: timestampToSeconds(i.timestamp) });
  }
  all.sort((a, b) => a.sec - b.sec);
  /** @type {{cluster: any[], judges: string[]}[]} */
  const clusters = [];
  const used = new Set();
  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const cluster = [all[i]];
    used.add(i);
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(all[j].sec - all[i].sec) <= win) {
        cluster.push(all[j]);
        used.add(j);
      }
    }
    const judges = new Set(cluster.map((c) => c.judge));
    if (judges.size >= minJudges) clusters.push({ cluster, judges: [...judges] });
  }
  /** @type {Record<string, number>} */
  const sevOrder = { CRITICAL: 0, MAJOR: 1, MINOR: 2, NITPICK: 3, FIXED: 4 };
  clusters.sort((a, b) => {
    const sa = Math.min(...a.cluster.map((c) => sevOrder[c.severity] ?? 9));
    const sb = Math.min(...b.cluster.map((c) => sevOrder[c.severity] ?? 9));
    if (sa !== sb) return sa - sb;
    return a.cluster[0].sec - b.cluster[0].sec;
  });
  return clusters;
}

/**
 * Flag items in the current iter that re-raise an issue at a timestamp
 * the previous iter marked FIXED. Strong signal that the judge is either
 * hallucinating regressions OR the code change accidentally re-broke a
 * previously-fixed item.
 *
 * @param {Record<string, {severity:string,timestamp:string,desc:string}[]>} currentByJudge
 * @param {Set<number>} prevFixedSecs - set of seconds-as-numbers previously fixed
 * @param {object} [opts]
 * @param {number} [opts.windowSeconds=5]
 * @returns {{judge:string, severity:string, timestamp:string, desc:string, prevFixedSec:number}[]}
 */
export function detectSpirals(currentByJudge, prevFixedSecs, opts = {}) {
  const win = opts.windowSeconds ?? 5;
  /** @type {{judge:string, severity:string, timestamp:string, desc:string, prevFixedSec:number}[]} */
  const warnings = [];
  for (const [judge, issues] of Object.entries(currentByJudge)) {
    for (const i of issues) {
      if (i.severity === 'FIXED') continue;
      const sec = timestampToSeconds(i.timestamp);
      for (const fsec of prevFixedSecs) {
        if (Math.abs(sec - fsec) <= win) {
          warnings.push({ judge, severity: i.severity, timestamp: i.timestamp, desc: i.desc, prevFixedSec: fsec });
          break;
        }
      }
    }
  }
  return warnings;
}
