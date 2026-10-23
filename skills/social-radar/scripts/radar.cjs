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
  'comments', 'source_comments', 'source_page', 'source_image', 'research_note', 'metric_snapshot']);
const METRIC_ASSET_KINDS = new Set(['page_screenshot', 'metric_snapshot']);
const EXTERNAL_ASSET_KINDS = new Set(['source_page', 'source_image', 'source_comments', 'research_note']);
const READ_KINDS = new Set(['caption_body', 'image_text', 'video_fragment', 'original_subtitles', 'verified_transcript']);
const READ_EVIDENCE = { caption_body: ['caption'], image_text: ['original_image', 'image_text', 'page_screenshot'], video_fragment: ['video', 'clip'], original_subtitles: ['original_subtitles'], verified_transcript: ['transcript_candidate'] };
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
  } else {
    check(m.value === null, 'Rounded/unavailable metrics must have value:null');
    if (m.precision === 'rounded') check(nonempty(m.raw), 'Rounded metrics require a visible display');
  }
}
function url(s) { const u = new URL(s); check(['http:', 'https:'].includes(u.protocol) && !u.username && !u.password, 'Expected public HTTP(S) URL'); return s; }
function workUrl(work) {
  const u = new URL(url(work.url));
  const domain = work.platform === 'douyin' ? 'douyin.com' : 'xiaohongshu.com';
  const route = work.platform === 'douyin' ? /^\/(?:video|note)\/([a-zA-Z0-9_-]+)\/?$/ : /^\/(?:explore|discovery\/item)\/([a-zA-Z0-9_-]+)\/?$/;
  const nativeId = route.exec(u.pathname)?.[1];
  check(nativeId && [domain, `www.${domain}`].includes(u.hostname) && `${work.platform}:${nativeId}` === work.id, 'Work URL must match the declared platform and native ID; use a canonical work URL');
}
function profileId(platform, value) {
  // Query strings such as Xiaohongshu xsec_token vary between visits; the user ID identifies the profile.
  try {
    const u = new URL(value), domain = platform === 'douyin' ? 'douyin.com' : 'xiaohongshu.com';
    const route = platform === 'douyin' ? /^\/user\/([a-zA-Z0-9_-]+)\/?$/ : /^\/user\/profile\/([a-zA-Z0-9_-]+)\/?$/;
    const user = route.exec(u.pathname)?.[1];
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && [domain, `www.${domain}`].includes(u.hostname) && user ? `${platform}:${user}` : null;
  } catch { return null; }
}
function authorUrl(work) {
  if (work.authorUrl === undefined) return;
  url(work.authorUrl);
  check(profileId(work.platform, work.authorUrl), 'Author URL must identify a profile on the work platform');
}
function sourcePlatform(sourceUrl) {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  return ({ 'douyin.com': 'douyin', 'xiaohongshu.com': 'xiaohongshu', 'x.com': 'x', 'twitter.com': 'x' })[host];
}
function assetMatchesWork(a, work) {
  try { url(a.sourceUrl); } catch { return false; }
  if (!publicationAllowsAsset(a, work)) return false;
  if (EXTERNAL_ASSET_KINDS.has(a.kind)) return true;
  try { workUrl(work); workUrl({ ...work, url: a.sourceUrl }); return true; } catch {
    const profile = profileId(work.platform, work.authorUrl);
    return Boolean(profile && profileId(work.platform, a.sourceUrl) === profile && METRIC_ASSET_KINDS.has(a.kind) && a.metrics && Object.keys(a.metrics).length && Object.keys(a.metrics).every(k => k === 'followers'));
  }
}
function publicationAllowsAsset(a, work) {
  if (work.publishedAt == null) return true;
  try { workUrl({ ...work, url: a.sourceUrl }); } catch { return true; }
  try { return work.dateKind === 'published' && time(work.publishedAt) <= time(a.capturedAt); } catch { return false; }
}
function workBound(a, work) { try { workUrl({ ...work, url: a.sourceUrl }); return true; } catch { return false; } }
function mergeWork(previous, next) {
  // A confirmed publication date and the author profile persist unless a later capture explicitly revises them.
  if (!previous) return next;
  const merged = { ...next };
  if (merged.authorUrl === undefined && previous.authorUrl !== undefined) merged.authorUrl = previous.authorUrl;
  if (merged.publishedAt == null && previous.publishedAt != null) Object.assign(merged, { dateKind: previous.dateKind, dateLabel: previous.dateLabel, publishedAt: previous.publishedAt });
  return merged;
}
function knownWork(events, workId) { let work; for (const e of events) if (e.type === 'capture' && e.work.id === workId) work = mergeWork(work, e.work); return work; }
function supportsRead(kind, assets) {
  return assets.some(a => READ_EVIDENCE[kind]?.includes(a.kind) && (kind !== 'verified_transcript' || a.status === 'verified'));
}
function storagePath(file) {
  const key = assetKey(file.replaceAll('\\', '/'));
  check(key !== '.writer.lock' && key !== 'events' && !key.startsWith('events/'), `Ledger-internal path cannot be registered: ${file}`);
}
function storedFile(root, file, realRoot = fs.realpathSync(root)) {
  check(nonempty(file) && !path.isAbsolute(file) && !/^[A-Za-z]:|\\|\0/.test(file), 'Use a store-relative path with forward slashes');
  storagePath(file);
  const resolved = path.resolve(root, file), rel = path.relative(path.resolve(root), resolved);
  check(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), `Path escapes store: ${file}`);
  let realFile;
  try { realFile = fs.realpathSync(resolved); } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw new Error(`Missing/empty asset: ${file}`); throw error; }
  const realRel = path.relative(realRoot, realFile);
  check(realRel && realRel !== '..' && !realRel.startsWith(`..${path.sep}`) && !path.isAbsolute(realRel), `Symlink escapes store: ${file}`);
  storagePath(realRel);
  const stat = fs.statSync(realFile, { bigint: true });
  check(stat.isFile() && stat.size > 0n, `Missing/empty asset: ${file}`);
  return { realFile, stat };
}
function relativeFile(root, file) { return storedFile(root, file).realFile; }
function digest(root, file) { return crypto.createHash('sha256').update(fs.readFileSync(relativeFile(root, file))).digest('hex'); }
function identity(realFile, stat) { return stat.ino !== 0n ? `inode:${stat.dev}:${stat.ino}` : `path:${assetKey(realFile)}`; }
function physicalFileKey(file) { return identity(fs.realpathSync(file), fs.statSync(file, { bigint: true })); }
function fileKey(root, file, realRoot) { const { realFile, stat } = storedFile(root, file, realRoot); return identity(realFile, stat); }
function internalFileKeys(root) {
  const dir = eventDirectory(root), paths = files(root).map(n => path.join(dir, n)), lock = path.join(root, '.writer.lock');
  if (fs.existsSync(lock)) paths.push(lock);
  return new Set(paths.map(physicalFileKey));
}
function lazyInternals(root) { let keys; return () => keys ||= internalFileKeys(root); }
function registrationKey(root, file, internals = lazyInternals(root)) {
  const { realFile, stat } = storedFile(root, file), key = identity(realFile, stat);
  // Only a multiply-linked file can be a journal entry or the writer lock under another name;
  // other paths into events/ and the lock are rejected by name before this point.
  if (stat.nlink > 1n) check(!internals().has(key), `Ledger-internal file cannot be registered: ${file}`);
  return key;
}
function fileResolver(root) {
  const known = new Map();
  let realRoot;
  return file => {
    const key = assetKey(file);
    if (!known.has(key)) {
      // Registered paths need only their identity here: containment was checked at registration and
      // the integrity pass rechecks it. Missing unrelated history must not prevent recovery under new
      // paths; referenced files still pass strict path/hash checks before append.
      let found = `path:${key}`;
      try {
        const stat = fs.statSync(path.resolve(root, file), { bigint: true });
        found = stat.isFile() && stat.ino !== 0n ? `inode:${stat.dev}:${stat.ino}` : fileKey(root, file, realRoot ??= fs.realpathSync(root));
      } catch { /* Keep the path identity. */ }
      known.set(key, found);
    }
    return known.get(key);
  };
}
function config(input = {}) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid config');
  for (const k of Object.keys(input)) check(k in DEFAULTS, `Unknown config key: ${k}`);
  if (input.targets !== undefined) check(input.targets && typeof input.targets === 'object' && !Array.isArray(input.targets), 'Targets must be a non-array object');
  const c = { ...DEFAULTS, ...input, targets: { ...DEFAULTS.targets, ...input.targets } };
  check(Object.keys(c.targets).every(k => ['douyin', 'xiaohongshu'].includes(k)), 'Unknown target platform');
  for (const v of Object.values(c.targets)) check(Number.isSafeInteger(v) && v >= 0, 'Targets must be nonnegative integers');
  check(c.targets.douyin + c.targets.xiaohongshu > 0, 'Round needs a positive target');
  for (const [k, v] of Object.entries(c)) if (k !== 'targets') check(Number.isFinite(v) && v >= 0, `Invalid config value: ${k}`);
  for (const k of ['minNew', 'minRecommended', 'practicalSlots', 'lowFollowerCeiling', 'lowLikeCeiling', 'minNewLikes']) check(Number.isSafeInteger(c[k]), `${k} must be an integer`);
  check(c.minIntervalMinutes > 0 && c.shortWindowHours * 60 >= c.minIntervalMinutes && c.accelerationRatio > 1, 'Invalid growth windows');
  const total = c.targets.douyin + c.targets.xiaohongshu;
  check(c.minNew <= total && c.practicalSlots <= total && Object.values(c.targets).every(t => t === 0 || c.minRecommended <= t), 'minNew/practicalSlots cannot exceed the round target and minRecommended cannot exceed an active platform target');
  return c;
}
function eventDirectory(root) {
  const dir = path.resolve(root, 'events');
  try { fs.lstatSync(dir); } catch (error) { if (error.code === 'ENOENT') return dir; throw error; }
  const actual = fs.realpathSync(dir), relative = path.relative(fs.realpathSync(root), actual);
  check(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && fs.statSync(actual).isDirectory(), 'Events directory must remain beneath the selected store');
  return actual;
}
function files(root) {
  const dir = eventDirectory(root);
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^\d{8}-[a-zA-Z0-9_.-]+\.json$/.test(n)).sort() : [];
  for (const name of names) { const entry = fs.lstatSync(path.join(dir, name)); check(entry.isFile() && !entry.isSymbolicLink(), `Journal entries must be regular files: ${name}`); }
  return names;
}
function load(root) { const dir = eventDirectory(root); return files(root).map(n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))); }
function assetKey(file) {
  const normalized = path.posix.normalize(file);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function draftPaths(e) { return ['briefPath', 'scriptPath', 'evidencePath'].map(k => e[k]).filter(nonempty); }
function ledgerIndex(events, resolve) {
  // First registration per file identity, with the position of its event and the work metadata known then.
  const pos = new Map(), entries = new Map(), byWork = new Map(), generated = new Map(), works = new Map();
  events.forEach((e, i) => {
    pos.set(e, i);
    if (e.type === 'draft') for (const file of draftPaths(e)) { const key = resolve(file); if (!generated.has(key)) generated.set(key, i); }
    if (e.type !== 'capture') return;
    works.set(e.work.id, mergeWork(works.get(e.work.id), e.work));
    for (const asset of e.assets) {
      const key = resolve(asset.path);
      if (entries.has(key)) continue;
      const entry = { index: i, workId: e.work.id, work: works.get(e.work.id), roundId: e.roundId, asset, fromDraft: generated.has(key) };
      entries.set(key, entry);
      if (!byWork.has(e.work.id)) byWork.set(e.work.id, []);
      byWork.get(e.work.id).push(entry);
    }
  });
  return { first: events[0], pos, entries, byWork, generated };
}
function registeredAssets(events, resolve = assetKey) {
  // A resolver bound to a full ledger shares one index across every prefix of that ledger.
  const n = events.length;
  let index = null;
  if (resolve.ledger) {
    resolve.index ||= ledgerIndex(resolve.ledger, resolve);
    if (n === 0 || (resolve.index.first === events[0] && resolve.index.pos.get(events[n - 1]) === n - 1)) index = resolve.index;
  }
  index ||= ledgerIndex(events, resolve);
  const get = key => { const entry = index.entries.get(key); return entry && entry.index < n ? entry : undefined; };
  return { get, has: key => get(key) !== undefined, forWork: workId => (index.byWork.get(workId) || []).filter(entry => entry.index < n), generated: key => (index.generated.get(key) ?? Infinity) < n };
}
function assetsFor(events, workId, resolve = assetKey, roundId) {
  // A legacy cross-work registration must not transfer the first owner's evidence.
  return registeredAssets(events, resolve).forWork(workId).filter(a => !a.fromDraft && (roundId === undefined || a.roundId === roundId) && assetMatchesWork(a.asset, a.work)).map(a => a.asset);
}
function supersededObservations(events) {
  return new Set(events.filter(x => x.type === 'observation' && typeof x.correctsObservationId === 'string').map(x => x.correctsObservationId));
}
function observationEvidence(e, prior, root, resolve = assetKey) {
  check(prior.some(r => r.type === 'round_started' && r.roundId === e.roundId), 'Unknown observation round');
  const known = new Map();
  // The first registration owns the timestamp/metric readings for a path.
  for (const a of assetsFor(prior, e.workId, resolve, e.roundId)) if (!known.has(a.path)) known.set(a.path, a);
  check(Array.isArray(e.evidencePaths) && e.evidencePaths.length > 0, 'Fresh metric evidence required');
  const referenced = e.evidencePaths.map(p => known.get(p));
  for (const a of referenced) {
    check(a && METRIC_ASSET_KINDS.has(a.kind) && a.metrics && time(a.capturedAt) === time(e.sampledAt), 'Observation requires metric-bearing evidence captured at its sampling time and in its round');
  }
  for (const [k, m] of Object.entries(e.metrics)) {
    validateMetric(k, m);
    const sources = referenced.filter(a => Object.hasOwn(a.metrics, k));
    check(sources.length > 0 && sources.every(a => isDeepStrictEqual(a.metrics[k], m)), `Observation ${k} does not match its captured metric reading`);
  }
  if (root) for (const a of referenced) check(digest(root, a.path) === a.sha256, `Registered asset changed: ${a.path}`);
}
function eligible(e, registered, resolve = assetKey) {
  if (e.type !== 'capture') return false;
  const known = registered || registeredAssets([e], resolve);
  const assets = e.assets.filter(a => {
    const first = known.get(resolve(a.path));
    return first?.workId === e.work.id && !first.fromDraft && isDeepStrictEqual(first.asset, a) && assetMatchesWork(a, first.work) && assetMatchesWork(a, e.work);
  });
  // Author-profile follower samples are valid metrics but never show the work itself.
  const bound = assets.filter(a => workBound(a, e.work));
  return new Set(assets.map(a => resolve(a.path))).size === assets.length && e.readKinds.length > 0 && e.readKinds.every(k => READ_KINDS.has(k) && supportsRead(k, bound)) && bound.some(a => ['page_screenshot', 'video', 'clip'].includes(a.kind)) && bound.some(a => a.kind === 'caption');
}
function validate(root, e, prior, resolve = fileResolver(root), internals = lazyInternals(root)) {
  check(e && typeof e === 'object' && !Array.isArray(e), 'Event object required');
  id(e.id); const recorded = time(e.recordedAt);
  if (prior.length) check(recorded >= time(prior.at(-1).recordedAt), 'Save time cannot precede the preceding committed event');
  const round = prior.find(x => x.type === 'round_started' && x.roundId === e.roundId);
  const work = prior.find(x => x.type === 'capture' && x.work.id === e.workId);
  const requireWork = () => check(work, `Unknown work: ${e.workId}`);
  const registerFile = file => registrationKey(root, file, internals);
  const knownPaths = () => new Set(assetsFor(prior, e.workId, resolve).map(a => a.path));
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
    if (e.status === 'completed') check(roundStats(prior, round, resolve).coverageComplete, 'Round count/coverage targets not met; save partial');
  } else if (e.type === 'capture') {
    check(round, 'Unknown round');
    check(e.work && ['douyin', 'xiaohongshu'].includes(e.work.platform), 'Invalid work platform');
    check(typeof e.work.id === 'string' && new RegExp(`^${e.work.platform}:[a-zA-Z0-9_-]+$`).test(e.work.id), 'Use platform:native-id');
    workUrl(e.work); authorUrl(e.work); check(nonempty(e.work.title) && nonempty(e.work.author), 'Work title and author required');
    const earlierCaptures = prior.filter(x => x.type === 'capture' && x.work.id === e.work.id);
    const known = knownWork(earlierCaptures, e.work.id), effective = mergeWork(known, e.work);
    // The profile identifies whose follower samples belong to this work; display names may be corrected.
    if (known?.authorUrl !== undefined && e.work.authorUrl !== undefined) check(profileId(e.work.platform, known.authorUrl) === profileId(e.work.platform, e.work.authorUrl), 'Author profile conflicts with the profile already registered for this work');
    check(['published', 'edited', 'unknown'].includes(e.work.dateKind) && typeof e.work.dateLabel === 'string', 'Date kind/label required');
    if (e.work.publishedAt != null) {
      check(e.work.dateKind === 'published', 'Edited/unknown dates cannot become publication dates'); check(time(e.work.publishedAt) <= recorded, 'Publication timestamp cannot follow its capture event');
      for (const c of earlierCaptures) for (const a of c.assets) check(publicationAllowsAsset(a, e.work), `Publication timestamp cannot follow earlier work capture evidence: ${a.path}`);
    }
    check(['recommendation', 'related', 'search', 'direct'].includes(e.route), 'Invalid discovery route');
    check(Array.isArray(e.readKinds) && e.readKinds.every(k => READ_KINDS.has(k)), 'Invalid substantive read kind (summaries/title cards do not count)');
    check(typeof e.coverage === 'string' && Array.isArray(e.gaps), 'Coverage and gaps required');
    check(Array.isArray(e.assets) && e.assets.length > 0, 'Assets required');
    check(new Set(e.assets.map(a => registerFile(a.path))).size === e.assets.length, 'Duplicate asset path');
    const registered = registeredAssets(prior, resolve);
    for (const a of e.assets) {
      check(!registered.generated(resolve(a.path)), 'Captured sources cannot reuse registered draft files');
      check(ASSET_KINDS.has(a.kind), `Invalid asset kind: ${a.kind}`); url(a.sourceUrl);
      // A publication date confirmed by an earlier capture still applies when this capture omits it.
      check(publicationAllowsAsset(a, effective), 'Publication timestamp cannot follow work capture evidence');
      check(assetMatchesWork(a, effective), 'Asset source must identify the declared work (or its saved follower profile)');
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
      const old = registered.get(resolve(a.path));
      if (old) {
        check(old.workId === e.work.id, 'Asset path already registered for another work; use a new path');
        check(isDeepStrictEqual(old.asset, a), 'Registered asset and its metadata are immutable; use a new path');
      }
    }
    if (e.readKinds.includes('verified_transcript')) check(e.assets.some(a => a.kind === 'transcript_candidate' && a.status === 'verified'), 'Verified transcript evidence required');
    const bound = e.assets.filter(a => workBound(a, e.work));
    for (const kind of e.readKinds) check(supportsRead(kind, bound), `Read kind ${kind} requires compatible saved evidence from the work itself`);
  } else if (e.type === 'observation') {
    requireWork(); check(round, 'Unknown round'); check(time(e.sampledAt) <= recorded, 'Sample time is after event time');
    check(e.metrics && typeof e.metrics === 'object' && !Array.isArray(e.metrics) && Object.keys(e.metrics).length > 0, 'Metrics required');
    const superseded = supersededObservations(prior);
    if (e.correctsObservationId !== undefined) {
      const target = prior.find(x => x.type === 'observation' && x.id === e.correctsObservationId);
      check(target && target.workId === e.workId && target.roundId === e.roundId && time(target.sampledAt) === time(e.sampledAt), 'A correction must name an earlier observation of the same work, round and sampling time');
      check(!superseded.has(target.id), 'Observation already corrected; correct its latest correction instead');
      check(Object.keys(target.metrics).every(k => Object.hasOwn(e.metrics, k)), 'A correction must restate every metric of the corrected observation');
      superseded.add(target.id);
    }
    for (const [k, m] of Object.entries(e.metrics)) {
      validateMetric(k, m);
      check(!prior.some(x => x.type === 'observation' && x.workId === e.workId && !superseded.has(x.id) && time(x.sampledAt) === time(e.sampledAt) && k in x.metrics), `Duplicate ${k} at sample time; use correctsObservationId to correct a saved reading`);
    }
    observationEvidence(e, prior, undefined, resolve);
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
    const registered = registeredAssets(prior, resolve);
    check(readCaptures.some(c => eligible(c, registered, resolve)), 'Review requires a substantive eligible capture');
    check(Array.isArray(e.gaps) && Array.isArray(e.sourceRefs) && Array.isArray(e.claims), 'Review gaps, claims and sourceRefs arrays required');
    const sourceAssets = assetsFor(prior, e.workId, resolve).filter(a => ['source_page', 'source_image', 'research_note'].includes(a.kind) && e.evidencePaths.includes(a.path));
    for (const s of e.sourceRefs) {
      url(s.url); check(['exact', 'account_clue', 'unverified'].includes(s.status) && nonempty(s.note), 'Source status/note required');
      if (s.status === 'exact') check(sourceAssets.some(a => a.sourceUrl === s.url), 'Exact source reference requires cited captured source evidence with a matching URL');
    }
    for (const c of e.claims) { check(nonempty(c.text) && ['verified', 'author_report', 'inference', 'unresolved'].includes(c.status), 'Invalid claim'); evidence(c.evidencePaths); }
    check(Array.isArray(e.comments), 'Comments array required (empty means no verified discussion)');
    const commentAssets = assetsFor(prior, e.workId, resolve).filter(a => ['comments', 'source_comments'].includes(a.kind));
    for (const c of e.comments) {
      check(['douyin', 'xiaohongshu', 'x'].includes(c.platform) && ['disagreement', 'request', 'meme', 'support', 'ai', 'other'].includes(c.kind), 'Comment platform/kind required');
      check(Number.isSafeInteger(c.sampledCount) && c.sampledCount > 0 && nonempty(c.summary), 'Comment count/summary required'); evidence(c.evidencePaths);
      check(commentAssets.some(a => c.evidencePaths.includes(a.path) && sourcePlatform(a.sourceUrl) === c.platform), 'Comment summary requires captured comments evidence on its stated platform');
    }
  } else if (e.type === 'task') {
    requireWork(); check(round, 'Unknown round'); id(e.taskId);
    check(['revisit', 'backfill'].includes(e.kind) && ['pending', 'done', 'cancelled'].includes(e.status) && nonempty(e.reason), 'Invalid task');
    if (e.dueAt != null) time(e.dueAt);
    const previous = prior.findLast(x => x.type === 'task' && x.taskId === e.taskId);
    if (previous) check(previous.workId === e.workId && previous.roundId === e.roundId && previous.kind === e.kind, 'Task identity is immutable');
    if (e.kind === 'revisit') {
      if (previous) check(previous.baselineObservationId === e.baselineObservationId && time(previous.dueAt) === time(e.dueAt), 'Revisit baseline and deadline are immutable; use a new task to reschedule');
      const baseline = prior.find(x => x.id === e.baselineObservationId && x.type === 'observation' && x.workId === e.workId && x.metrics.likes && x.metrics.likes.precision !== 'unavailable');
      check(baseline, 'Revisit needs a saved like observation');
      observationEvidence(baseline, prior.slice(0, prior.indexOf(baseline)), undefined, resolve);
      check(time(e.dueAt) >= time(baseline.sampledAt) + round.config.minIntervalMinutes * 60000, 'Revisit is earlier than the minimum interval');
      const superseded = supersededObservations(prior);
      if (e.status === 'done') check(prior.some((x, i) => {
        if (x.type !== 'observation' || superseded.has(x.id) || x.workId !== e.workId || !x.metrics.likes || x.metrics.likes.precision === 'unavailable' || time(x.sampledAt) < time(e.dueAt)) return false;
        try { observationEvidence(x, prior.slice(0, i), root, resolve); return true; } catch { return false; }
      }), 'No due-time revisit observation saved');
    }
  } else if (e.type === 'decision') {
    requireWork(); check(['selected', 'watch', 'rejected'].includes(e.decision), 'Invalid decision');
    check(nonempty(e.userRequest) && nonempty(e.reason), 'Preserve actual user selection/feedback');
  } else if (e.type === 'draft') {
    requireWork(); const selection = prior.findLast(x => x.type === 'decision' && x.workId === e.workId);
    check(selection && selection.decision === 'selected' && selection.id === e.selectionEventId, 'Draft requires the current explicit user selection');
    const currentReview = prior.findLast((x, i) => x.type === 'review' && x.workId === e.workId && !eventIssue(root, x, prior.slice(0, i), resolve, internals));
    check(currentReview && currentReview.id === e.reviewId, 'Draft must reference the current review revision');
    check(e.status === 'draft', 'Generated script remains draft');
    if (e.hashes === undefined) e.hashes = {};
    check(e.hashes && typeof e.hashes === 'object' && !Array.isArray(e.hashes), 'Draft hashes must be a plain object');
    const draftKeys = ['briefPath', 'scriptPath', 'evidencePath'];
    const resolved = Object.fromEntries(draftKeys.map(k => [k, registerFile(e[k])]));
    check(new Set(Object.values(resolved)).size === 3, 'Brief, script and evidence must be separate files');
    const sources = registeredAssets(prior, resolve);
    for (const key of Object.values(resolved)) check(!sources.has(key), 'Draft files must be separate from captured source files');
    for (const k of ['briefPath', 'scriptPath', 'evidencePath']) {
      const hash = digest(root, e[k]); if (e.hashes[k]) check(e.hashes[k] === hash, `Draft file changed: ${e[k]}`);
      for (const old of prior.filter(x => x.type === 'draft')) for (const oldKey of ['briefPath', 'scriptPath', 'evidencePath']) {
        if (resolve(old[oldKey]) === resolved[k]) check(old.hashes[oldKey] === hash, `Registered draft cannot be overwritten: ${e[k]}`);
      }
      e.hashes[k] = hash;
    }
  } else throw new Error(`Unknown event type: ${e.type}`);
  return e;
}
function eventIssue(root, e, prior, resolve, internals) {
  if (e.type === 'draft' && !root) return 'Store path required to validate a historical draft';
  try { validate(root, JSON.parse(JSON.stringify(e)), prior, resolve, internals); return null; } catch (error) { return error.message; }
}
function integrityIssues(root, events, { hashes = true } = {}) {
  // Without hashes only presence is checked: a quick resume view, not proof that bytes are unchanged.
  const internals = lazyInternals(root), issues = [], seen = new Set();
  const probe = (e, kind, file, expected) => {
    const key = `${kind}:${typeof file === 'string' ? assetKey(file) : String(file)}`;
    if (seen.has(key)) return; seen.add(key);
    let reason = null;
    try {
      if (!hashes) { const stat = fs.statSync(path.resolve(root, file)); check(stat.isFile() && stat.size > 0, `Missing/empty ${kind}: ${file}`); }
      else { registrationKey(root, file, internals); if (digest(root, file) !== expected) reason = `Registered ${kind} changed: ${file}`; }
    } catch (error) { reason = error.code === 'ENOENT' ? `Missing/empty ${kind}: ${file}` : error.message; }
    if (reason) issues.push({ eventId: e.id, workId: e.type === 'capture' ? e.work.id : e.workId, kind, path: file, reason });
  };
  for (const e of events) {
    if (e.type === 'capture') for (const a of e.assets) probe(e, 'asset', a.path, a.sha256);
    if (e.type === 'draft') for (const k of ['briefPath', 'scriptPath', 'evidencePath']) probe(e, 'draft', e[k], e.hashes?.[k]);
  }
  return issues;
}
function verifyFiles(root, events) { const [issue] = integrityIssues(root, events); check(!issue, issue?.reason); }
function referencedPaths(input, events, resolve = assetKey) {
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
      const registered = registeredAssets(events, resolve);
      pending.push(...events.filter(c => c.type === 'capture' && c.roundId === e.roundId && eligible(c, registered, resolve)));
    }
  }
  return refs;
}
function append(root, input) {
  root = path.resolve(root); fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(eventDirectory(root), { recursive: true }); const dir = eventDirectory(root);
  const lock = path.join(root, '.writer.lock');
  let fd; try { fd = fs.openSync(lock, 'wx'); } catch (error) { if (error.code === 'EEXIST') throw new Error('Writer locked; inspect the active writer before retrying'); throw error; }
  try {
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); fs.fsyncSync(fd);
    const events = load(root);
    const e = JSON.parse(JSON.stringify(input)), existing = events.find(x => x.id === e.id);
    // Hash only reused/referenced files on append; do not reread every historical
    // video for each metric sample. status/render perform the full integrity pass.
    if (typeof e.recordedAt === 'string' && Number.isFinite(Date.parse(e.recordedAt))) check(Date.parse(e.recordedAt) <= Date.now() + 5 * 60000, 'recordedAt is later than this machine clock; record the actual save time');
    const resolve = fileResolver(root); resolve.ledger = events;
    const refs = referencedPaths(e, events, resolve);
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
    const normalized = validate(root, e, existing ? events.slice(0, events.indexOf(existing)) : events, resolve);
    if (existing) { check(isDeepStrictEqual(existing, normalized), `Conflicting replay: ${e.id}`); return { appended: false, id: e.id }; }
    const n = files(root).length + 1; check(n <= 99999999, 'Ledger sequence exhausted');
    const target = path.join(dir, `${String(n).padStart(8, '0')}-${e.id}.json`);
    const tmp = `${target}.${crypto.randomUUID()}.tmp`;
    const out = fs.openSync(tmp, 'wx');
    try { fs.writeFileSync(out, `${JSON.stringify(normalized, null, 2)}\n`); fs.fsyncSync(out); } finally { fs.closeSync(out); }
    check(!fs.existsSync(target), 'Sequence conflict'); fs.renameSync(tmp, target);
    return { appended: true, id: e.id };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function roundStats(events, round, resolve = assetKey) {
  const registered = registeredAssets(events, resolve), isEligible = e => eligible(e, registered, resolve);
  const captures = events.filter(e => e.type === 'capture' && e.roundId === round.roundId && isEligible(e));
  const distinct = new Map(); for (const e of captures) if (!distinct.has(e.work.id)) distinct.set(e.work.id, e);
  const platformCounts = { douyin: 0, xiaohongshu: 0 }, recommended = { douyin: 0, xiaohongshu: 0 };
  let newWorks = 0, practical = 0;
  // Newness follows round order, not save order: a backfill into an earlier round is a previous read.
  const roundIndex = events.indexOf(round), earlierRounds = new Set(events.filter((e, i) => e.type === 'round_started' && i < roundIndex).map(e => e.roundId));
  for (const [wid, first] of distinct) {
    platformCounts[first.work.platform]++;
    // Route coverage reflects how the work was first found in this round, even when that was a lead read later.
    const discovery = events.find(e => e.type === 'capture' && e.roundId === round.roundId && e.work.id === wid);
    if (['recommendation', 'related'].includes(discovery.route)) recommended[first.work.platform]++;
    if (!events.some(e => e.type === 'capture' && earlierRounds.has(e.roundId) && e.work.id === wid && isEligible(e))) newWorks++;
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
function snapshot(events, now = new Date().toISOString(), root, integrity = []) {
  time(now); const source = events;
  // Changed or missing registered files stay in the ledger history but no longer support derived results.
  const broken = new Set(integrity.filter(x => x.kind === 'asset' && typeof x.path === 'string').map(x => assetKey(x.path)));
  if (broken.size) events = events.map(e => e.type === 'capture' && e.assets.some(a => broken.has(assetKey(a.path))) ? { ...e, assets: e.assets.filter(a => !broken.has(assetKey(a.path))) } : e);
  const works = new Map(), rounds = events.filter(e => e.type === 'round_started');
  const resolve = root ? fileResolver(root) : file => assetKey(file);
  resolve.ledger = events;
  const observationChecks = new Map(), reviewChecks = new Map(), draftChecks = new Map();
  const internals = root ? lazyInternals(root) : undefined;
  for (let i = 0; i < events.length; i++) if (events[i].type === 'observation') {
    try { observationEvidence(events[i], events.slice(0, i), undefined, resolve); observationChecks.set(events[i].id, null); }
    catch (error) { observationChecks.set(events[i].id, error.message); }
  }
  for (let i = 0; i < events.length; i++) if (['review', 'draft'].includes(events[i].type)) {
    const checks = events[i].type === 'review' ? reviewChecks : draftChecks;
    checks.set(events[i].id, eventIssue(root, events[i], events.slice(0, i), resolve, internals));
  }
  const superseded = new Set(events.filter(e => e.type === 'observation' && typeof e.correctsObservationId === 'string' && !observationChecks.get(e.id)).map(e => e.correctsObservationId));
  const taskMap = new Map(); for (const e of events) if (e.type === 'task') taskMap.set(e.taskId, e);
  const groups = new Map(), group = workId => { if (!groups.has(workId)) groups.set(workId, { captures: [], observations: [], reviews: [], drafts: [], decision: null }); return groups.get(workId); };
  for (const e of source) if (e.type === 'capture') group(e.work.id).captures.push(e);
  for (const e of events) {
    if (e.type === 'capture') works.set(e.work.id, mergeWork(works.get(e.work.id), e.work));
    else if (groups.has(e.workId)) {
      const g = groups.get(e.workId);
      if (e.type === 'observation') g.observations.push(e); else if (e.type === 'review') g.reviews.push(e); else if (e.type === 'draft') g.drafts.push(e); else if (e.type === 'decision') g.decision = e;
    }
  }
  const items = [...works].map(([workId, work]) => {
    const { captures, observations: allObservations, reviews, drafts: draftHistory, decision } = groups.get(workId);
    const evidenceGaps = allObservations.filter(e => observationChecks.get(e.id)).map(e => ({ observationId: e.id, sampledAt: e.sampledAt, reason: observationChecks.get(e.id) }));
    const correctedObservations = allObservations.filter(e => superseded.has(e.id)).map(e => e.id);
    const observations = allObservations.filter(e => !observationChecks.get(e.id) && !superseded.has(e.id)).sort((a, b) => time(a.sampledAt) - time(b.sampledAt));
    const latest = {}; for (const o of observations) for (const [k, v] of Object.entries(o.metrics)) if (v.precision !== 'unavailable') latest[k] = { ...v, sampledAt: o.sampledAt, observationId: o.id };
    const metricConfig = metric => {
      const sample = observations.find(o => o.id === latest[metric]?.observationId);
      return rounds.find(r => r.roundId === sample?.roundId)?.config || DEFAULTS;
    };
    const reviewGaps = reviews.filter(e => reviewChecks.get(e.id)).map(e => ({ reviewId: e.id, recordedAt: e.recordedAt, reason: reviewChecks.get(e.id) }));
    const review = reviews.findLast(e => !reviewChecks.get(e.id)) || null;
    const draftGaps = draftHistory.filter(e => draftChecks.get(e.id)).map(e => ({ draftId: e.id, recordedAt: e.recordedAt, reason: draftChecks.get(e.id) }));
    return { work, captures, assets: assetsFor(events, workId, resolve), latest, evidenceGaps, correctedObservations, growth: growth(observations, metricConfig('likes')),
      lowFollower: latest.followers?.precision === 'exact' ? latest.followers.value <= metricConfig('followers').lowFollowerCeiling : null,
      review, reviews, reviewGaps, decision,
      drafts: draftHistory.filter(e => !draftChecks.get(e.id)), draftHistory, draftGaps, integrityIssues: integrity.filter(x => x.workId === workId) };
  });
  // Pending work on a rejected topic stays in history but is no longer due.
  const rejected = new Set(items.filter(i => i.decision?.decision === 'rejected').map(i => i.work.id));
  return { generatedAt: now, eventCount: source.length, integrityIssues: integrity, items,
    rounds: rounds.map(r => ({ ...r, ...roundStats(events, r, resolve), attempts: events.filter(e => e.type === 'attempt' && e.roundId === r.roundId) })),
    tasks: [...taskMap.values()].map(t => { const suppressed = t.status === 'pending' && rejected.has(t.workId); return { ...t, suppressed, due: t.status === 'pending' && !suppressed && (t.dueAt == null || time(t.dueAt) <= time(now)) }; }) };
}
function summary(state) {
  // Compact view for an agent resuming work; status and snapshot.json keep the full history.
  const priority = state.items.filter(i => i.review?.recommendation === 'shortlist' && !['watch', 'rejected'].includes(i.decision?.decision));
  return { generatedAt: state.generatedAt, eventCount: state.eventCount, works: state.items.length, integrityChecked: 'presence', integrityIssues: state.integrityIssues,
    rounds: state.rounds.map(r => ({ roundId: r.roundId, timezone: r.timezone, targets: r.config.targets, unique: r.unique, platformCounts: r.platformCounts, newWorks: r.newWorks, recommended: r.recommended, practical: r.practical, repeatReads: r.repeatReads, countComplete: r.countComplete, coverageComplete: r.coverageComplete, lastAttempt: r.attempts.length ? (({ attemptId, status, platform, reason, recordedAt }) => ({ attemptId, status, platform, reason, recordedAt }))(r.attempts.at(-1)) : null })),
    pendingTasks: state.tasks.filter(t => t.status === 'pending').map(({ taskId, workId, kind, reason, dueAt, due, suppressed }) => ({ taskId, workId, kind, reason, dueAt, due, suppressed })),
    shortlist: priority.map(i => ({ workId: i.work.id, title: i.work.title, angle: i.review.angle, reviewId: i.review.id })),
    decisions: state.items.filter(i => i.decision).map(i => ({ workId: i.work.id, decision: i.decision.decision, recordedAt: i.decision.recordedAt })),
    gaps: state.items.filter(i => i.evidenceGaps.length || i.reviewGaps.length || i.draftGaps.length || i.integrityIssues.length).map(i => ({ workId: i.work.id, evidenceGaps: i.evidenceGaps.length, reviewGaps: i.reviewGaps.length, draftGaps: i.draftGaps.length, integrityIssues: i.integrityIssues.length })) };
}
function main(argv) {
  const command = argv[0], opts = {};
  for (let i = 1; i < argv.length; i += 2) { check(argv[i].startsWith('--') && argv[i + 1], 'Use --name value options'); check(['--store', '--input', '--out', '--now'].includes(argv[i]), `Unknown option: ${argv[i]}`); opts[argv[i].slice(2)] = argv[i + 1]; }
  check(opts.store, 'Usage: radar.cjs append|summary|status|render --store <directory> [--input event.json] [--out report-directory] [--now ISO-time]');
  check(['append', 'summary', 'status', 'render'].includes(command), 'Unknown command');
  if (command === 'append') { check(opts.input, '--input required'); return append(opts.store, JSON.parse(fs.readFileSync(opts.input, 'utf8').replace(/^\uFEFF/, ''))); }
  const events = load(opts.store), issues = integrityIssues(opts.store, events, { hashes: command !== 'summary' }), state = snapshot(events, opts.now, opts.store, issues);
  if (issues.length) process.stderr.write(`Warning: ${issues.length} registered file(s) are missing or changed and are excluded from derived results; see integrityIssues.\n`);
  if (command === 'render') { check(opts.out, '--out required'); return require('./render-radar.cjs').writeReport(state, opts.store, opts.out); }
  return command === 'summary' ? summary(state) : state;
}
if (require.main === module) { try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { DEFAULTS, append, load, snapshot, summary, growth, roundStats, eligible, verifyFiles, integrityIssues, relativeFile, main };
