#!/usr/bin/env node
// Local evidence ledger only. Browser and model operations belong to the skill.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const DEFAULTS = Object.freeze({
  targets: { douyin: 25, xiaohongshu: 25 }, minNew: 35, minRecommended: 15,
  practicalSlots: 10, minIntervalMinutes: 20, shortWindowHours: 6,
  lowFollowerCeiling: 5000, lowLikeCeiling: 1000, minNewLikes: 10,
  minRelativeGrowth: 0.5, fastLikesPerHour: 100, accelerationRatio: 2,
});
const ASSET_KINDS = new Set(['caption', 'page_screenshot', 'original_image', 'video', 'clip',
  'frame', 'original_subtitles', 'transcript_candidate', 'platform_summary', 'image_text',
  'comments', 'source_page', 'source_image', 'research_note', 'metric_snapshot']);
const METRIC_ASSET_KINDS = new Set(['page_screenshot', 'metric_snapshot']);
const READ_KINDS = new Set(['caption_body', 'image_text', 'video_fragment', 'original_subtitles', 'verified_transcript']);
const METRICS = new Set(['likes', 'favorites', 'comments', 'shares', 'followers']);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/;
function check(ok, message) { if (!ok) throw new Error(message); }
function nonempty(s) { return typeof s === 'string' && s.trim().length > 0; }
function id(s) { check(typeof s === 'string' && SAFE_ID.test(s), `Invalid ID: ${s}`); }
function time(s) {
  const parts = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(s);
  check(parts, `Timezone-qualified timestamp required: ${s}`);
  const [, y, mo, d, h, mi, sec, oh = 0, om = 0] = parts.map((v, i) => i === 0 ? v : v === undefined ? undefined : Number(v));
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  check(mo >= 1 && mo <= 12 && d >= 1 && d <= days[mo - 1] && h <= 23 && mi <= 59 && sec <= 59 && oh <= 23 && om <= 59 && Number.isFinite(Date.parse(s)), `Invalid calendar timestamp: ${s}`);
  return Date.parse(s);
}
function validateMetric(k, m) {
  check(METRICS.has(k), `Unknown public metric: ${k}`);
  check(m && ['exact', 'rounded', 'unavailable'].includes(m.precision) && typeof m.raw === 'string', 'Metric precision/raw required');
  if (m.precision === 'exact') {
    check(Number.isSafeInteger(m.value) && m.value >= 0 && /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(m.raw) && Number(m.raw.replaceAll(',', '')) === m.value, `Exact ${k} needs a matching integer display`);
  } else check(m.value === null, 'Rounded/unavailable metrics must have value:null');
}
function url(s) { const u = new URL(s); check(['http:', 'https:'].includes(u.protocol) && !u.username && !u.password, 'Expected public HTTP(S) URL'); return s; }
function relativeFile(root, file) {
  check(nonempty(file) && !path.isAbsolute(file) && !/^[A-Za-z]:|\\|\0/.test(file), 'Use a store-relative path with forward slashes');
  const resolved = path.resolve(root, file), rel = path.relative(path.resolve(root), resolved);
  check(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), `Path escapes store: ${file}`);
  const realRoot = fs.realpathSync(root), realFile = fs.realpathSync(resolved), realRel = path.relative(realRoot, realFile);
  check(realRel && realRel !== '..' && !realRel.startsWith(`..${path.sep}`) && !path.isAbsolute(realRel), `Symlink escapes store: ${file}`);
  check(fs.statSync(realFile).isFile() && fs.statSync(realFile).size > 0, `Missing/empty asset: ${file}`);
  return realFile;
}
function digest(root, file) { return crypto.createHash('sha256').update(fs.readFileSync(relativeFile(root, file))).digest('hex'); }
function fileKey(root, file) {
  const real = relativeFile(root, file), stat = fs.statSync(real, { bigint: true });
  return stat.ino !== 0n ? `inode:${stat.dev}:${stat.ino}` : `path:${assetKey(real)}`;
}
function config(input = {}) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid config');
  for (const k of Object.keys(input)) check(k in DEFAULTS, `Unknown config key: ${k}`);
  const c = { ...DEFAULTS, ...input, targets: { ...DEFAULTS.targets, ...input.targets } };
  check(Object.keys(c.targets).every(k => ['douyin', 'xiaohongshu'].includes(k)), 'Unknown target platform');
  for (const v of Object.values(c.targets)) check(Number.isSafeInteger(v) && v >= 0, 'Targets must be nonnegative integers');
  check(c.targets.douyin + c.targets.xiaohongshu > 0, 'Round needs a positive target');
  for (const [k, v] of Object.entries(c)) if (k !== 'targets') check(Number.isFinite(v) && v >= 0, `Invalid config value: ${k}`);
  for (const k of ['minNew', 'minRecommended', 'practicalSlots', 'lowFollowerCeiling', 'lowLikeCeiling', 'minNewLikes']) check(Number.isSafeInteger(c[k]), `${k} must be an integer`);
  check(c.minIntervalMinutes > 0 && c.shortWindowHours * 60 >= c.minIntervalMinutes && c.accelerationRatio > 1, 'Invalid growth windows');
  return c;
}
function files(root) {
  const dir = path.join(root, 'events');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^\d{8}-[a-zA-Z0-9_.-]+\.json$/.test(n)).sort() : [];
}
function load(root) { return files(root).map(n => JSON.parse(fs.readFileSync(path.join(root, 'events', n), 'utf8'))); }
function assetKey(file) {
  const normalized = path.posix.normalize(file);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function registeredAssets(events) {
  const known = new Map();
  for (const e of events) if (e.type === 'capture') for (const asset of e.assets) {
    const key = assetKey(asset.path);
    if (!known.has(key)) known.set(key, { workId: e.work.id, asset });
  }
  return known;
}
function assetsFor(events, workId) {
  // A legacy cross-work registration must not transfer the first owner's evidence.
  return [...registeredAssets(events).values()].filter(a => a.workId === workId).map(a => a.asset);
}
function observationEvidence(e, prior, root) {
  const known = new Map();
  // The first registration owns the timestamp/metric readings for a path.
  for (const a of assetsFor(prior, e.workId)) if (!known.has(a.path)) known.set(a.path, a);
  check(Array.isArray(e.evidencePaths) && e.evidencePaths.length > 0, 'Fresh metric evidence required');
  const referenced = e.evidencePaths.map(p => known.get(p));
  for (const a of referenced) {
    check(a && METRIC_ASSET_KINDS.has(a.kind) && a.metrics && time(a.capturedAt) === time(e.sampledAt), 'Observation requires metric-bearing evidence captured at its sampling time');
  }
  for (const [k, m] of Object.entries(e.metrics)) {
    const sources = referenced.filter(a => Object.hasOwn(a.metrics, k));
    check(sources.length > 0 && sources.every(a => isDeepStrictEqual(a.metrics[k], m)), `Observation ${k} does not match its captured metric reading`);
  }
  if (root) for (const a of referenced) check(digest(root, a.path) === a.sha256, `Registered asset changed: ${a.path}`);
}
function eligible(e) {
  return e.type === 'capture' && new Set(e.assets.map(a => assetKey(a.path))).size === e.assets.length && e.readKinds.some(k => READ_KINDS.has(k)) && e.assets.some(a => ['page_screenshot', 'video', 'clip'].includes(a.kind)) && e.assets.some(a => a.kind === 'caption');
}
function validate(root, e, prior) {
  check(e && typeof e === 'object' && !Array.isArray(e), 'Event object required');
  id(e.id); const recorded = time(e.recordedAt);
  const round = prior.find(x => x.type === 'round_started' && x.roundId === e.roundId);
  const work = prior.find(x => x.type === 'capture' && x.work.id === e.workId);
  const requireWork = () => check(work, `Unknown work: ${e.workId}`);
  const knownPaths = () => new Set(assetsFor(prior, e.workId).map(a => a.path));
  const evidence = (paths) => { check(Array.isArray(paths) && paths.length > 0, 'Evidence paths required'); const known = knownPaths(); for (const p of paths) check(known.has(p), `Evidence not captured for work: ${p}`); };
  if (e.type === 'round_started') {
    id(e.roundId); check(!round, 'Round already exists');
    check(nonempty(e.timezone), 'Round timezone required'); new Intl.DateTimeFormat('en', { timeZone: e.timezone });
    e.config = config(e.config); check(nonempty(e.profile), 'Creator profile required');
  } else if (e.type === 'attempt') {
    check(round, 'Unknown round'); id(e.attemptId);
    check(['running', 'paused', 'partial', 'completed'].includes(e.status), 'Invalid attempt status');
    check(nonempty(e.reason), 'Attempt reason required');
    if (e.platform) check(['douyin', 'xiaohongshu'].includes(e.platform), 'Invalid paused platform');
    if (e.status === 'completed') check(roundStats(prior, round).coverageComplete, 'Round count/coverage targets not met; save partial');
  } else if (e.type === 'capture') {
    check(round, 'Unknown round');
    check(e.work && ['douyin', 'xiaohongshu'].includes(e.work.platform), 'Invalid work platform');
    check(typeof e.work.id === 'string' && new RegExp(`^${e.work.platform}:[a-zA-Z0-9_-]+$`).test(e.work.id), 'Use platform:native-id');
    url(e.work.url); check(nonempty(e.work.title) && nonempty(e.work.author), 'Work title and author required');
    check(['published', 'edited', 'unknown'].includes(e.work.dateKind) && typeof e.work.dateLabel === 'string', 'Date kind/label required');
    if (e.work.publishedAt != null) { check(e.work.dateKind === 'published', 'Edited/unknown dates cannot become publication dates'); time(e.work.publishedAt); }
    check(['recommendation', 'related', 'search', 'direct'].includes(e.route), 'Invalid discovery route');
    check(Array.isArray(e.readKinds) && e.readKinds.every(k => READ_KINDS.has(k)), 'Invalid substantive read kind (summaries/title cards do not count)');
    check(typeof e.coverage === 'string' && Array.isArray(e.gaps), 'Coverage and gaps required');
    check(Array.isArray(e.assets) && e.assets.length > 0, 'Assets required');
    check(new Set(e.assets.map(a => fileKey(root, a.path))).size === e.assets.length, 'Duplicate asset path');
    const registered = registeredAssets(prior);
    for (const a of e.assets) {
      check(ASSET_KINDS.has(a.kind), `Invalid asset kind: ${a.kind}`); url(a.sourceUrl);
      check(time(a.capturedAt) <= recorded, 'Asset capture time is after event time');
      check(nonempty(a.coverage), 'Asset coverage required');
      if (a.metrics !== undefined) {
        check(METRIC_ASSET_KINDS.has(a.kind) && a.metrics && Object.keys(a.metrics).length > 0, 'Metric readings require a page screenshot or visible-page metric snapshot');
        for (const [k, m] of Object.entries(a.metrics)) validateMetric(k, m);
      }
      if (a.kind === 'metric_snapshot') check(a.metrics !== undefined, 'Metric snapshot readings required');
      if (a.kind === 'clip') check(Number.isFinite(a.startSeconds) && a.startSeconds >= 0 && Number.isFinite(a.endSeconds) && a.endSeconds > a.startSeconds, 'Clip needs actual start/end seconds');
      if (a.kind === 'transcript_candidate') check(['ai_extracted_unverified', 'partial', 'verified'].includes(a.status), 'Transcript status required');
      const hash = digest(root, a.path); if (a.sha256) check(a.sha256 === hash, `Asset changed: ${a.path}`); a.sha256 = hash;
      const old = registered.get(assetKey(a.path));
      if (old) {
        check(old.workId === e.work.id, 'Asset path already registered for another work; use a new path');
        check(isDeepStrictEqual(old.asset, a), 'Registered asset and its metadata are immutable; use a new path');
      }
    }
    if (e.readKinds.includes('verified_transcript')) check(e.assets.some(a => a.kind === 'transcript_candidate' && a.status === 'verified'), 'Verified transcript evidence required');
  } else if (e.type === 'observation') {
    requireWork(); check(round, 'Unknown round'); check(time(e.sampledAt) <= recorded, 'Sample time is after event time');
    check(e.metrics && Object.keys(e.metrics).length > 0, 'Metrics required');
    for (const [k, m] of Object.entries(e.metrics)) {
      validateMetric(k, m);
      check(!prior.some(x => x.type === 'observation' && x.workId === e.workId && time(x.sampledAt) === time(e.sampledAt) && k in x.metrics), `Duplicate ${k} at sample time`);
    }
    observationEvidence(e, prior);
  } else if (e.type === 'review') {
    requireWork(); evidence(e.evidencePaths);
    check(['shortlist', 'watch', 'archive'].includes(e.recommendation), 'Invalid recommendation');
    for (const k of ['summary', 'opportunity', 'angle']) check(nonempty(e[k]), `Review ${k} required`);
    check(Array.isArray(e.captureIds) && e.captureIds.length > 0, 'Read capture IDs required');
    const readCaptures = e.captureIds.map(cid => {
      const capture = prior.find(x => x.type === 'capture' && x.id === cid && x.work.id === e.workId);
      check(capture, 'Review capture not saved for this work');
      return capture;
    });
    check(readCaptures.some(eligible), 'Review requires a substantive eligible capture');
    check(Array.isArray(e.gaps) && Array.isArray(e.sourceRefs) && Array.isArray(e.claims), 'Review gaps, claims and sourceRefs arrays required');
    for (const s of e.sourceRefs) { url(s.url); check(['exact', 'account_clue', 'unverified'].includes(s.status) && nonempty(s.note), 'Source status/note required'); }
    for (const c of e.claims) { check(nonempty(c.text) && ['verified', 'author_report', 'inference', 'unresolved'].includes(c.status), 'Invalid claim'); evidence(c.evidencePaths); }
    check(Array.isArray(e.comments), 'Comments array required (empty means no verified discussion)');
    const commentPaths = new Set(assetsFor(prior, e.workId).filter(a => a.kind === 'comments').map(a => a.path));
    for (const c of e.comments) {
      check(['douyin', 'xiaohongshu', 'x'].includes(c.platform) && ['disagreement', 'request', 'meme', 'support', 'ai', 'other'].includes(c.kind), 'Comment platform/kind required');
      check(Number.isSafeInteger(c.sampledCount) && c.sampledCount > 0 && nonempty(c.summary), 'Comment count/summary required'); evidence(c.evidencePaths);
      check(c.evidencePaths.some(p => commentPaths.has(p)), 'Comment summary requires captured comments evidence');
    }
  } else if (e.type === 'task') {
    requireWork(); check(round, 'Unknown round'); id(e.taskId);
    check(['revisit', 'backfill'].includes(e.kind) && ['pending', 'done', 'cancelled'].includes(e.status) && nonempty(e.reason), 'Invalid task');
    if (e.dueAt != null) time(e.dueAt);
    const previous = prior.findLast(x => x.type === 'task' && x.taskId === e.taskId);
    if (previous) check(previous.workId === e.workId && previous.roundId === e.roundId && previous.kind === e.kind, 'Task identity is immutable');
    if (e.kind === 'revisit') {
      const baseline = prior.find(x => x.id === e.baselineObservationId && x.type === 'observation' && x.workId === e.workId && x.metrics.likes);
      check(baseline, 'Revisit needs a saved like observation');
      observationEvidence(baseline, prior.slice(0, prior.indexOf(baseline)));
      check(time(e.dueAt) >= time(baseline.sampledAt) + round.config.minIntervalMinutes * 60000, 'Revisit is earlier than the minimum interval');
      if (e.status === 'done') check(prior.some((x, i) => {
        if (x.type !== 'observation' || x.workId !== e.workId || !x.metrics.likes || time(x.sampledAt) < time(e.dueAt)) return false;
        try { observationEvidence(x, prior.slice(0, i), root); return true; } catch { return false; }
      }), 'No due-time revisit observation saved');
    }
  } else if (e.type === 'decision') {
    requireWork(); check(['selected', 'watch', 'rejected'].includes(e.decision), 'Invalid decision');
    check(nonempty(e.userRequest) && nonempty(e.reason), 'Preserve actual user selection/feedback');
  } else if (e.type === 'draft') {
    requireWork(); const selection = prior.findLast(x => x.type === 'decision' && x.workId === e.workId);
    check(selection && selection.decision === 'selected' && selection.id === e.selectionEventId, 'Draft requires the current explicit user selection');
    const currentReview = prior.findLast(x => x.type === 'review' && x.workId === e.workId);
    check(currentReview && currentReview.id === e.reviewId, 'Draft must reference the current review revision');
    check(e.status === 'draft', 'Generated script remains draft');
    if (e.hashes === undefined) e.hashes = {};
    check(e.hashes && typeof e.hashes === 'object' && !Array.isArray(e.hashes), 'Draft hashes must be a plain object');
    const draftKeys = ['briefPath', 'scriptPath', 'evidencePath'];
    const resolved = Object.fromEntries(draftKeys.map(k => [k, fileKey(root, e[k])]));
    check(new Set(Object.values(resolved)).size === 3, 'Brief, script and evidence must be separate files');
    for (const k of ['briefPath', 'scriptPath', 'evidencePath']) {
      const hash = digest(root, e[k]); if (e.hashes[k]) check(e.hashes[k] === hash, `Draft file changed: ${e[k]}`);
      for (const old of prior.filter(x => x.type === 'draft')) for (const oldKey of ['briefPath', 'scriptPath', 'evidencePath']) {
        if (fileKey(root, old[oldKey]) === resolved[k]) check(old.hashes[oldKey] === hash, `Registered draft cannot be overwritten: ${e[k]}`);
      }
      e.hashes[k] = hash;
    }
  } else throw new Error(`Unknown event type: ${e.type}`);
  return e;
}
function verifyFiles(root, events) {
  for (const e of events) {
    if (e.type === 'capture') for (const a of e.assets) check(digest(root, a.path) === a.sha256, `Registered asset changed: ${a.path}`);
    if (e.type === 'draft') for (const k of ['briefPath', 'scriptPath', 'evidencePath']) check(digest(root, e[k]) === e.hashes[k], `Registered draft changed: ${e[k]}`);
  }
}
function referencedPaths(input, events) {
  const byId = new Map(events.map(e => [e.id, e])), seen = new Set(), refs = new Set(), pending = [input];
  const add = paths => { if (Array.isArray(paths)) for (const p of paths) if (typeof p === 'string') refs.add(assetKey(p)); };
  while (pending.length) {
    const e = pending.pop(); if (seen.has(e.id)) continue; seen.add(e.id);
    add(e.evidencePaths); add(e.assets?.map(a => a.path));
    for (const c of [...(e.claims || []), ...(e.comments || [])]) add(c.evidencePaths);
    add([e.briefPath, e.scriptPath, e.evidencePath]);
    const ids = [...(Array.isArray(e.captureIds) ? e.captureIds : []), e.baselineObservationId, e.reviewId, e.selectionEventId];
    for (const id of ids) if (byId.has(id)) pending.push(byId.get(id));
    if (e.type === 'attempt' && e.status === 'completed') {
      pending.push(...events.filter(c => c.type === 'capture' && c.roundId === e.roundId && eligible(c)));
    }
  }
  return refs;
}
function append(root, input) {
  root = path.resolve(root); fs.mkdirSync(path.join(root, 'events'), { recursive: true });
  const lock = path.join(root, '.writer.lock');
  let fd; try { fd = fs.openSync(lock, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw new Error('Writer locked; inspect the active writer before retrying'); throw error; }
  try {
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); fs.fsyncSync(fd);
    const events = load(root);
    const e = JSON.parse(JSON.stringify(input)), existing = events.find(x => x.id === e.id);
    // Hash only reused/referenced files on append; do not reread every historical
    // video for each metric sample. status/render perform the full integrity pass.
    const refs = referencedPaths(e, events);
    for (const old of events) {
      if (old.type === 'capture') for (const a of old.assets) {
        if (refs.has(assetKey(a.path))) check(digest(root, a.path) === a.sha256, `Registered asset changed: ${a.path}`);
      }
      if (old.type === 'draft') for (const k of ['briefPath', 'scriptPath', 'evidencePath']) {
        if (refs.has(assetKey(old[k]))) check(digest(root, old[k]) === old.hashes[k], `Registered draft cannot be overwritten: ${old[k]}`);
      }
    }
    // Replaying an unchanged legacy record makes no new assertion. Unsupported
    // historical observations remain excluded by snapshot's evidence checks.
    if (existing && e.type === 'observation' && isDeepStrictEqual(existing, e)) return { appended: false, id: e.id };
    const normalized = validate(root, e, existing ? events.slice(0, events.indexOf(existing)) : events);
    if (existing) { check(isDeepStrictEqual(existing, normalized), `Conflicting replay: ${e.id}`); return { appended: false, id: e.id }; }
    const n = files(root).length + 1; check(n <= 99999999, 'Ledger sequence exhausted');
    const target = path.join(root, 'events', `${String(n).padStart(8, '0')}-${e.id}.json`);
    const tmp = `${target}.${crypto.randomUUID()}.tmp`;
    const out = fs.openSync(tmp, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(normalized, null, 2)}\n`); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    check(!fs.existsSync(target), 'Sequence conflict'); fs.renameSync(tmp, target);
    return { appended: true, id: e.id };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function roundStats(events, round) {
  const captures = events.filter(e => e.type === 'capture' && e.roundId === round.roundId && eligible(e));
  const distinct = new Map(); for (const e of captures) if (!distinct.has(e.work.id)) distinct.set(e.work.id, e);
  const platformCounts = { douyin: 0, xiaohongshu: 0 }, recommended = { douyin: 0, xiaohongshu: 0 };
  let newWorks = 0, practical = 0;
  const roundIndex = events.indexOf(round);
  for (const [wid, first] of distinct) {
    platformCounts[first.work.platform]++;
    if (['recommendation', 'related'].includes(first.route)) recommended[first.work.platform]++;
    if (!events.slice(0, roundIndex).some(e => e.type === 'capture' && eligible(e) && e.work.id === wid)) newWorks++;
    if (captures.some(e => e.work.id === wid && e.practicalMethod === true)) practical++;
  }
  const c = round.config, countComplete = Object.keys(platformCounts).every(k => platformCounts[k] >= c.targets[k]);
  const coverageComplete = countComplete && newWorks >= c.minNew && practical >= c.practicalSlots && Object.keys(recommended).every(k => !c.targets[k] || recommended[k] >= c.minRecommended);
  return { unique: distinct.size, repeatReads: captures.length - distinct.size, platformCounts, recommended, newWorks, practical, countComplete, coverageComplete };
}
function growth(observations, c = DEFAULTS) {
  const points = observations.filter(o => o.metrics.likes && o.metrics.likes.precision !== 'unavailable').sort((a, b) => time(a.sampledAt) - time(b.sampledAt));
  const result = { status: 'single_snapshot', delta: null, perHour: null, relative: null, lowLikeFast: false, fast: false, accelerating: false, points: points.map(o => ({ id: o.id, at: o.sampledAt, ...o.metrics.likes })) };
  if (points.length < 2) return result;
  const b = points.at(-1), a = points.at(-2);
  result.from = a.sampledAt; result.to = b.sampledAt;
  if (a.metrics.likes.precision !== 'exact' || b.metrics.likes.precision !== 'exact') return { ...result, status: 'rounded_counts' };
  const minutes = (time(b.sampledAt) - time(a.sampledAt)) / 60000, delta = b.metrics.likes.value - a.metrics.likes.value;
  result.delta = delta; result.minutes = minutes;
  if (delta < 0) return { ...result, status: 'count_decreased' };
  if (minutes < c.minIntervalMinutes) return { ...result, status: 'interval_too_short' };
  result.perHour = delta / (minutes / 60);
  result.relative = a.metrics.likes.value > 0 ? delta / a.metrics.likes.value : null;
  if (minutes > c.shortWindowHours * 60) return { ...result, status: 'cross_round_average' };
  result.status = 'short_window';
  result.lowLikeFast = b.metrics.likes.value < c.lowLikeCeiling && delta >= c.minNewLikes && (a.metrics.likes.value === 0 || result.relative >= c.minRelativeGrowth);
  result.fast = delta >= c.minNewLikes && result.perHour >= c.fastLikesPerHour;
  if (points.length >= 3 && delta >= c.minNewLikes) {
    const p = points.at(-3), previousMinutes = (time(a.sampledAt) - time(p.sampledAt)) / 60000;
    if (p.metrics.likes.precision === 'exact' && previousMinutes >= c.minIntervalMinutes && previousMinutes <= c.shortWindowHours * 60) {
      const previousSpeed = (a.metrics.likes.value - p.metrics.likes.value) / (previousMinutes / 60);
      result.accelerating = previousSpeed > 0 && result.perHour >= previousSpeed * c.accelerationRatio;
    }
  }
  return result;
}
function snapshot(events, now = new Date().toISOString()) {
  time(now); const works = new Map(), rounds = events.filter(e => e.type === 'round_started');
  const observationChecks = new Map();
  for (let i = 0; i < events.length; i++) if (events[i].type === 'observation') {
    try { observationEvidence(events[i], events.slice(0, i)); observationChecks.set(events[i].id, null); }
    catch (error) { observationChecks.set(events[i].id, error.message); }
  }
  const taskMap = new Map(); for (const e of events) if (e.type === 'task') taskMap.set(e.taskId, e);
  for (const e of events) if (e.type === 'capture') works.set(e.work.id, e.work);
  const items = [...works].map(([workId, work]) => {
    const captures = events.filter(e => e.type === 'capture' && e.work.id === workId);
    const allObservations = events.filter(e => e.type === 'observation' && e.workId === workId);
    const evidenceGaps = allObservations.filter(e => observationChecks.get(e.id)).map(e => ({ observationId: e.id, sampledAt: e.sampledAt, reason: observationChecks.get(e.id) }));
    const observations = allObservations.filter(e => !observationChecks.get(e.id)).sort((a, b) => time(a.sampledAt) - time(b.sampledAt));
    const latest = {}; for (const o of observations) for (const [k, v] of Object.entries(o.metrics)) if (v.precision !== 'unavailable') latest[k] = { ...v, sampledAt: o.sampledAt, observationId: o.id };
    const metricConfig = metric => {
      const sample = observations.find(o => o.id === latest[metric]?.observationId);
      return rounds.find(r => r.roundId === sample?.roundId)?.config || DEFAULTS;
    };
    const review = events.findLast(e => e.type === 'review' && e.workId === workId) || null;
    return { work, captures, latest, evidenceGaps, growth: growth(observations, metricConfig('likes')),
      lowFollower: latest.followers?.precision === 'exact' ? latest.followers.value <= metricConfig('followers').lowFollowerCeiling : null,
      review, decision: events.findLast(e => e.type === 'decision' && e.workId === workId) || null,
      drafts: events.filter(e => e.type === 'draft' && e.workId === workId) };
  });
  return { generatedAt: now, eventCount: events.length, items,
    rounds: rounds.map(r => ({ ...r, ...roundStats(events, r), attempts: events.filter(e => e.type === 'attempt' && e.roundId === r.roundId) })),
    tasks: [...taskMap.values()].map(t => ({ ...t, due: t.status === 'pending' && (t.dueAt == null || time(t.dueAt) <= time(now)) })) };
}
function main(argv) {
  const command = argv[0], opts = {};
  for (let i = 1; i < argv.length; i += 2) { check(argv[i].startsWith('--') && argv[i + 1], 'Use --name value options'); check(['--store', '--input', '--out', '--now'].includes(argv[i]), `Unknown option: ${argv[i]}`); opts[argv[i].slice(2)] = argv[i + 1]; }
  check(opts.store, 'Usage: radar.cjs append|status|render --store <directory> [--input event.json] [--out report-directory] [--now ISO-time]');
  check(['append', 'status', 'render'].includes(command), 'Unknown command');
  if (command === 'append') { check(opts.input, '--input required'); return append(opts.store, JSON.parse(fs.readFileSync(opts.input, 'utf8').replace(/^\uFEFF/, ''))); }
  const events = load(opts.store); verifyFiles(opts.store, events); const state = snapshot(events, opts.now);
  if (command === 'render') { check(opts.out, '--out required'); return require('./render-radar.cjs').writeReport(state, opts.store, opts.out); }
  return state;
}
if (require.main === module) { try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { DEFAULTS, append, load, snapshot, growth, roundStats, eligible, verifyFiles, relativeFile, main };
