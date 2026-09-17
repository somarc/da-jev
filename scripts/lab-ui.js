// English interface labels are implementation text; editorial content stays in DA.
export const labels = Object.freeze({
  menu: 'Menu',
  home: 'Home',
  primaryNavigation: 'Primary navigation',
  onThisPage: 'On this page',
  searchExperiments: 'Search experiments',
  filterCategory: 'Category',
  allCategories: 'All categories',
  chooseCase: 'Choose a recorded case',
  recorded: 'Recorded evaluation — no live model call',
  loading: 'Loading recorded evidence…',
  unavailable: 'This evidence could not be loaded. The authored source link is retained below.',
  empty: 'No recorded cases are available in this source.',
  input: 'Recorded input',
  decision: 'Jev selection',
  expected: 'Frozen reference label',
  observation: 'Observed result',
  confidence: 'Jev confidence',
  concentration: 'Distribution concentration, not permission or workflow correctness.',
  distribution: 'Option probabilities',
  allOptions: 'Inspect the full distribution',
  source: 'Source reference',
  raw: 'Inspect the record',
  measure: 'Compare a measured field',
  differentWorkloads: 'Different recorded workloads. Request counts and measurement boundaries are shown for each entry; these bars are not a speed ranking.',
  matched: 'Matches the frozen label',
  mismatched: 'Does not match the frozen label',
  unassessed: 'Not assessed against a frozen label',
  distributionUnavailable: 'No valid option distribution is available in this record.',
  lexical: 'Lexical comparator',
  notMeasured: 'Not measured',
});

let sequence = 0;

export function uniqueId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function sourceLink(block) {
  return block.firstElementChild?.firstElementChild?.querySelector('a[href]') || null;
}

export function retainSource(block, className) {
  const source = element('div', `${className} lab-flow`);
  source.append(...block.childNodes);
  return source;
}

export function finiteNumber(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function outcomeLabel(status) {
  if (status === 'matched') return labels.matched;
  if (status === 'mismatched') return labels.mismatched;
  return labels.unassessed;
}

export function safeReference(value) {
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export async function loadPublicRows(href) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/data/')
    || !url.pathname.endsWith('.json') || url.search || url.hash || url.username || url.password) {
    throw new Error('Expected a same-origin public data file without credentials or query fields');
  }
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
    throw new Error('Public JSON data is unavailable');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      size += chunk.value.byteLength;
      if (size > 1048576) {
        // eslint-disable-next-line no-await-in-loop
        await reader.cancel();
        throw new Error('Public data exceeds the one MiB limit');
      }
      text += decoder.decode(chunk.value, { stream: true });
      // Stream reads are deliberately sequential and bounded.
      // eslint-disable-next-line no-await-in-loop
      chunk = await reader.read();
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const value = JSON.parse(text);
  if (!Array.isArray(value.data) || value.data.length > 1000
    || !value.data.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    throw new Error('Expected a bounded single-sheet record array');
  }
  if (!Number.isSafeInteger(value.total) || value.total !== value.data.length
    || !Number.isSafeInteger(value.limit) || value.limit < value.data.length
    || value.offset !== 0 || value[':type'] !== 'sheet') {
    throw new Error('A partial data page cannot stand in for the complete record set');
  }
  if (!value.data.every((row) => typeof row.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(row.id))
    || new Set(value.data.map((row) => row.id)).size !== value.data.length) {
    throw new Error('Expected unique safe record identities');
  }
  return value.data;
}
