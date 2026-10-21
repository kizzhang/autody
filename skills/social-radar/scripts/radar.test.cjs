const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { append, load, snapshot, growth, DEFAULTS, verifyFiles } = require('./radar.cjs');
const { render, writeReport, csvCell } = require('./render-radar.cjs');

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'autody-radar-test-'));
  t.after(() => { const resolved = fs.realpathSync(root); assert.equal(path.dirname(resolved), parent); assert.ok(path.basename(resolved).startsWith('autody-radar-test-')); fs.rmSync(resolved, { recursive: true }); });
  fs.mkdirSync(path.join(root, 'materials'));
  fs.writeFileSync(path.join(root, 'materials/caption.md'), 'Synthetic fixture: author caption, not real research.');
  fs.writeFileSync(path.join(root, 'materials/page.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFQAAAABJRU5ErkJggg==', 'base64'));
  append(root, round()); append(root, capture()); return root;
}
function event(type, id, fields = {}) { return { type, id, recordedAt: '2026-10-21T12:00:00+08:00', ...fields }; }
function round(id = 'r1', config = {}) { return event('round_started', `start-${id}`, { roundId: id, timezone: 'Asia/Taipei', profile: 'Synthetic test creator', config: { targets: { douyin: 0, xiaohongshu: 1 }, minNew: 1, minRecommended: 1, practicalSlots: 1, ...config } }); }
function capture(id = 'capture1', overrides = {}) {
  const sourceUrl = 'https://www.xiaohongshu.com/explore/example';
  return event('capture', id, { roundId: 'r1', work: { id: 'xiaohongshu:example', platform: 'xiaohongshu', url: sourceUrl, title: 'Synthetic title', author: 'Test author', dateKind: 'unknown', dateLabel: '昨天', publishedAt: null }, route: 'recommendation', practicalMethod: true, readKinds: ['caption_body'], coverage: 'Synthetic fixture body', gaps: ['video unavailable'], assets: [
    { kind: 'caption', path: 'materials/caption.md', sourceUrl, capturedAt: '2026-10-21T09:00:00+08:00', coverage: 'Synthetic caption' },
    { kind: 'page_screenshot', path: 'materials/page.png', sourceUrl, capturedAt: '2026-10-21T09:00:00+08:00', coverage: 'Synthetic one-pixel fixture, not a real screenshot' },
  ], ...overrides });
}
function obs(id, hhmmss, likes, precision = 'exact', raw = String(likes)) { return event('observation', id, { roundId: 'r1', workId: 'xiaohongshu:example', sampledAt: `2026-10-21T${hhmmss}+08:00`, metrics: { likes: { value: likes, precision, raw } }, evidencePaths: ['materials/page.png'] }); }
function review(id = 'review1') { return event('review', id, { workId: 'xiaohongshu:example', captureIds: ['capture1'], summary: 'Author makes a conditional claim.', opportunity: 'Explain the conditions.', angle: 'Use a worked example.', recommendation: 'shortlist', evidencePaths: ['materials/caption.md'], gaps: ['Original audio unavailable'], comments: [], sourceRefs: [{ url: 'https://x.com/example/status/1', status: 'account_clue', note: 'Synthetic clue only' }], claims: [{ text: 'Synthetic claim', status: 'author_report', evidencePaths: ['materials/caption.md'] }] }); }

test('append preserves history, idempotently replays and rejects conflicting IDs', t => {
  const root = fixture(t), original = fs.readFileSync(path.join(root, 'events', fs.readdirSync(path.join(root, 'events')).sort()[0]));
  assert.equal(append(root, capture()).appended, false);
  assert.throws(() => append(root, capture('capture1', { coverage: 'different' })), /Conflicting replay/);
  append(root, obs('o1', '09:00:00', 17));
  assert.equal(load(root).length, 3);
  assert.deepEqual(fs.readFileSync(path.join(root, 'events', fs.readdirSync(path.join(root, 'events')).sort()[0])), original);
  assert.ok(load(root)[1].assets.every(a => /^[0-9a-f]{64}$/.test(a.sha256)));
});

test('resume counts unique eligible works and retains pause history', t => {
  const root = fixture(t);
  append(root, event('attempt', 'pause', { roundId: 'r1', attemptId: 'a1', status: 'paused', platform: 'xiaohongshu', reason: 'CAPTCHA' }));
  append(root, event('attempt', 'resume', { roundId: 'r1', attemptId: 'a2', status: 'running', reason: 'User completed verification' }));
  append(root, capture('capture2'));
  append(root, event('attempt', 'complete', { roundId: 'r1', attemptId: 'a2', status: 'completed', reason: 'Targets met' }));
  const r = snapshot(load(root)).rounds[0];
  assert.equal(r.unique, 1); assert.equal(r.repeatReads, 1); assert.equal(r.coverageComplete, true);
  assert.deepEqual(r.attempts.map(a => a.status), ['paused', 'running', 'completed']);
  append(root, round('r2'));
  append(root, capture('capture3', { roundId: 'r2' }));
  assert.equal(snapshot(load(root)).rounds[1].newWorks, 0);
  assert.throws(() => append(root, event('attempt', 'false-complete', { roundId: 'r2', attemptId: 'b', status: 'completed', reason: 'claimed' })), /targets not met/);
});

test('title-only lead and summary cannot fill quotas', t => {
  const root = fixture(t); append(root, round('r2'));
  append(root, capture('lead', { roundId: 'r2', readKinds: [] }));
  assert.equal(snapshot(load(root)).rounds[1].unique, 0);
  assert.throws(() => append(root, capture('summary', { roundId: 'r2', readKinds: ['platform_summary'] })), /substantive read kind/);
  append(root, capture('no-page', { roundId: 'r2', assets: capture().assets.slice(0, 1) }));
  assert.equal(snapshot(load(root)).rounds[1].unique, 0);
});

test('per-metric times survive unavailable profile readings and same-time other metrics', t => {
  const root = fixture(t); append(root, obs('o1', '09:00:00', 17));
  append(root, event('observation', 'profile', { roundId: 'r1', workId: 'xiaohongshu:example', sampledAt: '2026-10-21T09:00:00+08:00', metrics: { followers: { value: 4, raw: '4', precision: 'exact' } }, evidencePaths: ['materials/page.png'] }));
  append(root, event('observation', 'unavailable', { roundId: 'r1', workId: 'xiaohongshu:example', sampledAt: '2026-10-21T09:10:00+08:00', metrics: { likes: { value: null, raw: '', precision: 'unavailable' } }, evidencePaths: ['materials/page.png'] }));
  const item = snapshot(load(root)).items[0];
  assert.equal(item.latest.likes.value, 17); assert.equal(item.latest.likes.sampledAt, '2026-10-21T09:00:00+08:00'); assert.equal(item.latest.followers.value, 4);
  assert.throws(() => append(root, obs('conflict', '09:00:00', 18)), /Duplicate likes/);
});

test('observations reject date-only timestamps, invented exact counts and unavailable-as-zero', t => {
  const root = fixture(t);
  assert.throws(() => append(root, { ...obs('date', '09:00:00', 17), sampledAt: '2026-10-21' }), /Timezone/);
  assert.throws(() => append(root, obs('rounding', '09:00:00', 11000, 'exact', '1.1万')), /matching integer/);
  assert.throws(() => append(root, obs('zero', '09:00:00', 0, 'unavailable', '')), /value:null/);
  append(root, obs('rounded', '09:00:00', null, 'rounded', '1.1万'));
  assert.equal(snapshot(load(root)).items[0].latest.likes.value, null);
});

test('short interval, cross-round, rounded and decreasing counts cannot claim fast growth', () => {
  const a = obs('a', '09:00:00', 10), b = obs('b', '09:19:59', 50);
  assert.equal(growth([a, b]).status, 'interval_too_short'); assert.equal(growth([a, b]).perHour, null);
  const cross = growth([a, obs('c', '16:00:00', 1000)]); assert.equal(cross.status, 'cross_round_average'); assert.equal(cross.fast, false);
  assert.equal(growth([a, obs('r', '09:20:00', null, 'rounded', '1万')]).status, 'rounded_counts');
  assert.equal(growth([a, obs('d', '09:20:00', 9)]).status, 'count_decreased');
});

test('exact windows calculate delta, relative growth, zero baseline and three-point acceleration', () => {
  const a = obs('a', '09:00:00', 10), b = obs('b', '09:20:00', 20), c = obs('c', '09:40:00', 60);
  const g = growth([c, a, b]); assert.equal(g.delta, 40); assert.equal(g.perHour, 120); assert.equal(g.relative, 2); assert.equal(g.accelerating, true); assert.equal(g.lowLikeFast, true);
  assert.equal(growth([a, b]).accelerating, false);
  const zero = growth([obs('z', '09:00:00', 0), b]); assert.equal(zero.relative, null); assert.equal(zero.lowLikeFast, true);
  assert.equal(growth([a, obs('flat', '09:20:00', 10), c]).accelerating, false);
  assert.equal(growth([a, c], { ...DEFAULTS, lowLikeCeiling: 50 }).lowLikeFast, false);
});

test('due queue enforces baseline and requires an actual later observation to complete', t => {
  const root = fixture(t); append(root, obs('baseline', '09:00:00', 17));
  const task = event('task', 'task1', { roundId: 'r1', workId: 'xiaohongshu:example', taskId: 'revisit-example', kind: 'revisit', status: 'pending', reason: 'Observe early growth', baselineObservationId: 'baseline', dueAt: '2026-10-21T09:20:00+08:00' });
  assert.throws(() => append(root, { ...task, dueAt: '2026-10-21T09:19:59+08:00' }), /earlier/);
  append(root, task);
  assert.equal(snapshot(load(root), '2026-10-21T09:19:59+08:00').tasks[0].due, false);
  assert.equal(snapshot(load(root), '2026-10-21T09:20:00+08:00').tasks[0].due, true);
  assert.throws(() => append(root, { ...task, id: 'done', status: 'done' }), /No due-time/);
  append(root, obs('later', '09:20:01', 17)); append(root, { ...task, id: 'done', status: 'done' });
  assert.equal(snapshot(load(root)).tasks[0].status, 'done'); assert.equal(load(root).filter(e => e.type === 'task').length, 2);
});

test('assets must be real local files, stay inside store, and remain immutable', t => {
  const root = fixture(t);
  const bad = capture('bad'); bad.assets[0].path = '../outside.md';
  assert.throws(() => append(root, bad), /escapes store/);
  const missing = capture('missing'); missing.assets[0].path = 'materials/missing.md'; assert.throws(() => append(root, missing));
  fs.writeFileSync(path.join(root, 'materials/page.png'), 'changed');
  assert.throws(() => verifyFiles(root, load(root)), /changed/);
  assert.throws(() => append(root, obs('later', '10:00:00', 18)), /changed/);
});

test('drafts require current real-user selection, source review and separate preserved revisions', t => {
  const root = fixture(t); append(root, review());
  for (const f of ['brief.md', 'script.md', 'evidence.md']) fs.writeFileSync(path.join(root, f), `Synthetic draft ${f}`);
  const d = event('draft', 'draft1', { workId: 'xiaohongshu:example', selectionEventId: 'select1', reviewId: 'review1', status: 'draft', briefPath: 'brief.md', scriptPath: 'script.md', evidencePath: 'evidence.md' });
  assert.throws(() => append(root, d), /explicit user selection/);
  append(root, event('decision', 'select1', { workId: 'xiaohongshu:example', decision: 'selected', userRequest: 'Synthetic user: draft this selected topic', reason: 'Fits the audience' }));
  append(root, d); assert.equal(snapshot(load(root)).items[0].drafts.length, 1);
  fs.writeFileSync(path.join(root, 'script.md'), 'Accidental overwrite');
  assert.throws(() => append(root, { ...d, id: 'overwritten' }), /cannot be overwritten/);
  fs.writeFileSync(path.join(root, 'script.md'), 'Synthetic draft script.md');
  append(root, event('decision', 'reject1', { workId: 'xiaohongshu:example', decision: 'rejected', userRequest: 'Synthetic user: discard', reason: 'Changed direction' }));
  assert.throws(() => append(root, { ...d, id: 'draft2' }), /current explicit/);
  assert.equal(snapshot(load(root)).items[0].drafts.length, 1);
});

test('reviews reject uncaptured evidence and preserve revisions', t => {
  const root = fixture(t);
  assert.throws(() => append(root, { ...review(), evidencePaths: ['made-up.txt'] }), /not captured/);
  append(root, review()); append(root, { ...review('review2'), angle: 'Corrected after reading originals.' });
  assert.equal(snapshot(load(root)).items[0].review.id, 'review2'); assert.equal(load(root).filter(e => e.type === 'review').length, 2);
});

test('crashed temporary events do not count; a live/stale writer lock stops another writer', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'events', '00000003-pending.json.temporary.tmp'), '{partial');
  assert.equal(load(root).length, 2);
  fs.writeFileSync(path.join(root, '.writer.lock'), JSON.stringify({ pid: 123 }));
  assert.throws(() => append(root, obs('later', '10:00:00', 18)), /Writer locked/);
  assert.equal(load(root).length, 2);
});

test('render escapes untrusted material, preserves provenance and exports spreadsheet-safe text', t => {
  const root = fixture(t); append(root, capture('capture2', { work: { ...capture().work, title: '<script>alert(1)</script>' } })); append(root, review()); append(root, obs('o1', '09:00:00', 17));
  const state = snapshot(load(root), '2026-10-21T12:00:00+08:00');
  const out = path.join(root, 'reports'), html = render(state, root, out);
  assert.ok(!html.includes('<script>alert(1)</script>')); assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('account_clue')); assert.ok(html.includes('author_report')); assert.ok(html.includes('Asia/Taipei'));
  assert.ok(html.includes('<img src="../materials/page.png"'));
  const result = writeReport(state, root, out);
  assert.ok(fs.readFileSync(result.csv, 'utf8').startsWith('\uFEFF')); assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('normal'), '"normal"'); assert.equal(JSON.parse(fs.readFileSync(result.snapshot, 'utf8')).items.length, 1);
});

test('CLI works end-to-end in an isolated output folder without browser or network', t => {
  const root = fixture(t), out = path.join(root, 'reports');
  const run = spawnSync(process.execPath, [path.join(__dirname, 'radar.cjs'), 'render', '--store', root, '--out', out], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); assert.ok(fs.existsSync(JSON.parse(run.stdout).report));
  const invalid = spawnSync(process.execPath, [path.join(__dirname, 'radar.cjs'), 'bogus', '--store', root], { encoding: 'utf8' }); assert.equal(invalid.status, 1);
});
