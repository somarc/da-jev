#!/usr/bin/env node
/* eslint-env node */
/* Sequential, bounded CLI calls preserve preflight order and receipt attribution. */
/* eslint-disable no-restricted-syntax, no-await-in-loop, no-console */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat, readdir, readFile, realpath,
} from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const requireValue = (value, message) => { if (!value) throw new Error(message); };

export const ACTIONS = Object.freeze({
  inspect_site_model: ['site', 'model'],
  check_preview_status: ['preview', 'status'],
  explain_preview_drift: ['preview', 'explain'],
  check_page_freshness: ['site', 'freshness'],
});
export const PATHS = ['/index.html', '/how-it-works.html'];
export const QUESTION_IDS = ['o01', 'o02', 'o03', 'o04', 'o05'];
export const TTL = 15 * 60_000;
export function deliveryPath(sourcePath) {
  requireValue(PATHS.includes(sourcePath), 'Path is outside the lab allowlist');
  return sourcePath === '/index.html' ? '/' : sourcePath.replace(/\.html$/, '');
}
const sorted = (value) => {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
};
export const digest = (value) => `sha256:${createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex')}`;
function json(text) {
  try { return JSON.parse(text); } catch { throw new Error('Evidence is not a JSON document'); }
}

export function execute(file, argv) {
  const start = process.hrtime.bigint();
  return new Promise((resolve) => {
    execFile(
      file,
      argv,
      {
        encoding: 'utf8', timeout: 60000, maxBuffer: 1048576, shell: false,
      },
      (error, stdout = '', stderr = '') => {
        let exitCode = 0;
        if (error) exitCode = Number.isInteger(error.code) ? error.code : null;
        resolve({
          exitCode,
          boundedFailure: Boolean(error?.killed || error?.signal
            || (error && !Number.isInteger(error.code))),
          stdout,
          stderr,
          wallMs: Number(process.hrtime.bigint() - start) / 1e6,
        });
      },
    );
  });
}

export function journal(value, stderr = '', metadata = false) {
  if (metadata) return { state: 'not-applicable-metadata', receiptDurable: null };
  if (value?.qmdJournal) return value.qmdJournal;
  const lines = stderr.split(/\r?\n/);
  const recorded = lines.find((item) => /^QMD journal: wrote and indexed qmd:\/\/\S+$/.test(item));
  const pending = lines.find((item) => /^QMD journal: wrote qmd:\/\/\S+; verified indexing is queued/.test(item));
  const line = recorded || pending;
  if (line) {
    return {
      state: recorded ? 'recorded' : 'index-pending',
      receiptDurable: true,
      receiptUri: line.match(/qmd:\/\/\S+/)?.[0]?.replace(/;$/, '') || null,
    };
  }
  if (/^QMD journal degraded after the primary command /m.test(stderr)) {
    return { state: 'degraded', receiptDurable: /written\/failed|spooled locally at /.test(stderr) };
  }
  return { state: 'unknown', receiptDurable: null };
}

function prefix(prepared) {
  return [prepared.source.bin, '--org', 'somarc', '--repo', 'da-jev',
    '--branch', prepared.target.branch, '--env', 'prod', '--format', 'json', '--qmd'];
}

export async function sourceIdentity(root, exec, packageBinding, packageDigest) {
  const path = await realpath(root);
  const bin = await realpath(join(path, 'bin/da.js'));
  const child = relative(path, bin);
  requireValue(child && !child.startsWith('..') && !isAbsolute(child), 'CLI binary escapes source root');
  const pkg = json(await readFile(join(path, 'package.json'), 'utf8'));
  requireValue(pkg.name === '@somarc/da-cli', 'Wrong CLI package');
  if (packageBinding) {
    requireValue(digest(packageBinding) === packageDigest, 'Package binding differs from the reviewed digest');
    requireValue(packageBinding.package === pkg.name && packageBinding.version === pkg.version
      && typeof packageBinding.releaseGitHead === 'string'
      && /^[a-f0-9]{40}$/.test(packageBinding.releaseGitHead)
      && typeof packageBinding.tarballIntegrity === 'string'
      && packageBinding.tarballIntegrity.startsWith('sha512-'), 'Invalid package provenance');
    const integrityBytes = Buffer.from(packageBinding.tarballIntegrity.slice(7), 'base64');
    requireValue(integrityBytes.length === 64
      && `sha512-${integrityBytes.toString('base64')}` === packageBinding.tarballIntegrity, 'Invalid package integrity');
    const files = packageBinding.manifest;
    requireValue(Array.isArray(files) && files.length >= 2 && files.length <= 2048
      && files.some((file) => file.path === 'package.json')
      && files.some((file) => file.path === 'bin/da.js'), 'Incomplete package manifest');
    const seen = new Set();
    let inspectedBytes = 0;
    for (const file of files) {
      requireValue(typeof file.path === 'string' && /^[A-Za-z0-9_.@/-]+$/.test(file.path)
        && !isAbsolute(file.path) && !file.path.split('/').some((part) => ['', '.', '..'].includes(part))
        && !file.path.startsWith('node_modules/') && !seen.has(file.path)
        && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256), 'Invalid package manifest entry');
      seen.add(file.path);
      const name = join(path, file.path);
      const info = await lstat(name);
      requireValue(info.isFile() && await realpath(name) === name, 'Package file is not a regular contained file');
      inspectedBytes += info.size;
      requireValue(info.size <= 8 * 1024 * 1024 && inspectedBytes <= 64 * 1024 * 1024, 'Package inspection limit exceeded');
      const bytes = await readFile(name);
      requireValue(createHash('sha256').update(bytes).digest('hex') === file.sha256, 'Installed package bytes changed');
    }
    const pending = [''];
    const installed = [];
    let entries = 0;
    while (pending.length) {
      const directory = pending.pop();
      requireValue(directory.split('/').length <= 32, 'Package inspection depth exceeded');
      for (const entry of await readdir(join(path, directory), { withFileTypes: true })) {
        // eslint-disable-next-line no-continue
        if (!directory && entry.name === 'node_modules') continue; // Dependency bytes are outside this package binding.
        entries += 1;
        requireValue(entries <= 8192, 'Package inspection entry limit exceeded');
        const name = directory ? `${directory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) pending.push(name);
        else {
          requireValue(entry.isFile(), 'Package contains a non-regular entry');
          installed.push(name);
        }
      }
    }
    requireValue(digest(installed.sort()) === digest([...seen].sort()), 'Package manifest does not cover the complete first-party file set');
    return {
      root: path,
      bin,
      sha: packageBinding.releaseGitHead,
      cliVersion: pkg.version,
      kind: 'reviewed-npm-package',
      packageBinding,
      packageDigest,
    };
  }
  const top = await exec('git', ['-C', path, 'rev-parse', '--show-toplevel']);
  requireValue(
    top.exitCode === 0 && await realpath(top.stdout.trim()) === path,
    'CLI root is not its own Git checkout; use a reviewed package binding for an installed release',
  );
  const head = await exec('git', ['-C', path, 'rev-parse', 'HEAD']);
  const status = await exec('git', ['-C', path, 'status', '--porcelain=v1']);
  requireValue(head.exitCode === 0 && /^[a-f0-9]{40}$/.test(head.stdout.trim()), 'Missing source identity');
  requireValue(status.exitCode === 0 && !status.stdout.trim(), 'CLI checkout is not clean');
  return {
    root: path, bin, sha: head.stdout.trim(), cliVersion: pkg.version,
  };
}

async function da(prepared, args, exec) {
  const argv = [...prefix(prepared), ...args];
  const result = await exec(process.execPath, argv);
  let value = null;
  let parseError = null;
  try { value = JSON.parse(result.stdout); } catch { parseError = 'non-json-cli-output'; }
  return {
    ...result,
    value,
    parseError,
    argv,
    journal: journal(value, result.stderr, args.includes('--help')),
  };
}

async function descriptor(prepared, path, exec) {
  const result = await da(prepared, [...path, '--help'], exec);
  const { value } = result;
  requireValue(!result.boundedFailure && result.exitCode === 0 && value?.schemaVersion === 'da-cli.command-help.v1'
    && value.command?.executable === true
    && digest(value.command.path) === digest(path)
    && typeof value.descriptorDigest === 'string', 'Unexpected command descriptor');
  return value;
}

async function resolvePath(prepared, exec) {
  const result = await da(prepared, ['resolve', prepared.target.path], exec);
  const { value } = result;
  const r = value?.resolved;
  requireValue(
    !result.boundedFailure && result.exitCode === 0 && value?.ok === true && value.operation === 'resolve'
    && value.target === prepared.target.path
    && r?.owner === 'somarc' && r.repo === 'da-jev'
    && r.branch === prepared.target.branch && r.path === deliveryPath(prepared.target.path),
    'The CLI did not preserve the explicitly bound target',
  );
  return { value: r, wallMs: result.wallMs, journal: result.journal };
}

export async function prepare({
  cliRoot, branch, path, model, packageBinding, packageDigest,
}, exec = execute) {
  requireValue(PATHS.includes(path), 'Path is outside the lab allowlist');
  requireValue(typeof model === 'string' && /^jev-\d+\.\d+\.\d+$/.test(model), 'Pin an exact Jev model');
  requireValue(typeof branch === 'string' && !branch.startsWith('-')
    // Reject control characters before the native Git ref check.
    // eslint-disable-next-line no-control-regex
    && !/[\u0000-\u001f\u007f]/.test(branch), 'Invalid branch');
  const checked = await exec('git', ['check-ref-format', '--branch', branch]);
  requireValue(checked.exitCode === 0, 'Invalid branch');
  const prepared = {
    schemaVersion: 'da-jev.read-only-preparation.v1',
    mutationAuthorized: false,
    model,
    source: await sourceIdentity(cliRoot, exec, packageBinding, packageDigest),
    target: {
      org: 'somarc', repo: 'da-jev', environment: 'prod', branch, path,
    },
    descriptors: {},
  };
  for (const [id, command] of Object.entries({ resolve: ['resolve'], ...ACTIONS })) {
    prepared.descriptors[id] = await descriptor(prepared, command, exec);
  }
  prepared.resolution = await resolvePath(prepared, exec);
  prepared.preparedAt = new Date().toISOString();
  prepared.expiresAt = new Date(Date.parse(prepared.preparedAt) + TTL).toISOString();
  return { ...prepared, preparationDigest: digest(prepared) };
}

export function validatePreparation(prepared, expectedDigest, now = Date.now()) {
  const { preparationDigest, ...body } = prepared;
  requireValue(
    preparationDigest === expectedDigest && digest(body) === expectedDigest,
    'Preparation differs from the separately retained digest',
  );
  requireValue(prepared.mutationAuthorized === false && prepared.target?.org === 'somarc'
    && prepared.target.repo === 'da-jev' && prepared.target.environment === 'prod'
    && PATHS.includes(prepared.target.path), 'Invalid read-only target boundary');
  const start = Date.parse(prepared.preparedAt);
  const end = Date.parse(prepared.expiresAt);
  requireValue(end - start === TTL && now >= start && now < end, 'Preparation expired');
}

export function selectedAction(answer) {
  const ids = [...Object.keys(ACTIONS), 'none'];
  requireValue(answer?.type === 'choice' && ids.includes(answer.choice), 'Unsupported model choice');
  const p = answer.probabilities;
  requireValue(
    p && digest(Object.keys(p).sort()) === digest(ids.sort())
    && Object.values(p).every((v) => typeof v === 'number' && v >= 0 && v <= 1)
    && Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) < 0.03,
    'Invalid model distribution',
  );
  return answer.choice;
}

export function assess(id, value, prepared, exitCode) {
  if (value?.ok === false) {
    return { contractValid: Array.isArray(value.errors), observed: false, healthy: false };
  }
  const { path, branch } = prepared.target;
  const r = prepared.resolution.value;
  if (id === 'inspect_site_model') {
    const valid = exitCode === 0 && value?.schemaVersion === 'da-cli.site-model.v2'
      && value.site?.org === 'somarc' && value.site?.repo === 'da-jev' && value.site?.branch === branch
      && value.delivery?.previewHost === new URL(r.previewUrl).origin
      && value.sources?.expectedDa === 'https://content.da.live/somarc/da-jev/'
      && Array.isArray(value.routes) && value.routes.length === 0;
    return {
      contractValid: valid,
      observed: valid,
      healthy: valid && value.sources?.effectiveContent?.state === 'configured',
    };
  }
  if (id === 'check_preview_status') {
    const valid = exitCode === 0 && value?.path === path && value.url === r.previewUrl
      && ['fresh', 'stale', 'unknown'].includes(value.freshness)
      && ['string', 'number'].includes(typeof value.previewStatus);
    return {
      contractValid: valid,
      observed: valid,
      healthy: valid && value.previewStatus === 200 && value.freshness === 'fresh',
    };
  }
  if (id === 'explain_preview_drift') {
    const plain = new URL(path.replace(/\.html$/, '.plain.html'), r.previewUrl).href;
    const valid = value?.path === path && value.plainUrl === plain
      && typeof value.fatal === 'boolean' && typeof value.metadata?.ok === 'boolean'
      && ['expected', 'problematic', 'trimmed'].every(
        (key) => Array.isArray(value.classification?.[key]),
      );
    return {
      contractValid: valid,
      observed: valid,
      healthy: valid && exitCode === 0 && !value.fatal && value.metadata.ok,
    };
  }
  const row = Array.isArray(value) && value.length === 1 ? value[0] : null;
  const verdicts = ['fresh', 'preview-stale', 'live-stale', 'preview-only', 'preview-missing',
    'source-missing', 'probe-failed', 'unknown'];
  const valid = exitCode === 0 && row?.path === path && row.previewUrl === r.previewUrl
    && row.liveUrl === r.liveUrl && Number.isInteger(row.sourceStatus)
    && ['fresh', 'stale', 'unknown'].includes(row.previewFreshness)
    && verdicts.includes(row.verdict);
  return {
    contractValid: valid,
    observed: valid,
    healthy: valid && ['fresh', 'preview-only', 'live-stale'].includes(row.verdict),
  };
}

export async function run(prepared, response, expectedDigest, exec = execute) {
  validatePreparation(prepared, expectedDigest);
  requireValue(
    response.model === prepared.model
    && digest(Object.keys(response.answers || {}).sort()) === digest(QUESTION_IDS),
    'Response model or question identities do not match this bounded protocol',
  );
  const selections = QUESTION_IDS.map((id) => [id, selectedAction(response.answers[id])]);
  const { root, packageBinding, packageDigest } = prepared.source;
  const identity = () => sourceIdentity(root, exec, packageBinding, packageDigest);
  const source = await identity();
  requireValue(digest(source) === digest(prepared.source), 'CLI source changed since preparation');
  const results = [];
  for (const [questionId, id] of selections) {
    try {
      validatePreparation(prepared, expectedDigest);
      if (id === 'none') {
        results.push({
          questionId, actionId: id, primary: { attempted: false, reason: 'no-offered-action' }, journal: { state: 'not-applicable-no-command' },
        });
        // No-match cases bypass the operational preflight and dispatch entirely.
        // eslint-disable-next-line no-continue
        continue;
      }
      const current = await descriptor(prepared, ACTIONS[id], exec);
      requireValue(current.descriptorDigest === prepared.descriptors[id].descriptorDigest, 'Descriptor drift');
      const resolved = await resolvePath(prepared, exec);
      requireValue(digest(resolved.value) === digest(prepared.resolution.value), 'Target resolution drift');
      const args = [...ACTIONS[id]];
      if (id === 'inspect_site_model') args.push('--no-routes');
      else {
        if (id === 'check_page_freshness') args.push('--boundary', 'preview');
        args.push('--', prepared.target.path);
      }
      const beforeDispatch = await identity();
      requireValue(digest(beforeDispatch) === digest(prepared.source), 'Source drift before dispatch');
      validatePreparation(prepared, expectedDigest); // Slow preflight work cannot extend the lease.
      const result = await da(prepared, args, exec);
      const preflightRefused = result.value?.errors?.some?.((error) => (
        typeof error?.code === 'string' && error.code.startsWith('qmd-')
      )) || false;
      results.push({
        questionId,
        actionId: id,
        mutationAuthorized: false,
        primary: {
          attempted: !preflightRefused,
          exitCode: result.exitCode,
          boundedFailure: result.boundedFailure,
          parseError: result.parseError,
          assessment: result.parseError || result.boundedFailure || preflightRefused
            ? { contractValid: false, observed: false, healthy: false }
            : assess(id, result.value, prepared, result.exitCode),
          output: result.value,
          stdout: result.stdout,
        },
        journal: result.journal,
        metrics: { cliProcessWallMs: result.wallMs, resolutionWallMs: resolved.wallMs },
        argv: result.argv,
        stderr: result.stderr,
      });
      if (result.parseError || result.boundedFailure || preflightRefused) break;
    // Neither next[] nor any model-generated text is interpreted as a command.
    } catch (error) {
      results.push({
        questionId,
        actionId: id,
        mutationAuthorized: false,
        primary: { attempted: null, observed: false, reason: error.message },
        journal: { state: 'unknown' },
      });
      break; // Preserve partial evidence. Never replay an earlier primary operation.
    }
  }
  let integrity;
  try {
    const after = await identity();
    integrity = { stable: digest(after) === digest(prepared.source), afterSha: after.sha };
  } catch (error) {
    integrity = { stable: false, reason: error.message };
  }
  return {
    schemaVersion: 'da-jev.read-only-run.v1',
    mutationAuthorized: false,
    preparedDigest: expectedDigest,
    sourceSha: source.sha,
    target: prepared.target,
    integrity,
    allResultsRecorded: results.length === QUESTION_IDS.length,
    results,
  };
}

function options(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    requireValue(args[i]?.startsWith('--') && args[i + 1], 'Expected named option/value pairs');
    result[args[i].slice(2)] = args[i + 1];
  }
  return result;
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const opts = options(args);
  let result;
  if (mode === 'prepare') {
    result = await prepare({
      cliRoot: opts['cli-root'],
      branch: opts.branch,
      path: opts.path,
      model: opts.model,
      packageBinding: opts['package-binding'] ? json(await readFile(opts['package-binding'], 'utf8')) : undefined,
      packageDigest: opts['package-digest'],
    });
  } else {
    requireValue(mode === 'run', 'Expected prepare or run');
    result = await run(
      json(await readFile(opts.prepared, 'utf8')),
      json(await readFile(opts.response, 'utf8')),
      opts.digest,
    );
  }
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
