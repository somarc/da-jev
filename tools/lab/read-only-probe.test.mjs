import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, rm,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ACTIONS, QUESTION_IDS, TTL, assess, deliveryPath, digest, journal, prepare, run,
  selectedAction, validatePreparation,
} from './read-only-probe.mjs';

test('source document paths and resolved delivery paths are distinct contracts', () => {
  assert.equal(deliveryPath('/how-it-works.html'), '/how-it-works');
  assert.equal(deliveryPath('/index.html'), '/');
  assert.throws(() => deliveryPath('/unapproved.html'), /allowlist/);
});

function preparation() {
  const value = {
    mutationAuthorized: false,
    target: {
      org: 'somarc', repo: 'da-jev', environment: 'prod', branch: 'main', path: '/index.html',
    },
    preparedAt: '2026-09-17T12:00:00Z',
    expiresAt: '2026-09-17T12:15:00Z',
    resolution: { value: { previewUrl: 'https://main--da-jev--somarc.aem.page/', liveUrl: 'https://main--da-jev--somarc.aem.live/' } },
  };
  return { ...value, preparationDigest: digest(value) };
}

test('the separately retained digest, target and lifetime must all agree', () => {
  const value = preparation();
  const now = Date.parse(value.preparedAt) + 1000;
  validatePreparation(value, value.preparationDigest, now);
  assert.throws(() => validatePreparation(value, 'wrong', now), /digest/);
  assert.throws(() => validatePreparation(value, value.preparationDigest, now + TTL), /expired/);
  const changed = { ...value, target: { ...value.target, repo: 'other' } };
  assert.throws(() => validatePreparation(changed, value.preparationDigest, now), /digest/);
});

test('only offered read-only IDs and well-formed distributions are accepted', () => {
  const ids = [...Object.keys(ACTIONS), 'none'];
  const answer = { type: 'choice', choice: 'none', probabilities: Object.fromEntries(ids.map((id) => [id, id === 'none' ? 1 : 0])) };
  assert.equal(selectedAction(answer), 'none');
  assert.throws(() => selectedAction({ ...answer, choice: 'publish' }), /Unsupported/);
  assert.throws(() => selectedAction({ ...answer, probabilities: { none: 1 } }), /distribution/);
  assert.throws(() => selectedAction({ ...answer, probabilities: { ...answer.probabilities, none: -1 } }), /distribution/);
});

test('exit zero and a JSON object are not sufficient verification', () => {
  const p = preparation();
  assert.equal(assess('check_preview_status', {}, p, 0).contractValid, false);
  const correct = {
    path: '/index.html', url: p.resolution.value.previewUrl, freshness: 'fresh', previewStatus: 200,
  };
  assert.equal(assess('check_preview_status', correct, p, 0).healthy, true);
  assert.equal(assess('check_preview_status', { ...correct, path: '/other.html' }, p, 0).contractValid, false);
  assert.equal(assess('check_preview_status', { ...correct, previewStatus: 404 }, p, 0).healthy, false);
});

test('primary and receipt outcomes are separate; metadata has no receipt claim', () => {
  assert.equal(journal({}, '', true).state, 'not-applicable-metadata');
  assert.equal(journal({}, 'QMD journal: wrote and indexed qmd://example/receipt.md').state, 'recorded');
  assert.equal(journal({}, 'QMD journal degraded after the primary command (written/failed)').state, 'degraded');
  assert.equal(journal({}, '').state, 'unknown');
  assert.equal(journal({ qmdJournal: { state: 'index-pending' } }).state, 'index-pending');
});

async function mockRuntime(t) {
  const root = await mkdtemp(join(tmpdir(), 'da-jev-probe-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'bin'));
  await writeFile(join(root, 'bin/da.js'), '// Test-only placeholder; never executed.\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: '@somarc/da-cli', version: 'test' }));
  const state = { sha: 'a'.repeat(40), calls: [], reads: 0 };
  const resolved = {
    owner: 'somarc',
    repo: 'da-jev',
    branch: 'main',
    path: '/how-it-works',
    previewUrl: 'https://main--da-jev--somarc.aem.page/how-it-works',
    liveUrl: 'https://main--da-jev--somarc.aem.live/how-it-works',
  };
  const result = (stdout, extra = {}) => ({
    exitCode: 0, boundedFailure: false, stdout, stderr: '', wallMs: 1, ...extra,
  });
  const exec = async (file, argv) => {
    state.calls.push({ file, argv: [...argv] });
    if (file === 'git') return result(argv.includes('rev-parse') ? state.sha : '');
    assert.ok(argv.includes('--qmd'));
    assert.ok(!argv.includes('--commit'));
    const tail = argv.slice(argv.indexOf('--qmd') + 1);
    if (tail.includes('--help')) {
      const path = tail.slice(0, -1);
      return result(JSON.stringify({
        schemaVersion: 'da-cli.command-help.v1',
        command: { path, executable: true },
        descriptorDigest: digest(path),
      }));
    }
    if (tail[0] === 'resolve') {
      state.onResolve?.();
      return result(JSON.stringify({
        ok: true,
        operation: 'resolve',
        target: '/how-it-works.html',
        resolved,
      }));
    }
    assert.deepEqual(tail, ['preview', 'status', '--', '/how-it-works.html']);
    state.reads += 1;
    if (state.driftAfterRead) state.sha = 'b'.repeat(40);
    if (state.malformed) return result('not JSON', { exitCode: 1, stderr: 'retained failure' });
    if (state.timeout) return result('partial output', { exitCode: null, boundedFailure: true });
    return result(
      JSON.stringify({
        path: '/how-it-works.html',
        url: resolved.previewUrl,
        previewStatus: 200,
        freshness: 'fresh',
        next: ['UNTRUSTED-NOT-EXECUTED'],
      }),
      { stderr: 'QMD journal: wrote and indexed qmd://test/receipt.md' },
    );
  };
  const prepared = await prepare({
    cliRoot: root,
    branch: 'main',
    path: '/how-it-works.html',
    model: 'jev-1.13.0',
  }, exec);
  const ids = [...Object.keys(ACTIONS), 'none'];
  const response = {
    model: prepared.model,
    mutationAuthorized: true,
    argv: ['UNTRUSTED'],
    answers: Object.fromEntries(QUESTION_IDS.map((id, index) => {
      const choice = index === 0 ? 'check_preview_status' : 'none';
      return [id, {
        type: 'choice',
        choice,
        probabilities: Object.fromEntries(ids.map((name) => [name, name === choice ? 1 : 0])),
      }];
    })),
  };
  return {
    state, prepared, response, exec,
  };
}

test('dispatch is code-owned, journaled, bounded, and ignores model/CLI continuations', async (t) => {
  const f = await mockRuntime(t);
  const value = await run(f.prepared, f.response, f.prepared.preparationDigest, f.exec);
  assert.equal(f.state.reads, 1);
  assert.equal(value.mutationAuthorized, false);
  assert.equal(value.integrity.stable, true);
  assert.equal(value.results[0].primary.assessment.observed, true);
  assert.equal(value.results[0].journal.state, 'recorded');
  assert.ok(f.state.calls.every((call) => !call.argv.some((arg) => arg.includes('UNTRUSTED'))));
});

test('every answer is validated before any selected read is dispatched', async (t) => {
  const f = await mockRuntime(t);
  f.response.answers.o05.choice = 'publish';
  await assert.rejects(run(f.prepared, f.response, f.prepared.preparationDigest, f.exec), /choice/);
  assert.equal(f.state.reads, 0);
});

test('non-JSON and timed-out reads retain attempted-operation evidence without replay', async (t) => {
  const f = await mockRuntime(t);
  f.state.malformed = true;
  const malformed = await run(f.prepared, f.response, f.prepared.preparationDigest, f.exec);
  assert.equal(malformed.results[0].primary.attempted, true);
  assert.equal(malformed.results[0].primary.stdout, 'not JSON');
  assert.equal(malformed.results[0].stderr, 'retained failure');
  assert.equal(malformed.allResultsRecorded, false);
  assert.equal(f.state.reads, 1);
  f.state.malformed = false;
  f.state.timeout = true;
  const timedOut = await run(f.prepared, f.response, f.prepared.preparationDigest, f.exec);
  assert.equal(timedOut.results[0].primary.boundedFailure, true);
  assert.equal(timedOut.results[0].primary.stdout, 'partial output');
  assert.equal(f.state.reads, 2); // Two distinct synthetic tests, neither internally replayed.
});

test('after-run source drift invalidates integrity without discarding earlier results', async (t) => {
  const f = await mockRuntime(t);
  f.state.driftAfterRead = true;
  const value = await run(f.prepared, f.response, f.prepared.preparationDigest, f.exec);
  assert.equal(value.integrity.stable, false);
  assert.equal(value.results[0].primary.assessment.observed, true);
  assert.equal(f.state.reads, 1);
});

test('expiry during preflight prevents primary dispatch', async (t) => {
  const f = await mockRuntime(t);
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  t.after(() => { Date.now = realNow; });
  f.state.onResolve = () => { now = Date.parse(f.prepared.expiresAt); };
  const value = await run(f.prepared, f.response, f.prepared.preparationDigest, f.exec);
  assert.match(value.results[0].primary.reason, /expired/);
  assert.equal(f.state.reads, 0);
});
