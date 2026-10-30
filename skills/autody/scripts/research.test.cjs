const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const research = require('./research.cjs');
const radar = require('../../social-radar/scripts/radar.cjs');
const stamp = () => new Date().toISOString();
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

function fixture(t, topic = 'Synthetic topic <script>alert(1)</script>') {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'autody-topic-test-'));
  t.after(() => { const resolved = fs.realpathSync(root); assert.equal(path.dirname(resolved), parent); assert.ok(path.basename(resolved).startsWith('autody-topic-test-')); fs.rmSync(resolved, { recursive: true }); });
  const result = research.start({ topic, root, perPlatform: 1, timezone: 'Asia/Taipei' });
  fs.mkdirSync(path.join(result.store, 'materials'));
  return { root, store: result.store, topic, roundId: result.roundId };
}
function searches(f) {
  const task = read(path.join(f.store, 'task.json'));
  for (const q of task.queries) {
    const file = `materials/search-${q.platform}.txt`;
    fs.writeFileSync(path.join(f.store, file), `Synthetic search snapshot: ${q.query}`);
    research.recordSearch(f.store, { queryId: q.id, url: `https://www.${q.platform}.com/search`, resultUrls: [], notes: 'Synthetic fixture', capturedAt: stamp(), evidencePath: file });
  }
}
function capture(f, platform, suffix = '1', kinds = ['caption_body']) {
  const id = `${platform}-${suffix}`, workId = `${platform}:example`, sourceUrl = `https://www.${platform}.com/${platform === 'douyin' ? 'video' : 'explore'}/example`;
  fs.writeFileSync(path.join(f.store, `materials/${id}.md`), `Synthetic distinct body ${id}`);
  fs.writeFileSync(path.join(f.store, `materials/${id}.png`), Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFQAAAABJRU5ErkJggg==', 'base64'), Buffer.from(id)]));
  const e = { type: 'capture', id, recordedAt: stamp(), roundId: f.roundId, work: { id: workId, platform, url: sourceUrl, title: `Synthetic ${platform}`, author: 'Fixture author', dateKind: 'unknown', dateLabel: 'unknown', publishedAt: null }, route: 'search', practicalMethod: false, readKinds: kinds, coverage: 'Synthetic caption fixture; not real research', gaps: [], assets: [
    { kind: 'caption', path: `materials/${id}.md`, sourceUrl, capturedAt: stamp(), coverage: 'Synthetic caption' },
    { kind: 'page_screenshot', path: `materials/${id}.png`, sourceUrl, capturedAt: stamp(), coverage: 'Synthetic pixel fixture' },
  ] };
  e.recordedAt = stamp(); // Commit after captures, including when the clock crosses a millisecond.
  radar.append(f.store, e); return e;
}
function assess(f, c, relevant = true) { return research.assess(f.store, { workId: c.work.id, captureId: c.id, relevant, reason: 'Synthetic topic relationship' }); }
function review(f, c) {
  radar.append(f.store, { type: 'review', id: `review-${c.id}`, recordedAt: stamp(), workId: c.work.id, captureIds: [c.id], summary: 'Synthetic claim.', opportunity: 'Test opportunity.', angle: 'Test angle.', recommendation: 'shortlist', evidencePaths: c.assets.map(a => a.path), gaps: [], comments: [], sourceRefs: [], claims: [] });
}
function complete(f) { searches(f); for (const p of ['douyin', 'xiaohongshu']) { const c = capture(f, p); assess(f, c); review(f, c); } }
function synthesis(overrides = {}) {
  return { summary: 'Synthetic <script>unsafe()</script>', findings: [{ title: 'Finding', explanation: 'Cross-platform example', sourceIds: ['douyin:example', 'xiaohongshu:example'] }], angles: [{ title: 'Angle', explanation: 'Evidence-backed angle', sourceIds: ['douyin:example'] }], gaps: ['Synthetic fixture only'], partial: false, ...overrides };
}

test('one topic plans both platforms, resumes in place, and refresh archives history', t => {
  const f = fixture(t, 'CON / AI');
  const first = research.next(f.store), resumed = research.start({ root: f.root, topic: f.topic });
  assert.equal(resumed.roundId, first.roundId);
  assert.equal(first.actions.filter(a => a.stage === 'search').length, 2);
  assert.deepEqual(first.targets, { douyin: 1, xiaohongshu: 1 });
  const config = radar.load(f.store)[0].config; assert.equal(config.minNew, 0); assert.equal(config.practicalSlots, 0);
  const fresh = research.start({ root: f.root, topic: f.topic, refresh: true });
  assert.notEqual(fresh.roundId, first.roundId); assert.deepEqual(fresh.targets, { douyin: 6, xiaohongshu: 6 });
  assert.ok(fs.existsSync(path.join(f.store, 'tasks', `${first.roundId}.json`)));
  assert.equal(research.topicKey('ＡＩ'), research.topicKey('AI'));
});
test('query plan requires both platforms and search requires a real local snapshot', t => {
  const f = fixture(t), q = read(path.join(f.store, 'task.json')).queries[0];
  assert.throws(() => research.plan(f.store, { queries: [{ platform: 'douyin', query: 'x' }] }), /both platforms/);
  assert.throws(() => research.recordSearch(f.store, { queryId: q.id, url: 'https://www.douyin.com/search', resultUrls: [], notes: 'x', capturedAt: stamp(), evidencePath: '../outside' }), /material\/search/);
  assert.throws(() => research.recordSearch(f.store, { queryId: q.id, url: 'https://www.douyin.com/search', resultUrls: [], notes: 'x', capturedAt: stamp(), evidencePath: 'missing.txt' }), /missing|ENOENT|exist/i);
});
test('a title card cannot meet quota; off-topic substantive reads do not count', t => {
  const f = fixture(t), lead = capture(f, 'douyin', 'lead', []);
  assert.throws(() => assess(f, lead), /substantive capture/);
  const c = capture(f, 'xiaohongshu'); assess(f, c, false);
  assert.deepEqual(research.next(f.store).counts, { douyin: 0, xiaohongshu: 0 });
});
test('collection still requires review, synthesis and citations from both platforms', t => {
  const f = fixture(t); searches(f);
  for (const p of ['douyin', 'xiaohongshu']) assess(f, capture(f, p));
  assert.ok(research.next(f.store).actions.some(a => a.stage === 'review'));
  assert.throws(() => research.finish(f.store, synthesis()), /reviewed/);
  for (const c of radar.load(f.store).filter(e => e.type === 'capture')) review(f, c);
  assert.equal(research.next(f.store).status, 'ready_to_synthesize');
  assert.throws(() => research.finish(f.store, synthesis({ findings: [{ title: 'x', explanation: 'x', sourceIds: ['douyin:example'] }] })), /both platforms/);
});
test('blockers pause only one platform, partial delivery remains clearly partial', t => {
  const f = fixture(t); searches(f); const c = capture(f, 'douyin'); assess(f, c); review(f, c);
  research.block(f.store, { platform: 'xiaohongshu', reason: 'Human SMS verification' });
  const n = research.next(f.store); assert.ok(n.actions.some(a => a.stage === 'partial-report'));
  const input = synthesis({ partial: true, findings: [{ title: 'x', explanation: 'x', sourceIds: ['douyin:example'] }] });
  assert.equal(research.finish(f.store, input).status, 'partial');
  const resumed = research.block(f.store, { platform: 'xiaohongshu', reason: 'Verified visible search works' }, true);
  assert.ok(resumed.actions.some(a => a.stage === 'collect' && a.platform === 'xiaohongshu'));
  assert.notEqual(resumed.status, 'completed');
});
test('finished report exports all formats, escapes HTML and protects computed fields', t => {
  const f = fixture(t); complete(f);
  const result = research.finish(f.store, synthesis({ topic: 'Spoofed', status: 'forged', counts: {} }));
  assert.equal(result.status, 'completed');
  const dir = path.dirname(result.report), report = read(path.join(dir, 'research.json'));
  assert.equal(report.topic, f.topic); assert.equal(report.status, 'completed'); assert.equal(report.counts.douyin, 1);
  const html = fs.readFileSync(result.report, 'utf8'); assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/);
  for (const file of ['research.md', 'evidence/report.html', 'evidence/tracking.csv', 'evidence/snapshot.json']) assert.ok(fs.statSync(path.join(dir, file)).size > 0);
});
test('changed search snapshot or report file invalidates completed delivery', t => {
  const f = fixture(t); complete(f); let result = research.finish(f.store, synthesis());
  fs.appendFileSync(result.report, 'changed'); assert.equal(research.next(f.store).status, 'ready_to_synthesize');
  result = research.finish(f.store, synthesis());
  fs.appendFileSync(path.join(f.store, 'materials/search-douyin.txt'), 'changed');
  const n = research.next(f.store); assert.notEqual(n.status, 'completed'); assert.ok(n.actions.some(a => a.stage === 'search'));
});
test('new read cannot inherit relevance from a damaged older capture', t => {
  const f = fixture(t); complete(f); research.finish(f.store, synthesis());
  fs.appendFileSync(path.join(f.store, 'materials/douyin-1.md'), 'changed');
  const replacement = capture(f, 'douyin', 'replacement'); review(f, replacement);
  let n = research.next(f.store); assert.equal(n.counts.douyin, 0); assert.ok(n.actions.some(a => a.stage === 'assess' && a.workId === 'douyin:example'));
  assess(f, replacement); n = research.next(f.store); assert.equal(n.counts.douyin, 1); assert.equal(n.status, 'ready_to_synthesize');
});
test('pending backfill prevents completion even with full coverage', t => {
  const f = fixture(t); complete(f);
  radar.append(f.store, { type: 'task', id: 'task-event', recordedAt: stamp(), roundId: f.roundId, taskId: 'backfill-1', kind: 'backfill', status: 'pending', workId: 'douyin:example', reason: 'Need substantive context' });
  assert.notEqual(research.next(f.store).status, 'ready_to_synthesize');
  assert.throws(() => research.finish(f.store, synthesis()), /pending backfills/);
});
test('refresh never counts reads or assessments from an earlier round', t => {
  const f = fixture(t); complete(f); research.finish(f.store, synthesis());
  const fresh = research.start({ root: f.root, topic: f.topic, refresh: true, perPlatform: 1 });
  assert.deepEqual(fresh.counts, { douyin: 0, xiaohongshu: 0 });
  assert.throws(() => assess(f, radar.load(f.store).find(e => e.type === 'capture')), /current topic round/);
});
