#!/usr/bin/env node
// Task orchestration for the browser agent; no browser, credentials or network client.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const radar = require('../../social-radar/scripts/radar.cjs');
const { writeReport } = require('../../social-radar/scripts/render-radar.cjs');
const PLATFORMS = ['douyin', 'xiaohongshu'];
const check = (ok, message) => { if (!ok) throw new Error(message); };
const text = s => typeof s === 'string' && s.trim().length > 0;
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const uid = () => crypto.randomUUID();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function topicKey(topic) {
  check(text(topic) && topic.length <= 500, 'Topic must contain 1–500 characters');
  const normalized = topic.trim().normalize('NFKC');
  const slug = normalized.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40).replace(/-+$/, '') || 'topic';
  return `topic-${slug}-${hash(normalized).slice(0, 10)}`;
}
function atomic(root, value) {
  const dest = path.join(root, 'task.json');
  if (fs.existsSync(dest)) check(!fs.lstatSync(dest).isSymbolicLink(), 'task.json must not be a symbolic link');
  const temp = path.join(root, `.task-${uid()}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(temp, dest);
}
function taskAt(root) {
  const task = read(path.join(root, 'task.json'));
  check(task.schemaVersion === 1 && task.topicId === topicKey(task.topic) && text(task.roundId), 'Invalid topic task');
  return task;
}
function locked(root, fn) {
  fs.mkdirSync(root, { recursive: true });
  const lock = path.join(root, '.research.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch (e) { if (e.code === 'EEXIST') throw new Error('Research task locked; inspect the active writer before retrying'); throw e; }
  try { fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: now() })); return fn(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function localEvidence(root, file) {
  check(text(file) && !path.isAbsolute(file), 'Evidence path must be store-relative');
  const normalized = file.replaceAll('\\', '/');
  check(!normalized.split('/').some(s => s === '..' || s.startsWith('.')) && !/^(events|deliveries)(\/|$)/.test(normalized) && normalized !== 'task.json', 'Use a material/search file, not task internals');
  const resolved = radar.relativeFile(root, file);
  return { path: file, sha256: hash(fs.readFileSync(resolved)) };
}
function evidenceIntact(root, evidence) {
  try { return localEvidence(root, evidence.path).sha256 === evidence.sha256; } catch { return false; }
}
function platformUrl(value, platform) {
  const u = new URL(value);
  const domains = platform === 'douyin' ? ['douyin.com', 'www.douyin.com'] : ['xiaohongshu.com', 'www.xiaohongshu.com', 'rednote.com', 'www.rednote.com'];
  check(u.protocol === 'https:' && domains.includes(u.hostname) && !u.username && !u.password, 'Expected a visible URL on the specified platform');
  return value;
}
function makeQueries(queries) {
  check(Array.isArray(queries) && queries.length > 0 && queries.length <= 20, 'Supply 1–20 query entries');
  const entries = queries.map(q => {
    check(PLATFORMS.includes(q.platform) && text(q.query) && q.query.length <= 300, 'Each query needs a platform and search phrase');
    return { id: hash(`${q.platform}:${q.query.trim()}`).slice(0, 16), platform: q.platform, query: q.query.trim(), status: 'pending' };
  });
  check(PLATFORMS.every(p => entries.some(q => q.platform === p)), 'The plan must search both platforms');
  return [...new Map(entries.map(q => [q.id, q])).values()];
}
function ensureRound(root, task) {
  const saved = radar.load(root).find(e => e.type === 'round_started' && e.roundId === task.roundId);
  if (!saved) radar.append(root, task.roundEvent);
}
function start(opts) {
  const topicId = topicKey(opts.topic), root = path.resolve(opts.root, topicId);
  return locked(root, () => {
    if (fs.existsSync(path.join(root, 'task.json')) && !opts.refresh) {
      const task = taskAt(root); ensureRound(root, task); return next(root);
    }
    const target = opts.perPlatform === undefined ? 6 : Number(opts.perPlatform);
    check(Number.isSafeInteger(target) && target >= 1 && target <= 100, 'per-platform must be 1–100');
    const timezone = opts.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    if (fs.existsSync(path.join(root, 'task.json'))) {
      const old = taskAt(root), archive = path.join(root, 'tasks'); fs.mkdirSync(archive, { recursive: true });
      fs.writeFileSync(path.join(archive, `${old.roundId}.json`), JSON.stringify(old, null, 2), { flag: 'wx' });
    }
    const createdAt = now(), roundId = `topic-${uid()}`;
    const roundEvent = { id: `start-${roundId}`, type: 'round_started', recordedAt: createdAt, roundId, timezone,
      profile: opts.profile || `Topic research: ${opts.topic.trim()}`, topic: opts.topic.trim(), mode: 'topic',
      config: { targets: { douyin: target, xiaohongshu: target }, minNew: 0, minRecommended: 0, practicalSlots: 0 } };
    const task = { schemaVersion: 1, topicId, topic: opts.topic.trim(), roundId, createdAt, timezone, targets: roundEvent.config.targets,
      brief: opts.profile || '', queries: makeQueries(PLATFORMS.map(platform => ({ platform, query: opts.topic.trim() }))),
      assessments: {}, blockers: {}, history: [], delivery: null, roundEvent };
    atomic(root, task); ensureRound(root, task); return next(root);
  });
}
function view(root) {
  const task = taskAt(root), events = radar.load(root), state = radar.snapshot(events, now(), root);
  const round = state.rounds.find(r => r.roundId === task.roundId);
  check(round, 'Task round is missing from the radar ledger; resume with start');
  const counted = new Set(round.countedWorks);
  const assessed = state.items.filter(i => counted.has(i.work.id) && i.captures.some(c => c.id === task.assessments[i.work.id]?.captureId && c.roundId === task.roundId && i.eligibleCaptureIds.includes(c.id)));
  const items = assessed.filter(i => task.assessments[i.work.id].relevant === true);
  const reviewed = items.filter(i => !i.reviewBlocked && i.review && i.review.captureIds.some(id => i.captures.some(c => c.id === id && c.roundId === task.roundId)));
  const counts = Object.fromEntries(PLATFORMS.map(p => [p, items.filter(i => i.work.platform === p).length]));
  const searchPending = task.queries.filter(q => q.status !== 'done' || !q.evidence || !evidenceIntact(root, q.evidence));
  const pendingTasks = state.tasks.filter(t => t.roundId === task.roundId && t.status === 'pending' && !t.suppressed && (t.kind === 'backfill' || t.due));
  const digest = hash(JSON.stringify({ events, assessments: task.assessments, queries: task.queries, blockers: task.blockers, integrity: state.integrityIssues, searchPending: searchPending.map(q => q.id), pendingTasks: pendingTasks.map(t => t.taskId), brief: task.brief }));
  return { task, events, state, round, items, assessed, reviewed, counts, searchPending, pendingTasks, digest };
}
function next(root) {
  root = path.resolve(root);
  const v = view(root), { task, state } = v;
  const base = { store: root, topic: task.topic, roundId: task.roundId, counts: v.counts, targets: task.targets,
    reviewed: v.reviewed.length, blockers: task.blockers, ledgerGaps: state.integrityIssues, actions: [] };
  const add = (stage, details) => base.actions.push({ stage, ...details });
  for (const q of v.searchPending) if (!task.blockers[q.platform]) add('search', { queryId: q.id, platform: q.platform, query: q.query });
  for (const t of v.pendingTasks) {
    if (!task.blockers[t.workId.split(':')[0]]) add(t.kind, { taskId: t.taskId, workId: t.workId, reason: t.reason });
  }
  const assessed = new Set(v.assessed.map(i => i.work.id));
  for (const id of v.round.countedWorks) if (!assessed.has(id)) add('assess', { workId: id });
  for (const p of PLATFORMS) if (v.counts[p] < task.targets[p] && !task.blockers[p]) add('collect', { platform: p, remaining: task.targets[p] - v.counts[p], queries: task.queries.filter(q => q.platform === p), countedWorks: v.round.countedWorks });
  for (const i of v.items) if (!v.reviewed.includes(i)) add('review', { workId: i.work.id, captureIds: i.captures.filter(c => c.roundId === task.roundId).map(c => c.id) });
  const ready = !v.pendingTasks.length && !v.searchPending.length && PLATFORMS.every(p => v.counts[p] >= task.targets[p]) && v.reviewed.length === v.items.length && !Object.keys(task.blockers).length;
  const delivery = task.delivery;
  const intactDelivery = delivery && delivery.digest === v.digest && delivery.files.every(f => {
    try { return hash(fs.readFileSync(radar.relativeFile(root, f.path))) === f.sha256; } catch { return false; }
  });
  if (intactDelivery) return { ...base, status: delivery.status, report: path.resolve(root, delivery.report), actions: base.actions };
  if (ready) add('synthesize', { message: 'Write synthesis JSON with cited findings and content angles, then finish; collection alone is not completion.' });
  else if (Object.keys(task.blockers).length) add('partial-report', { message: 'Deliver a clearly marked partial report from reviewed sources while keeping blocked platforms pending.' });
  return { ...base, status: ready ? 'ready_to_synthesize' : base.actions.some(a => a.stage !== 'partial-report') ? 'running' : 'blocked', deliveryStale: Boolean(delivery) };
}
function update(root, fn) {
  root = path.resolve(root);
  return locked(root, () => { const task = taskAt(root); fn(task); task.history.push({ at: now(), action: fn.action || 'update' }); atomic(root, task); return next(root); });
}
function plan(root, input) {
  return update(root, task => {
    const proposed = makeQueries(input.queries);
    task.queries = [...new Map([...task.queries.filter(q => q.status === 'done'), ...proposed.map(q => task.queries.find(old => old.id === q.id) || q)].map(q => [q.id, q])).values()];
    if (input.brief !== undefined) { check(text(input.brief), 'Brief must be nonempty'); task.brief = input.brief; }
  });
}
function recordSearch(root, input) {
  return update(root, task => {
    const q = task.queries.find(q => q.id === input.queryId); check(q, 'Unknown planned query');
    check(text(input.notes), 'Save what the search returned, including relevance or an empty result');
    check(Array.isArray(input.resultUrls), 'resultUrls must list the links actually observed');
    input.resultUrls.forEach(u => platformUrl(u, q.platform)); platformUrl(input.url, q.platform);
    check(text(input.capturedAt) && /(?:Z|[+-]\d\d:\d\d)$/.test(input.capturedAt) && Number.isFinite(Date.parse(input.capturedAt)) && Date.parse(input.capturedAt) <= Date.now() + 300000, 'Use the actual timezone-qualified capture time');
    Object.assign(q, { status: 'done', url: input.url, resultUrls: [...new Set(input.resultUrls)], notes: input.notes, capturedAt: input.capturedAt, evidence: localEvidence(root, input.evidencePath) });
  });
}
function assess(root, input) {
  return update(root, task => {
    check(typeof input.relevant === 'boolean' && text(input.reason), 'Record relevance and its topic-specific reason');
    const capture = radar.load(root).find(e => e.type === 'capture' && e.id === input.captureId && e.roundId === task.roundId && e.work.id === input.workId);
    check(capture && capture.readKinds.length, 'Assessment needs a substantive capture from the current topic round');
    task.assessments[input.workId] = { captureId: input.captureId, relevant: input.relevant, reason: input.reason, assessedAt: now() };
  });
}
function block(root, input, clear = false) {
  return update(root, task => {
    check(PLATFORMS.includes(input.platform) && text(input.reason), 'Platform and exact blocker/resolution required');
    if (clear) delete task.blockers[input.platform];
    else task.blockers[input.platform] = { reason: input.reason, at: now() };
    task.history.push({ at: now(), action: clear ? 'unblock' : 'block', ...input });
  });
}
function validateSynthesis(v, input) {
  check(input.partial === undefined || typeof input.partial === 'boolean', 'partial must be a boolean');
  check(text(input.summary), 'Synthesis summary required');
  const known = new Set(v.reviewed.map(i => i.work.id));
  for (const field of ['findings', 'angles']) {
    check(Array.isArray(input[field]) && input[field].length > 0 && input[field].length <= 20, `Supply 1–20 ${field}`);
    for (const row of input[field]) {
      check(text(row.title) && text(row.explanation) && Array.isArray(row.sourceIds) && row.sourceIds.length > 0 && row.sourceIds.every(id => known.has(id)), `${field} must cite reviewed, relevant works from this round`);
    }
  }
  check(Array.isArray(input.gaps) && input.gaps.every(text), 'gaps must be an array of nonempty strings');
  if (!input.partial) {
    check(v.pendingTasks.length === 0, 'Resolve pending backfills and due revisits before completion');
    check(v.searchPending.length === 0 && !Object.keys(v.task.blockers).length, 'Both platform searches must finish and blockers must be resolved; use partial for incomplete delivery');
    check(PLATFORMS.every(p => v.counts[p] >= v.task.targets[p]) && v.items.length === v.reviewed.length, 'Read and review the requested coverage on both platforms before completion');
    const cited = new Set([...input.findings, ...input.angles].flatMap(f => f.sourceIds));
    check(PLATFORMS.every(p => v.reviewed.some(i => i.work.platform === p && cited.has(i.work.id))), 'The synthesis must cite evidence from both platforms');
  } else check(input.gaps.length > 0, 'A partial report must explain its gaps');
}
function finish(root, input) {
  root = path.resolve(root);
  return locked(root, () => {
    const v = view(root); validateSynthesis(v, input);
    const revision = uid(), relative = `deliveries/${revision}`, out = path.join(root, relative);
    fs.mkdirSync(out, { recursive: true });
    writeReport(v.state, root, path.join(out, 'evidence'), v.events);
    const status = input.partial ? 'partial' : 'completed';
    const sources = v.reviewed.map((i, index) => ({ id: i.work.id, number: index + 1, title: i.work.title, author: i.work.author, platform: i.work.platform, url: i.work.url, reviewId: i.review.id, gaps: [...new Set([...i.review.gaps, ...i.captures.filter(c => c.roundId === v.task.roundId).flatMap(c => c.gaps)])] }));
    const sourceMap = new Map(sources.map(s => [s.id, s]));
    const report = { topic: v.task.topic, status, generatedAt: now(), brief: v.task.brief, counts: v.counts, targets: v.task.targets, blockers: v.task.blockers, summary: input.summary, findings: input.findings, angles: input.angles, gaps: input.gaps, partial: Boolean(input.partial), sources };
    const cite = ids => ids.map(id => `[${sourceMap.get(id).number}]`).join(' ');
    const rows = (heading, list) => `\n## ${heading}\n\n${list.map(row => `### ${row.title}\n\n${row.explanation} ${cite(row.sourceIds)}\n`).join('\n')}`;
    const markdown = `# ${report.topic}\n\n状态：${status === 'completed' ? '调研已交付' : '部分完成，仍有缺口'}\n\n抖音 ${v.counts.douyin}/${v.task.targets.douyin} · 小红书 ${v.counts.xiaohongshu}/${v.task.targets.xiaohongshu}\n\n${input.summary}\n${rows('调研发现', input.findings)}${rows('内容机会', input.angles)}\n## 限制与缺口\n\n${input.gaps.length ? input.gaps.map(g => `- ${g}`).join('\n') : '未登记额外缺口；单次样本不代表整个平台。'}\n\n## 来源\n\n${sources.map(s => `${s.number}. [${s.title}](${s.url}) · ${s.platform} · ${s.author}${s.gaps.length ? `\n   - ${s.gaps.join('；')}` : ''}`).join('\n')}\n\n[素材、评论与指标证据](evidence/report.html) · [CSV](evidence/tracking.csv)\n`;
    const section = (heading, list) => `<section><h2>${heading}</h2><div class="cards">${list.map(row => `<article><h3>${esc(row.title)}</h3><p>${esc(row.explanation)}</p><p class="citations">${row.sourceIds.map(id => `<a href="#s${sourceMap.get(id).number}">来源 ${sourceMap.get(id).number}</a>`).join(' ')}</p></article>`).join('')}</div></section>`;
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.topic)} · Autody</title><style>body{margin:0;background:#f5f3ec;color:#192c29;font:16px/1.8 system-ui,sans-serif}header{background:#193c35;color:#fff;padding:48px max(6vw,24px)}header small{color:#d8e8c5}h1{font-size:clamp(28px,4vw,48px);line-height:1.3;max-width:1000px}main{max-width:1180px;margin:auto;padding:28px}section{margin:34px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:20px}article{background:white;padding:24px;border-top:4px solid #b8d779;border-radius:8px}h3{margin-top:0}.citations{font-size:14px}a{color:#146953;overflow-wrap:anywhere}p{white-space:pre-wrap}.status{display:inline-block;background:#dbeaac;color:#193c35;padding:4px 14px;border-radius:20px}.partial{background:#ffd49d}.source{padding:14px 0;border-top:1px solid #cdd6ca}footer{padding:28px;background:#e6ebde}li{margin:8px 0}</style><header><small>AUTODY / TOPIC RESEARCH</small><h1>${esc(report.topic)}</h1><span class="status ${input.partial ? 'partial' : ''}">${input.partial ? '部分完成 · 存在缺口' : '调研已交付'}</span><p>抖音 ${v.counts.douyin}/${v.task.targets.douyin} · 小红书 ${v.counts.xiaohongshu}/${v.task.targets.xiaohongshu} · ${esc(report.generatedAt)}</p></header><main><section><h2>核心判断</h2><p>${esc(input.summary)}</p></section>${section('调研发现', input.findings)}${section('内容机会', input.angles)}<section><h2>限制与缺口</h2><ul>${input.gaps.map(g => `<li>${esc(g)}</li>`).join('') || '<li>单次样本不代表整个平台。</li>'}</ul></section><section><h2>原始来源</h2>${sources.map(s => `<div class="source" id="s${s.number}"><b>${s.number}. <a href="${esc(s.url)}">${esc(s.title)}</a></b><br>${esc(s.platform)} · ${esc(s.author)}${s.gaps.length ? `<p>${esc(s.gaps.join('；'))}</p>` : ''}</div>`).join('')}</section></main><footer><a href="evidence/report.html">素材、评论与指标证据</a> · <a href="evidence/tracking.csv">下载 CSV</a> · <a href="research.md">文字报告</a><p>平台页面与 AI 回复均作为证据材料；初稿和研究判断不代表已发布内容。</p></footer></html>`;
    fs.writeFileSync(path.join(out, 'research.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(out, 'research.md'), markdown);
    fs.writeFileSync(path.join(out, 'research.html'), html);
    const files = ['research.json', 'research.md', 'research.html', 'evidence/report.html', 'evidence/tracking.csv', 'evidence/snapshot.json'].map(file => ({ path: `${relative}/${file}`, sha256: hash(fs.readFileSync(path.join(out, file))) }));
    v.task.delivery = { status, digest: v.digest, files, report: `${relative}/research.html`, at: now() };
    v.task.history.push({ at: now(), action: 'finish', status }); atomic(root, v.task);
    return next(root);
  });
}
function main(argv) {
  const command = argv[0], opts = {};
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i]; check(['--topic', '--root', '--store', '--per-platform', '--timezone', '--profile', '--input', '--refresh'].includes(key), `Unknown option: ${key}`);
    if (key === '--refresh') opts.refresh = true;
    else { check(argv[i + 1] && !argv[i + 1].startsWith('--'), `${key} needs a value`); opts[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i]; }
  }
  if (command === 'start') { check(text(opts.root), '--root required (use the project output directory)'); return start(opts); }
  check(text(opts.store), '--store required');
  if (['next', 'status'].includes(command)) return next(opts.store);
  check(text(opts.input), '--input JSON file required'); const input = read(opts.input);
  if (command === 'plan') return plan(opts.store, input);
  if (command === 'search') return recordSearch(opts.store, input);
  if (command === 'assess') return assess(opts.store, input);
  if (command === 'block' || command === 'unblock') return block(opts.store, input, command === 'unblock');
  if (command === 'finish') return finish(opts.store, input);
  throw new Error('Use start|plan|search|assess|block|unblock|next|finish');
}
if (require.main === module) { try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { start, next, plan, recordSearch, assess, block, finish, topicKey, main };
