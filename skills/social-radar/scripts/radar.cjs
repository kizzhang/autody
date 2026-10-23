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
// Identical media or metric bytes belong to one work; text such as captions, OCR, subtitles, comments and
// external sources may legitimately repeat across a propagation cluster.
// Screenshots and metric snapshots are unique to a capture, so another work cannot register a copy. Reposted
// originals (images, videos, clips, frames) may be saved for another work but never count as its evidence.
const CONTENT_OWNED_KINDS = new Set(['page_screenshot', 'metric_snapshot']);
const CONTENT_IDENTITY_KINDS = new Set([...CONTENT_OWNED_KINDS, 'original_image', 'video', 'clip', 'frame']);
const contentOwned = kind => CONTENT_OWNED_KINDS.has(kind);
const INDEPENDENT_SOURCE_KINDS = new Set(['research_note', 'source_page', 'source_image']);
const READ_KINDS = new Set(['caption_body', 'image_text', 'video_fragment', 'original_subtitles', 'verified_transcript']);
const READ_EVIDENCE = { caption_body: ['caption'], image_text: ['original_image', 'image_text', 'page_screenshot'], video_fragment: ['video', 'clip'], original_subtitles: ['original_subtitles'], verified_transcript: ['transcript_candidate'] };
const METRICS = new Set(['likes', 'favorites', 'comments', 'shares', 'followers']);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/;
function check(ok, message) { if (!ok) throw new Error(message); }
function nonempty(s) { return typeof s === 'string' && s.trim().length > 0; }
function id(s) { check(typeof s === 'string' && SAFE_ID.test(s), `Invalid ID: ${s}`); }
function real(file) {
  // One native call instead of an lstat per path component; fall back where the native call is unsupported.
  try { return fs.realpathSync.native(file); } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; return fs.realpathSync(file); }
}
function time(s) {
  const parts = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(s);
  check(parts, `Timezone-qualified timestamp required (YYYY-MM-DDTHH:MM:SS[.fraction] with Z or ±HH:MM): ${s}`);
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
  // Subdomains such as mobile.x.com belong to the same platform.
  const host = new URL(sourceUrl).hostname, platforms = { 'douyin.com': 'douyin', 'xiaohongshu.com': 'xiaohongshu', 'x.com': 'x', 'twitter.com': 'x' };
  const domain = Object.keys(platforms).find(d => host === d || host.endsWith(`.${d}`));
  return domain && platforms[domain];
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
  // A conflicting profile (rejected at append, possible only in hand-written history) never replaces the creator.
  else if (previous.authorUrl !== undefined && profileId(merged.platform, merged.authorUrl) !== profileId(previous.platform, previous.authorUrl)) Object.assign(merged, { authorUrl: previous.authorUrl, author: previous.author });
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
function storedFile(root, file, realRoot = real(root)) {
  check(nonempty(file) && !path.isAbsolute(file) && !/^[A-Za-z]:|\\|\0/.test(file), 'Use a store-relative path with forward slashes');
  storagePath(file);
  const resolved = path.resolve(root, file), rel = path.relative(path.resolve(root), resolved);
  check(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), `Path escapes store: ${file}`);
  let realFile;
  try { realFile = real(resolved); } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw new Error(`Missing/empty asset: ${file}`); throw error; }
  const realRel = path.relative(realRoot, realFile);
  check(realRel && realRel !== '..' && !realRel.startsWith(`..${path.sep}`) && !path.isAbsolute(realRel), `Symlink escapes store: ${file}`);
  storagePath(realRel);
  const stat = fs.statSync(realFile, { bigint: true });
  check(stat.isFile() && stat.size > 0n, `Missing/empty asset: ${file}`);
  return { realFile, stat };
}
function relativeFile(root, file) { return storedFile(root, file).realFile; }
function hashFile(file) {
  const hash = crypto.createHash('sha256'), fd = fs.openSync(file, 'r'), buffer = Buffer.allocUnsafe(1 << 20);
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, n)); } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function digest(root, file) { return hashFile(relativeFile(root, file)); }
function identity(realFile, stat) { return stat.ino !== 0n ? `inode:${stat.dev}:${stat.ino}` : `path:${assetKey(realFile)}`; }
function physicalFileKey(file) { return identity(real(file), fs.statSync(file, { bigint: true })); }
function fileKey(root, file, realRoot) { const { realFile, stat } = storedFile(root, file, realRoot); return identity(realFile, stat); }
function internalFileKeys(root) {
  const dir = eventDirectory(root), paths = files(root).map(n => path.join(dir, n)), lock = path.join(root, '.writer.lock');
  if (fs.existsSync(lock)) paths.push(lock);
  return new Set(paths.map(physicalFileKey));
}
function lazyInternals(root) {
  let keys, dir;
  const get = () => keys ||= internalFileKeys(root);
  get.eventsDir = () => dir ??= eventDirectory(root);
  return get;
}
function registeredFile(root, file, internals = lazyInternals(root), realRoot = undefined) {
  const { realFile, stat } = storedFile(root, file, realRoot), key = identity(realFile, stat);
  // The resolved journal directory may be reached through another name when events/ is a contained alias.
  const inJournal = path.relative(internals.eventsDir(), realFile);
  check(!inJournal || inJournal === '..' || inJournal.startsWith(`..${path.sep}`) || path.isAbsolute(inJournal), `Ledger-internal file cannot be registered: ${file}`);
  // A hard link is the only remaining way to reach a journal entry or the writer lock.
  if (stat.nlink > 1n) check(!internals().has(key), `Ledger-internal file cannot be registered: ${file}`);
  return { realFile, key };
}
function registrationKey(root, file, internals) { return registeredFile(root, file, internals).key; }
function brokenAssets(root, events, selected) {
  // Mirror status/render: a missing or changed file of the selected captures stops supporting records.
  const broken = new Set(), checked = new Set();
  for (const e of events) if (e.type === 'capture' && selected(e)) for (const a of e.assets) {
    // A file re-listed by several captures is hashed once.
    if (checked.has(assetKey(a.path))) continue; checked.add(assetKey(a.path));
    let intact = false;
    try { intact = digest(root, a.path) === a.sha256; } catch { /* Missing or unreadable. */ }
    if (!intact) broken.add(assetKey(a.path));
  }
  return broken;
}
function withBroken(resolve, broken) {
  // Same ledger and ownership history; the listed files no longer count as evidence.
  return Object.assign(file => resolve(file), { ledger: resolve.ledger, index: resolve.index, split: resolve.split, broken: new Set([...(resolve.broken || []), ...broken]), filtered: true });
}
function unusable(resolve, asset) { return Boolean(resolve.broken?.has(assetKey(asset.path))); }
function fileResolver(root) {
  const known = new Map();
  let realRoot;
  const resolve = file => {
    const key = assetKey(file);
    if (!known.has(key)) {
      // Registered paths need only their identity here: containment was checked at registration and
      // the integrity pass rechecks it. Missing unrelated history must not prevent recovery under new
      // paths; referenced files still pass strict path/hash checks before append.
      let found = `path:${key}`;
      try {
        const stat = fs.statSync(path.resolve(root, file), { bigint: true });
        found = stat.isFile() && stat.ino !== 0n ? `inode:${stat.dev}:${stat.ino}` : fileKey(root, file, realRoot ??= real(root));
      } catch { /* Keep the path identity. */ }
      known.set(key, found);
    }
    return known.get(key);
  };
  // A registered path that now shares another registration's file identity, though both were saved with
  // different bytes, was replaced after registration. It keeps an identity of its own, so neither path takes
  // over the other's ownership history; the integrity check reports whichever file changed.
  resolve.split = file => { const key = assetKey(file), own = `path:${key}`; known.set(key, own); return own; };
  return resolve;
}
function config(input = {}) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid config');
  for (const k of Object.keys(input)) check(Object.hasOwn(DEFAULTS, k), `Unknown config key: ${k}`);
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
  const actual = real(dir), relative = path.relative(real(root), actual);
  check(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && fs.statSync(actual).isDirectory(), 'Events directory must remain beneath the selected store');
  return actual;
}
function files(root) {
  const dir = eventDirectory(root);
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^\d{8}-[a-zA-Z0-9_.-]+\.json$/.test(n)).sort() : [];
  for (const name of names) { const entry = fs.lstatSync(path.join(dir, name)); check(entry.isFile() && !entry.isSymbolicLink(), `Journal entries must be regular files: ${name}`); }
  return names;
}
function load(root) {
  const dir = eventDirectory(root);
  return files(root).map(n => { try { return JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); } catch (error) { throw new Error(`Journal entry ${n} is not valid JSON: ${error.message}`); } });
}
function assetKey(file) {
  const normalized = path.posix.normalize(file);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
function draftPaths(e) { return ['briefPath', 'scriptPath', 'evidencePath'].map(k => e[k]).filter(nonempty); }
function ledgerIndex(events, resolve) {
  // First registration per file identity, with the position of its event and the work metadata known then.
  const pos = new Map(), entries = new Map(), byWork = new Map(), generated = new Map(), works = new Map(), byHash = new Map(), draftHashes = new Map();
  events.forEach((e, i) => {
    pos.set(e, i);
    if (e.type === 'draft') {
      for (const file of draftPaths(e)) { const key = resolve(file); if (!generated.has(key)) generated.set(key, i); }
      for (const hash of Object.values(e.hashes && typeof e.hashes === 'object' ? e.hashes : {})) if (typeof hash === 'string' && !draftHashes.has(hash)) draftHashes.set(hash, i);
    }
    if (e.type !== 'capture') return;
    works.set(e.work.id, mergeWork(works.get(e.work.id), e.work));
    for (const asset of e.assets) {
      let key = resolve(asset.path);
      const prior = entries.get(key);
      if (prior && resolve.split && assetKey(prior.asset.path) !== assetKey(asset.path) && prior.asset.sha256 !== asset.sha256) key = resolve.split(asset.path);
      if (entries.has(key)) continue;
      const entry = { index: i, workId: e.work.id, work: works.get(e.work.id), roundId: e.roundId, asset, fromDraft: generated.has(key) || draftHashes.has(asset.sha256) };
      entries.set(key, entry);
      if (typeof asset.sha256 === 'string' && !byHash.has(asset.sha256)) byHash.set(asset.sha256, entry);
      if (!byWork.has(e.work.id)) byWork.set(e.work.id, []);
      byWork.get(e.work.id).push(entry);
    }
  });
  return { first: events[0], pos, entries, byWork, generated, byHash, draftHashes };
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
  const firstByHash = hash => { const entry = index.byHash.get(hash); return entry && entry.index < n ? entry : undefined; };
  return { get, has: key => get(key) !== undefined, forWork: workId => (index.byWork.get(workId) || []).filter(entry => entry.index < n), generated: key => (index.generated.get(key) ?? Infinity) < n,
    firstByHash, draftContent: hash => (index.draftHashes.get(hash) ?? Infinity) < n };
}
function copiedContent(entry, registry) {
  // The first registration of identical bytes owns them: a copy cannot move media to another work or turn
  // old metric evidence into a new time and reading. A correction keeps the original capture time.
  const first = typeof entry.asset.sha256 === 'string' ? registry.firstByHash(entry.asset.sha256) : undefined;
  if (!first || first === entry || first.asset === entry.asset) return null;
  if (CONTENT_IDENTITY_KINDS.has(entry.asset.kind) && first.workId !== entry.workId) return `Asset content of ${entry.asset.path} is already registered for another work (${first.workId}: ${first.asset.path}); save this work's own file`;
  if (METRIC_ASSET_KINDS.has(entry.asset.kind) && entry.asset.metrics !== undefined && time(first.asset.capturedAt) !== time(entry.asset.capturedAt)) return 'Metric evidence repeats earlier bytes under a different capture time; save a metric_snapshot that records its own sampling time and page state (an unchanged screenshot cannot)';
  return null;
}
function assetsFor(events, workId, resolve = assetKey, roundId) {
  // A legacy cross-work registration or copied content must not transfer the first owner's evidence.
  const registry = registeredAssets(events, resolve);
  return registry.forWork(workId).filter(a => !a.fromDraft && !unusable(resolve, a.asset) && (roundId === undefined || (a.roundId === roundId && (registry.firstByHash(a.asset.sha256)?.roundId ?? roundId) === roundId)) && assetMatchesWork(a.asset, a.work) && !copiedContent(a, registry)).map(a => a.asset);
}
function latestCorrection(events, id) {
  // Follow correctsObservationId links to the reading that currently stands for this sample.
  let current = events.find(x => x.type === 'observation' && x.id === id);
  for (let next; current && (next = events.find(x => x.type === 'observation' && x.correctsObservationId === current.id)); ) current = next;
  return current;
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
  const base = 'Observation requires metric-bearing evidence captured at its sampling time and in its round';
  const referenced = e.evidencePaths.map(p => {
    const a = known.get(p);
    check(a, `${base}: ${p} is not usable metric evidence of this work in round ${e.roundId} (unregistered, lost, copied, or first saved in another round)`);
    check(METRIC_ASSET_KINDS.has(a.kind) && a.metrics, `${base}: ${p} carries no metric readings`);
    check(time(a.capturedAt) === time(e.sampledAt), `${base}: ${p} was captured at ${a.capturedAt}`);
    return a;
  });
  for (const [k, m] of Object.entries(e.metrics)) {
    validateMetric(k, m);
    const sources = referenced.filter(a => Object.hasOwn(a.metrics, k));
    check(sources.length > 0 && sources.every(a => isDeepStrictEqual(a.metrics[k], m)), `Observation ${k} does not match its captured metric reading`);
  }
  if (root) for (const a of referenced) check(digest(root, a.path) === a.sha256, `Registered asset changed: ${a.path}`);
}
function eligible(e, registered, resolve = assetKey, { intact = true } = {}) {
  // intact:false asks whether the capture was a substantive read when saved, regardless of later file loss.
  if (e.type !== 'capture') return false;
  const known = registered || registeredAssets([e], resolve);
  const assets = e.assets.filter(a => {
    if (intact && unusable(resolve, a)) return false;
    const first = known.get(resolve(a.path));
    return first?.workId === e.work.id && !first.fromDraft && isDeepStrictEqual(first.asset, a) && assetMatchesWork(a, first.work) && assetMatchesWork(a, e.work) && !copiedContent(first, known);
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
  if (e.type === 'round_started') {
    id(e.roundId); check(!round, 'Round already exists');
    check(nonempty(e.timezone), 'Round timezone required'); new Intl.DateTimeFormat('en', { timeZone: e.timezone });
    e.config = config(e.config); check(nonempty(e.profile), 'Creator profile required');
  } else if (e.type === 'attempt') {
    check(round, 'Unknown round'); id(e.attemptId);
    check(['running', 'paused', 'partial', 'completed'].includes(e.status), 'Invalid attempt status');
    check(nonempty(e.reason), 'Attempt reason required');
    if (e.platform) check(['douyin', 'xiaohongshu'].includes(e.platform), 'Invalid paused platform');
    if (e.status === 'completed') {
      // Count only captures whose files are intact, as status does, so a replacement capture can complete the round.
      const viewResolve = root && !resolve.filtered ? withBroken(resolve, brokenAssets(root, prior, c => c.roundId === e.roundId)) : resolve;
      if (!roundStats(prior, round, viewResolve).coverageComplete) check(false, viewResolve !== resolve && roundStats(prior, round, resolve).coverageComplete ? 'Round coverage relies on missing or changed files; recapture them under new paths' : 'Round count/coverage targets not met; save partial');
    }
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
    check(typeof e.coverage === 'string' && Array.isArray(e.gaps) && e.gaps.every(nonempty), 'Coverage and gaps required; each gap is a nonempty string');
    check(Array.isArray(e.assets) && e.assets.length > 0, 'Assets required');
    check(new Set(e.assets.map(a => registerFile(a.path))).size === e.assets.length, 'Duplicate asset path');
    const registered = registeredAssets(prior, resolve);
    for (const a of e.assets) {
      check(!registered.generated(resolve(a.path)), 'Captured sources cannot reuse registered draft files');
      check(ASSET_KINDS.has(a.kind), `Invalid asset kind: ${a.kind}`); url(a.sourceUrl); time(a.capturedAt);
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
      } else {
        check(!registered.draftContent(hash), 'Captured sources cannot reuse registered draft content');
        const copied = copiedContent({ asset: a, workId: e.work.id }, registered); if (copied) check(!contentOwned(a.kind), copied);
      }
    }
    const owned = e.assets.filter(a => CONTENT_IDENTITY_KINDS.has(a.kind));
    check(new Set(owned.map(a => a.sha256)).size === owned.length, 'Duplicate media or metric content within one capture');
    if (e.readKinds.includes('verified_transcript')) check(e.assets.some(a => a.kind === 'transcript_candidate' && a.status === 'verified'), 'Verified transcript evidence required');
    // Read kinds need the work's own evidence, judged as eligibility does: a reposted copy cannot support them.
    const bound = e.assets.filter(a => workBound(a, e.work) && !copiedContent({ asset: a, workId: e.work.id }, registered));
    for (const kind of e.readKinds) check(supportsRead(kind, bound), `Read kind ${kind} requires compatible saved evidence from the work itself`);
  } else if (e.type === 'observation') {
    requireWork(); check(round, 'Unknown round'); check(time(e.sampledAt) <= recorded, 'Sample time is after event time');
    check(e.metrics && typeof e.metrics === 'object' && !Array.isArray(e.metrics) && Object.keys(e.metrics).length > 0, 'Metrics required');
    const superseded = supersededObservations(prior);
    if (e.correctsObservationId != null) {
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
    requireWork();
    // Judge the review on this work's intact files, as status does, so an unrelated lost file does not block it.
    const viewResolve = root && !resolve.filtered ? withBroken(resolve, brokenAssets(root, prior, c => c.work.id === e.workId)) : resolve;
    const workAssets = assetsFor(prior, e.workId, viewResolve), known = new Set(workAssets.map(a => a.path));
    const cited = paths => { check(Array.isArray(paths) && paths.length > 0, 'Evidence paths required'); for (const p of paths) check(known.has(p), `Evidence not captured for work: ${p}`); };
    cited(e.evidencePaths);
    check(['shortlist', 'watch', 'archive'].includes(e.recommendation), 'Invalid recommendation');
    for (const k of ['summary', 'opportunity', 'angle']) check(nonempty(e[k]), `Review ${k} required`);
    check(Array.isArray(e.captureIds) && e.captureIds.length > 0, 'Read capture IDs required');
    const readCaptures = e.captureIds.map(cid => {
      const capture = prior.find(x => x.type === 'capture' && x.id === cid && x.work.id === e.workId);
      check(capture, 'Review capture not saved for this work');
      return capture;
    });
    const registered = registeredAssets(prior, viewResolve);
    check(readCaptures.some(c => eligible(c, registered, viewResolve)), 'Review requires a substantive eligible capture');
    check(Array.isArray(e.gaps) && e.gaps.every(nonempty) && Array.isArray(e.sourceRefs) && Array.isArray(e.claims), 'Review gaps (nonempty strings), claims and sourceRefs arrays required');
    const sourceAssets = workAssets.filter(a => INDEPENDENT_SOURCE_KINDS.has(a.kind) && e.evidencePaths.includes(a.path));
    for (const s of e.sourceRefs) {
      url(s.url); check(['exact', 'account_clue', 'unverified'].includes(s.status) && nonempty(s.note), 'Source status/note required');
      if (s.status === 'exact') check(sourceAssets.some(a => a.sourceUrl === s.url), 'Exact source reference requires cited captured source evidence with a matching URL');
    }
    for (const c of e.claims) {
      check(nonempty(c.text) && ['verified', 'author_report', 'inference', 'unresolved'].includes(c.status), 'Invalid claim'); cited(c.evidencePaths);
      if (c.status === 'verified') check(workAssets.some(a => INDEPENDENT_SOURCE_KINDS.has(a.kind) && c.evidencePaths.includes(a.path)), 'A verified claim must cite an independent source or research note; a caption alone is an author_report');
    }
    check(Array.isArray(e.comments), 'Comments array required (empty means no verified discussion)');
    const commentAssets = workAssets.filter(a => ['comments', 'source_comments'].includes(a.kind));
    for (const c of e.comments) {
      check(['douyin', 'xiaohongshu', 'x'].includes(c.platform) && ['disagreement', 'request', 'meme', 'support', 'ai', 'other'].includes(c.kind), 'Comment platform/kind required');
      check(Number.isSafeInteger(c.sampledCount) && c.sampledCount > 0 && nonempty(c.summary), 'Comment count/summary required'); cited(c.evidencePaths);
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
    }
    // Cancelling an existing task asserts nothing about its baseline, so it works even when that evidence is gone.
    if (e.kind === 'revisit' && !(previous && e.status === 'cancelled')) {
      const baseline = prior.find(x => x.id === e.baselineObservationId && x.type === 'observation' && x.workId === e.workId && x.metrics.likes && x.metrics.likes.precision !== 'unavailable');
      check(baseline, 'Revisit needs a saved like observation');
      if (!previous) check(!supersededObservations(prior).has(baseline.id), 'Baseline observation was corrected; use its latest correction as the baseline');
      // The standing correction, not a superseded original, is the baseline whose record must still be usable.
      const standing = latestCorrection(prior, baseline.id);
      observationEvidence(standing, prior.slice(0, prior.indexOf(standing)), undefined, resolve);
      check(time(e.dueAt) >= time(baseline.sampledAt) + round.config.minIntervalMinutes * 60000, 'Revisit is earlier than the minimum interval');
      const superseded = supersededObservations(prior);
      if (e.status === 'done') {
        check(standing?.metrics.likes && standing.metrics.likes.precision !== 'unavailable', 'Revisit baseline was corrected to an unavailable reading; record a new baseline and task');
        try { observationEvidence(standing, prior.slice(0, prior.indexOf(standing)), root, resolve); } catch (error) { check(false, `Revisit baseline evidence is not intact: ${error.message}`); }
      }
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
    const viewResolve = root && !resolve.filtered ? withBroken(resolve, brokenAssets(root, prior, c => c.work.id === e.workId)) : resolve;
    // Only the newest review counts; when it has lost support an older review is not used in its place.
    const at = prior.findLastIndex(x => x.type === 'review' && x.workId === e.workId);
    check(at >= 0, 'Draft requires a review of this work');
    const issue = eventIssue(root, prior[at], prior.slice(0, at), viewResolve, internals);
    check(!issue, `Draft review ${prior[at].id} is no longer valid: ${issue}. Recapture the missing evidence and record a new review before registering a new draft`);
    check(prior[at].id === e.reviewId, 'Draft must reference the current review revision');
    check(e.status === 'draft', 'Generated script remains draft');
    if (e.hashes === undefined) e.hashes = {};
    check(e.hashes && typeof e.hashes === 'object' && !Array.isArray(e.hashes), 'Draft hashes must be a plain object');
    check(Object.keys(e.hashes).every(k => ['briefPath', 'scriptPath', 'evidencePath'].includes(k)), 'Draft hashes may only name briefPath, scriptPath and evidencePath');
    const draftKeys = ['briefPath', 'scriptPath', 'evidencePath'];
    const resolved = Object.fromEntries(draftKeys.map(k => [k, registerFile(e[k])]));
    check(new Set(Object.values(resolved)).size === 3, 'Brief, script and evidence must be separate files');
    const sources = registeredAssets(prior, resolve);
    for (const key of Object.values(resolved)) check(!sources.has(key), 'Draft files must be separate from captured source files');
    for (const k of ['briefPath', 'scriptPath', 'evidencePath']) {
      const hash = digest(root, e[k]); if (e.hashes[k]) check(e.hashes[k] === hash, `Draft file changed: ${e[k]}`);
      check(!sources.firstByHash(hash), 'Draft files must differ from captured source content');
      for (const old of prior.filter(x => x.type === 'draft')) for (const oldKey of ['briefPath', 'scriptPath', 'evidencePath']) {
        // Draft files and their content belong to the work that first registered them.
        if (resolve(old[oldKey]) === resolved[k]) { check(old.workId === e.workId, `Draft file already registered for another work: ${e[k]}`); check(old.hashes[oldKey] === hash, `Registered draft cannot be overwritten: ${e[k]}`); }
        else check(old.workId === e.workId || old.hashes?.[oldKey] !== hash, `Draft content of ${e[k]} is already registered for another work`);
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
  if (!events.length) return [];
  // Without hashes only presence is checked: a quick resume view, not proof that bytes are unchanged.
  const internals = lazyInternals(root), realRoot = real(root), issues = [], seen = new Set();
  const probe = (e, kind, file, expected) => {
    const key = `${kind}:${typeof file === 'string' ? assetKey(file) : String(file)}`;
    if (seen.has(key)) return; seen.add(key);
    let reason = null;
    try {
      if (!hashes) { const stat = fs.statSync(path.resolve(root, file)); check(stat.isFile() && stat.size > 0, `Missing/empty ${kind}: ${file}`); }
      else { const { realFile } = registeredFile(root, file, internals, realRoot); if (hashFile(realFile) !== expected) reason = `Registered ${kind} changed: ${file}`; }
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
    const ids = e.type === 'task' && e.status !== 'cancelled' ? [latestCorrection(events, e.baselineObservationId)?.id] : [];
    for (const id of ids) if (byId.has(id)) pending.push(byId.get(id));
  }
  return refs;
}
function sameReplay(existing, input) {
  // A replay may omit helper-filled hashes; any hash it supplies must match the saved one.
  const saved = JSON.parse(JSON.stringify(existing));
  if (saved.type === 'draft' && saved.hashes) {
    if (input.hashes === undefined) delete saved.hashes;
    else if (input.hashes && typeof input.hashes === 'object' && !Array.isArray(input.hashes)) saved.hashes = Object.fromEntries(Object.entries(saved.hashes).filter(([k]) => Object.hasOwn(input.hashes, k)));
  }
  if (saved.type === 'capture' && Array.isArray(saved.assets) && Array.isArray(input.assets)) saved.assets.forEach((a, i) => { if (input.assets[i] && input.assets[i].sha256 === undefined) delete a.sha256; });
  return isDeepStrictEqual(saved, input);
}
function append(root, input) {
  root = path.resolve(root);
  // Only a round start may create a store, so a mistyped --store path cannot silently start a new ledger.
  check(input && typeof input === 'object' && !Array.isArray(input), 'Event object required');
  // A store exists once its journal holds an event; an empty events/ directory does not make one.
  const hasJournal = dir => { try { return fs.readdirSync(path.join(dir, 'events')).some(n => /^\d{8}-[a-zA-Z0-9_.-]+\.json$/.test(n)); } catch { return false; } };
  check(hasJournal(root) || input.type === 'round_started', `No ledger at ${root}; check --store, or start a new store with a round_started event`);
  if (!hasJournal(root)) {
    // A new store nested inside another one, or wrapping one, would be deleted with it when the outer store is
    // retired. Check both the given path and its physical location (directory links can hide nesting).
    let existing = root; const suffix = [];
    while (!fs.existsSync(existing) && path.dirname(existing) !== existing) { suffix.unshift(path.basename(existing)); existing = path.dirname(existing); }
    const physicalRoot = path.join(real(existing), ...suffix);
    for (const start of new Set([root, physicalRoot])) for (let dir = path.dirname(start); ; dir = path.dirname(dir)) {
      check(!hasJournal(dir), `New store ${root} would sit inside the existing store ${dir}; use a sibling directory`);
      if (path.dirname(dir) === dir) break;
    }
    // Subdirectories are scanned without following links, within a budget; a new store belongs in a new directory.
    const pending = [{ dir: root, depth: 0 }]; let visited = 0;
    while (pending.length) {
      const { dir, depth } = pending.pop();
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const d of entries) {
        // A directory named events is scanned too: the new store's own holds no journal yet, and elsewhere it may
        // itself be a store.
        if (!d.isDirectory() || d.isSymbolicLink()) continue;
        const inner = path.join(dir, d.name);
        check(!hasJournal(inner), `New store ${root} would contain the existing store ${inner}; use a sibling directory`);
        check(++visited <= 2000 && depth < 8, `New store ${root} has too many subdirectories to check; create the store in a new directory`);
        pending.push({ dir: inner, depth: depth + 1 });
      }
    }
  }
  fs.mkdirSync(root, { recursive: true });
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
    if (existing && sameReplay(existing, e)) return { appended: false, id: e.id };
    check(!existing || existing.type === e.type, `ID ${e.id} is already used by a ${existing?.type} event; choose a new ID`);
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
    const normalized = validate(root, e, existing ? events.slice(0, events.indexOf(existing)) : events, resolve);
    if (existing) { check(isDeepStrictEqual(existing, normalized), `Conflicting replay: ${e.id}`); return { appended: false, id: e.id }; }
    // Continue after the highest existing sequence number, so a missing journal file cannot block every later save.
    const last = fs.readdirSync(dir).filter(name => /^\d{8}-[a-zA-Z0-9_.-]+\.json$/.test(name)).sort().at(-1), n = (last ? Number(last.slice(0, 8)) : 0) + 1; check(n <= 99999999, 'Ledger sequence exhausted');
    const target = path.join(dir, `${String(n).padStart(8, '0')}-${e.id}.json`);
    const tmp = `${target}.${crypto.randomUUID()}.tmp`;
    const out = fs.openSync(tmp, 'wx');
    try {
      try { fs.writeFileSync(out, `${JSON.stringify(normalized, null, 2)}\n`); fs.fsyncSync(out); } finally { fs.closeSync(out); }
      const prefix = `${String(n).padStart(8, '0')}-`;
      check(!fs.readdirSync(dir).some(name => name.startsWith(prefix) && name.endsWith('.json')), 'Sequence conflict: an event already uses this sequence number'); fs.renameSync(tmp, target);
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    return { appended: true, id: e.id };
  } finally {
    fs.closeSync(fd);
    // A security scanner may briefly hold the lock; report it without turning a committed save into a failure.
    try { fs.unlinkSync(lock); } catch (error) { process.stderr.write(`Warning: could not remove ${lock} (${error.code || error.message}); remove it once no writer is running.\n`); }
  }
}
function roundStats(events, round, resolve = assetKey) {
  const registered = registeredAssets(events, resolve), isEligible = e => eligible(e, registered, resolve);
  // Re-listing files registered in an earlier round is not a new read for this round.
  const freshInRound = e => e.assets.some(a => {
    // Only the capture's own first-owned, uncopied page or video evidence can make it a new read for this round.
    const first = registered.get(resolve(a.path));
    return ['page_screenshot', 'video', 'clip'].includes(a.kind) && !unusable(resolve, a) && workBound(a, e.work) && first?.workId === e.work.id && !first.fromDraft && !copiedContent(first, registered) && first.roundId === e.roundId && (registered.firstByHash(a.sha256)?.roundId ?? e.roundId) === e.roundId;
  });
  const captures = events.filter(e => e.type === 'capture' && e.roundId === round.roundId && isEligible(e) && freshInRound(e));
  // A discovery capture newly saves non-metric evidence of the work; re-listed files do not change what a revisit was.
  const position = new Map(events.map((e, i) => [e, i]));
  const discovers = e => e.assets.some(a => {
    // Only the capture's own, first-owned, uncopied and intact work evidence records a discovery route.
    const first = registered.get(resolve(a.path));
    return !(METRIC_ASSET_KINDS.has(a.kind) && a.metrics !== undefined) && workBound(a, e.work) && first?.index === position.get(e) && first.workId === e.work.id && !first.fromDraft && !copiedContent(first, registered) && !unusable(resolve, a);
  });
  const distinct = new Map(); for (const e of captures) if (!distinct.has(e.work.id)) distinct.set(e.work.id, e);
  const platformCounts = { douyin: 0, xiaohongshu: 0 }, recommended = { douyin: 0, xiaohongshu: 0 };
  let newWorks = 0, practical = 0;
  // Newness follows round order, not save order: a backfill into an earlier round is a previous read.
  const roundIndex = events.indexOf(round), earlierRounds = new Set(events.filter((e, i) => e.type === 'round_started' && i < roundIndex).map(e => e.roundId));
  for (const [wid, first] of distinct) {
    platformCounts[first.work.platform]++;
    // A lead found through recommendations and read later still counts; metrics-only revisit captures do not decide the route.
    if (events.some(e => e.type === 'capture' && e.roundId === round.roundId && e.work.id === wid && discovers(e) && ['recommendation', 'related'].includes(e.route))) recommended[first.work.platform]++;
    // A read stays a past read even if its files were lost later.
    if (!events.some(e => e.type === 'capture' && earlierRounds.has(e.roundId) && e.work.id === wid && eligible(e, registered, resolve, { intact: false }))) newWorks++;
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
  // Compare the newest reading with the most recent one at least the minimum interval earlier, so an extra
  // nearby reading does not erase a measured window. Rounded readings inside the window break exactness.
  const b = points.at(-1), olderBy = (end, p) => time(end.sampledAt) - time(p.sampledAt) >= c.minIntervalMinutes * 60000;
  const startIndex = points.findLastIndex(p => olderBy(b, p)), a = startIndex >= 0 ? points[startIndex] : points.at(-2);
  result.from = a.sampledAt; result.to = b.sampledAt;
  if (points.slice(points.indexOf(a)).some(p => p.metrics.likes.precision !== 'exact')) return { ...result, status: 'rounded_counts' };
  const minutes = (time(b.sampledAt) - time(a.sampledAt)) / 60000, delta = b.metrics.likes.value - a.metrics.likes.value;
  result.delta = delta; result.minutes = minutes;
  // A drop between any two readings in the window is a decrease to check, never net growth; the delta is kept only for a net fall.
  // A one- or two-like wobble is noise; a fall of at least minNewLikes between readings is reported instead of growth.
  // Falls are measured from the highest reading so far, so several small steps down still add up.
  const dropped = window => { let peak = -Infinity; return window.some(p => { const value = p.metrics.likes.value, fall = peak - value; peak = Math.max(peak, value); return fall > 0 && fall >= c.minNewLikes; }); };
  if (delta < 0 || dropped(points.slice(points.indexOf(a)))) return { ...result, delta: delta < 0 ? delta : null, status: 'count_decreased' };
  if (startIndex < 0) return { ...result, status: 'interval_too_short' };
  result.perHour = delta / (minutes / 60);
  result.relative = a.metrics.likes.value > 0 ? delta / a.metrics.likes.value : null;
  if (minutes > c.shortWindowHours * 60) return { ...result, status: 'cross_round_average' };
  result.status = 'short_window';
  result.lowLikeFast = b.metrics.likes.value < c.lowLikeCeiling && delta >= c.minNewLikes && (a.metrics.likes.value === 0 || result.relative >= c.minRelativeGrowth);
  result.fast = delta >= c.minNewLikes && result.perHour >= c.fastLikesPerHour;
  // Acceleration compares this window with the preceding window built the same way.
  const previousIndex = delta >= c.minNewLikes ? points.findLastIndex(p => olderBy(a, p)) : -1;
  if (previousIndex >= 0) {
    const p = points[previousIndex], previousMinutes = (time(a.sampledAt) - time(p.sampledAt)) / 60000;
    const previousWindow = points.slice(previousIndex, startIndex + 1);
    if (previousWindow.every(x => x.metrics.likes.precision === 'exact') && !dropped(previousWindow) && previousMinutes <= c.shortWindowHours * 60) {
      const previousSpeed = (a.metrics.likes.value - p.metrics.likes.value) / (previousMinutes / 60);
      result.accelerating = previousSpeed > 0 && result.perHour >= previousSpeed * c.accelerationRatio;
    }
  }
  return result;
}
function snapshot(events, now = new Date().toISOString(), root, integrity) {
  // Programmatic callers that pass the store but no integrity result still get the full file check.
  if (integrity === undefined) integrity = root ? integrityIssues(root, events) : [];
  time(now); const source = events;
  // Changed or missing registered files keep their ownership and read history but no longer support derived results.
  const broken = new Set(integrity.filter(x => x.kind === 'asset' && typeof x.path === 'string').map(x => assetKey(x.path)));
  const works = new Map(), rounds = events.filter(e => e.type === 'round_started');
  const resolve = root ? fileResolver(root) : file => assetKey(file);
  resolve.ledger = events; resolve.filtered = true; resolve.broken = broken;
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
  const superseded = supersededObservations(events), order = new Map(events.map((e, i) => [e, i])), registry = registeredAssets(events, resolve);
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
    // When the newest review has lost support, an older recommendation is not promoted in its place.
    const reviewBlocked = reviews.length > 0 && reviews.at(-1) !== review;
    // A relative date label is anchored to the work page or caption first saved by the capture that recorded it;
    // files re-listed from earlier captures keep their own, older times.
    const seesWork = (c, a) => ['page_screenshot', 'caption'].includes(a.kind) && workBound(a, c.work) && registry.get(resolve(a.path))?.index === order.get(c);
    // The latest capture that newly saved the work page or caption with this label supplies its anchor.
    // Date fields come from the latest capture that newly saved the work page or caption with a label, so a
    // metrics-only revisit cannot overwrite or blank them. A confirmed publication date still wins.
    const pageRead = c => nonempty(c.work.dateLabel) && c.assets.some(a => seesWork(c, a));
    const latestRead = captures.findLast(pageRead);
    let shown = latestRead && { dateKind: latestRead.work.dateKind, dateLabel: latestRead.work.dateLabel };
    if (work.publishedAt != null && latestRead?.work.dateKind !== 'edited') {
      // A confirmed publication stays shown, labelled from the latest page read that recorded it, unless a newer
      // page read shows an edit label; kind and label never come from different readings.
      const published = captures.findLast(c => pageRead(c) && c.work.dateKind === 'published');
      shown = { dateKind: 'published', dateLabel: published ? published.work.dateLabel : work.dateLabel };
    }
    const shownWork = shown ? { ...work, ...shown } : work;
    const labelRead = captures.findLast(c => c.work.dateKind === shownWork.dateKind && c.work.dateLabel === shownWork.dateLabel && c.assets.some(a => seesWork(c, a)));
    const dateSeenAt = labelRead ? labelRead.assets.filter(a => seesWork(labelRead, a)).map(a => a.capturedAt).sort((x, y) => time(x) - time(y))[0] : null;
    const draftGaps = draftHistory.filter(e => draftChecks.get(e.id)).map(e => ({ draftId: e.id, recordedAt: e.recordedAt, reason: draftChecks.get(e.id) }));
    // Ledger order, not equal timestamps, decides whether a review came after the user's decision.
    const reviewAfterDecision = Boolean(review && decision && order.get(review) > order.get(decision));
    return { work: shownWork, dateSeenAt, reviewAfterDecision, captures, assets: assetsFor(events, workId, resolve), latest, evidenceGaps, correctedObservations, growth: growth(observations, metricConfig('likes')),
      lowFollower: latest.followers?.precision === 'exact' ? latest.followers.value <= metricConfig('followers').lowFollowerCeiling : null,
      review, reviewBlocked, reviews, reviewGaps, decision,
      drafts: draftHistory.filter(e => !draftChecks.get(e.id)), draftHistory, draftGaps, integrityIssues: integrity.filter(x => x.workId === workId) };
  });
  // Pending work on a rejected topic stays in history but is no longer due.
  const rejected = new Set(items.filter(i => i.decision?.decision === 'rejected').map(i => i.work.id));
  const baselineState = t => {
    const b = latestCorrection(groups.get(t.workId)?.observations || [], t.baselineObservationId);
    if (!b || observationChecks.get(b.id)) return 'evidence_lost';
    return b.metrics.likes && b.metrics.likes.precision !== 'unavailable' ? 'ok' : 'unavailable';
  };
  // A finished revisit reopens when its baseline was corrected to unavailable or its completing reading no longer
  // stands; lost baseline files only flag it, because the revisit itself already happened.
  const revisitDone = t => baselineState(t) !== 'unavailable' && (groups.get(t.workId)?.observations || []).some(o => !observationChecks.get(o.id) && !superseded.has(o.id) && o.metrics.likes && o.metrics.likes.precision !== 'unavailable' && time(o.sampledAt) >= time(t.dueAt));
  return { generatedAt: now, eventCount: source.length, integrityIssues: integrity, items,
    rounds: rounds.map(r => ({ ...r, ...roundStats(events, r, resolve), attempts: events.filter(e => e.type === 'attempt' && e.roundId === r.roundId) })),
    tasks: [...taskMap.values()].map(t => {
      const reopened = t.kind === 'revisit' && t.status === 'done' && !revisitDone(t), status = reopened ? 'pending' : t.status;
      const suppressed = status === 'pending' && rejected.has(t.workId);
      // A revisit whose baseline is unavailable or lost cannot be completed, so it is flagged instead of due.
      const baseline = t.kind === 'revisit' ? baselineState(t) : 'ok';
      return { ...t, status, ...(reopened ? { recordedStatus: 'done', reopened: true } : {}), ...(baseline === 'unavailable' ? { baselineUnavailable: true } : {}), ...(baseline === 'evidence_lost' ? { baselineEvidenceLost: true } : {}), suppressed, due: status === 'pending' && !suppressed && baseline === 'ok' && (t.dueAt == null || time(t.dueAt) <= time(now)) };
    }) };
}
function pausedPlatforms(attempts) {
  // The latest platform-specific state wins; an attempt without a platform resumes or settles every platform.
  const state = {};
  for (const a of attempts) { if (a.platform) state[a.platform] = a.status; else for (const k of ['douyin', 'xiaohongshu']) state[k] = a.status; }
  return Object.keys(state).filter(k => state[k] === 'paused');
}
function summary(state) {
  // Compact view for an agent resuming work; status and snapshot.json keep the full history.
  const candidates = state.items.filter(i => i.review?.recommendation === 'shortlist' && !i.reviewBlocked && !['watch', 'rejected', 'selected'].includes(i.decision?.decision)).sort((a, b) => time(b.review.recordedAt) - time(a.review.recordedAt));
  const recentSince = time(state.generatedAt) - 7 * 86400000, priority = candidates.filter(i => time(i.review.recordedAt) >= recentSince);
  return { generatedAt: state.generatedAt, eventCount: state.eventCount, works: state.items.length, profile: state.rounds.at(-1)?.profile ?? null, storeExists: state.storeExists ?? true, journalGaps: state.journalGaps ?? [], journalDuplicates: state.journalDuplicates ?? [], integrityChecked: 'presence', integrityIssues: state.integrityIssues,
    roundCount: state.rounds.length, olderShortlist: candidates.length - priority.length,
    rounds: state.rounds.slice(-5).map(r => ({ roundId: r.roundId, timezone: r.timezone, targets: r.config.targets, unique: r.unique, platformCounts: r.platformCounts, newWorks: r.newWorks, recommended: r.recommended, practical: r.practical, repeatReads: r.repeatReads, countComplete: r.countComplete, coverageComplete: r.coverageComplete, pausedPlatforms: pausedPlatforms(r.attempts), lastAttempt: r.attempts.length ? (({ attemptId, status, platform, reason, recordedAt }) => ({ attemptId, status, platform, reason, recordedAt }))(r.attempts.at(-1)) : null })),
    pendingTasks: state.tasks.filter(t => t.status === 'pending').map(({ taskId, workId, kind, reason, dueAt, due, suppressed, reopened, baselineUnavailable, baselineEvidenceLost }) => ({ taskId, workId, kind, reason, dueAt, due, suppressed, ...(reopened ? { reopened } : {}), ...(baselineUnavailable ? { baselineUnavailable } : {}), ...(baselineEvidenceLost ? { baselineEvidenceLost } : {}) })),
    shortlist: priority.map(i => ({ workId: i.work.id, title: i.work.title, angle: i.review.angle, reviewId: i.review.id })),
    decisions: state.items.filter(i => i.decision).map(i => ({ workId: i.work.id, decision: i.decision.decision, recordedAt: i.decision.recordedAt })),
    gaps: state.items.filter(i => i.evidenceGaps.length || i.reviewGaps.length || i.draftGaps.length || i.integrityIssues.length).map(i => ({ workId: i.work.id, evidenceGaps: i.evidenceGaps.length, reviewGaps: i.reviewGaps.length, draftGaps: i.draftGaps.length, integrityIssues: i.integrityIssues.length })) };
}
function journalGaps(root) {
  // Missing sequence numbers mean a journal file was removed, for example by a sync conflict or quarantine;
  // a repeated number means a removed file came back after a newer event took its place. A lost last file
  // leaves no trace.
  const dir = eventDirectory(root);
  if (!fs.existsSync(dir)) return { gaps: [], duplicates: [] };
  const numbers = fs.readdirSync(dir).filter(n => /^\d{8}-[a-zA-Z0-9_.-]+\.json$/.test(n)).map(n => Number(n.slice(0, 8)));
  const seen = new Set(), duplicates = new Set();
  for (const n of numbers) { if (seen.has(n)) duplicates.add(n); seen.add(n); }
  const gaps = [];
  for (let n = 1; n <= Math.max(0, ...seen); n++) if (!seen.has(n)) gaps.push(n);
  return { gaps, duplicates: [...duplicates].sort((a, b) => a - b) };
}
function readUtf8(file) {
  // Reject UTF-16 and legacy code pages instead of saving garbled text into the append-only ledger.
  const bytes = fs.readFileSync(file);
  check(!(bytes[0] === 0xff && bytes[1] === 0xfe) && !(bytes[0] === 0xfe && bytes[1] === 0xff), 'Input must be UTF-8; this file is UTF-16');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Input must be valid UTF-8; re-save the event JSON as UTF-8'); }
}
function main(argv) {
  const command = argv[0], opts = {};
  for (let i = 1; i < argv.length; i += 2) { check(argv[i].startsWith('--') && argv[i + 1], 'Use --name value options'); check(['--store', '--input', '--out', '--now'].includes(argv[i]), `Unknown option: ${argv[i]}`); opts[argv[i].slice(2)] = argv[i + 1]; }
  check(opts.store, 'Usage: radar.cjs append|summary|status|render --store <directory> [--input event.json] [--out report-directory] [--now ISO-time]');
  check(['append', 'summary', 'status', 'render'].includes(command), 'Unknown command');
  if (command === 'render') check(opts.out, '--out required');
  if (command === 'append') { check(opts.input, '--input required'); return append(opts.store, JSON.parse(readUtf8(opts.input))); }
  const events = load(opts.store), issues = integrityIssues(opts.store, events, { hashes: command !== 'summary' }), state = snapshot(events, opts.now, opts.store, issues);
  if (issues.length) process.stderr.write(`Warning: ${issues.length} registered file(s) are missing or changed and are excluded from derived results; see integrityIssues.\n`);
  const journal = journalGaps(opts.store);
  state.storeExists = fs.existsSync(path.resolve(opts.store)); state.journalGaps = journal.gaps; state.journalDuplicates = journal.duplicates;
  if (state.journalDuplicates.length) process.stderr.write(`Warning: journal sequence numbers ${state.journalDuplicates.join(', ')} are used more than once; a removed event file may have come back.\n`);
  if (!state.storeExists) process.stderr.write(`Warning: store ${path.resolve(opts.store)} does not exist; check --store before appending.\n`);
  if (state.journalGaps.length) process.stderr.write(`Warning: journal sequence numbers ${state.journalGaps.join(', ')} are missing; an event file was removed.\n`);
  if (command === 'render') { check(opts.out, '--out required'); return require('./render-radar.cjs').writeReport(state, opts.store, opts.out, events); }
  return command === 'summary' ? summary(state) : state;
}
if (require.main === module) { try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { DEFAULTS, append, load, snapshot, summary, growth, roundStats, eligible, verifyFiles, integrityIssues, relativeFile, main };
