import {
  element, finiteNumber, labels, loadPublicRows, outcomeLabel, retainSource,
  safeReference, sourceLink, uniqueId,
} from '../../scripts/lab-ui.js';

function optionsFor(record) {
  try {
    const options = JSON.parse(record.choices);
    if (!Array.isArray(options) || options.length > 255 || !options.every((option) => (
      typeof option.id === 'string' && option.id && typeof option.label === 'string'
      && typeof option.probability === 'number' && option.probability >= 0 && option.probability <= 1
    )) || new Set(options.map((option) => option.id)).size !== options.length) return [];
    return options.sort((a, b) => b.probability - a.probability);
  } catch {
    return [];
  }
}

function probabilityList(options, selected) {
  const list = element('ol', 'case-explorer-probabilities');
  list.setAttribute('role', 'list');
  options.forEach((option) => {
    const item = element('li', option.id === selected ? 'is-selected' : '');
    const label = element('span', 'case-explorer-option', option.label);
    const value = element('span', 'case-explorer-probability', `${(option.probability * 100).toFixed(1)}%`);
    const track = element('span', 'case-explorer-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = element('span', 'case-explorer-fill');
    fill.style.inlineSize = `${option.probability * 100}%`;
    fill.hidden = option.probability === 0;
    track.append(fill);
    item.append(label, value, track);
    list.append(item);
  });
  return list;
}

function renderRecord(record) {
  const fragment = document.createDocumentFragment();
  const status = element('p', 'case-explorer-verdict', outcomeLabel(record.status));
  const trace = element('div', 'case-explorer-trace');
  const input = element('section', 'case-explorer-input lab-flow');
  input.append(element('h3', '', labels.input), element('blockquote', '', record.question));
  const judgment = element('section', 'case-explorer-judgment lab-flow');
  judgment.append(element('h3', '', labels.decision), element('p', 'case-explorer-selection', record.selected));
  judgment.append(element('p', 'case-explorer-reference', `${labels.expected}: ${record.expected}`));
  const confidence = finiteNumber(record.confidence);
  if (confidence !== null && confidence >= 0 && confidence <= 1) {
    judgment.append(element('p', '', `${labels.confidence}: ${confidence.toFixed(2)}`));
    judgment.append(element('p', 'case-explorer-note', labels.concentration));
  }
  if (typeof record.baseline === 'string') {
    judgment.append(element('p', 'case-explorer-note', `${labels.lexical}: ${record.baseline}`));
  }
  const observation = element('section', 'case-explorer-observation lab-flow');
  observation.append(element('h3', '', labels.observation));
  if (typeof record.observation === 'string') observation.append(element('p', '', record.observation));
  if (typeof record.command === 'string' && record.command) {
    const pre = element('pre');
    pre.append(element('code', '', record.command));
    observation.append(pre);
  }
  const cliWall = finiteNumber(record.cliWallMs);
  if (cliWall !== null) {
    observation.append(element('p', 'case-explorer-note', `CLI process: ${cliWall.toFixed(1)} ms, including QMD journaling.`));
  }
  trace.append(input, judgment, observation);
  fragment.append(status, trace);
  const options = optionsFor(record);
  const distribution = element('section', 'case-explorer-distribution');
  distribution.append(element('h3', '', labels.distribution));
  if (options.length) {
    distribution.append(probabilityList(options.slice(0, 6), record.selected));
    if (options.length > 6) {
      const more = element('details', 'case-explorer-more');
      more.append(element('summary', '', `${labels.allOptions} (${options.length})`), probabilityList(options, record.selected));
      distribution.append(more);
    }
  } else distribution.append(element('p', 'case-explorer-note', labels.distributionUnavailable));
  fragment.append(distribution);
  if (typeof record.notes === 'string') fragment.append(element('p', 'case-explorer-note', record.notes));
  const provenance = element('p', 'case-explorer-provenance');
  provenance.textContent = [record.model, record.observedAt, record.requestId].filter((value) => typeof value === 'string').join(' · ');
  fragment.append(provenance);
  const reference = typeof record.sourceUrl === 'string' ? safeReference(record.sourceUrl) : null;
  if (reference) {
    const anchor = element('a', 'case-explorer-reference-link', labels.source);
    anchor.href = reference.href;
    if (reference.origin !== window.location.origin) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
    fragment.append(anchor);
  }
  const raw = element('details', 'case-explorer-raw');
  const pre = element('pre');
  pre.append(element('code', '', JSON.stringify(record, null, 2)));
  raw.append(element('summary', '', labels.raw), pre);
  fragment.append(raw);
  return fragment;
}

export default async function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const link = sourceLink(block);
  if (!link) return;
  const { href } = link;
  const source = retainSource(block, 'case-explorer-source');
  const status = element('p', 'case-explorer-load-state', labels.loading);
  status.setAttribute('role', 'status');
  block.append(status, source);
  try {
    const rows = await loadPublicRows(href);
    if (!rows.length) { status.textContent = labels.empty; return; }
    if (!rows.every((record) => typeof record.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(record.id)
      && typeof record.question === 'string' && typeof record.selected === 'string'
      && typeof record.expected === 'string'
      && (record.status !== 'matched' || record.selected === record.expected)
      && (record.status !== 'mismatched' || record.selected !== record.expected))
      || new Set(rows.map((row) => row.id)).size !== rows.length) {
      throw new Error('Invalid or duplicate record identities');
    }
    const header = element('div', 'case-explorer-header');
    const label = element('label', 'case-explorer-picker');
    const select = element('select');
    select.id = uniqueId('recorded-case');
    label.htmlFor = select.id;
    rows.forEach((record) => {
      const option = element('option', '', `${record.id.toUpperCase()} — ${record.question.slice(0, 90)}`);
      option.value = record.id;
      select.append(option);
    });
    const requested = new URLSearchParams(window.location.search).get('case');
    if (rows.some((row) => row.id === requested)) select.value = requested;
    label.append(element('span', '', labels.chooseCase), select);
    header.append(element('p', 'case-explorer-replay', labels.recorded), label);
    const body = element('div', 'case-explorer-body');
    const render = () => {
      const record = rows.find((row) => row.id === select.value);
      body.replaceChildren(renderRecord(record));
      status.textContent = `${record.id.toUpperCase()} · ${outcomeLabel(record.status)}`;
    };
    select.addEventListener('change', () => {
      render();
      const url = new URL(window.location.href);
      url.searchParams.set('case', select.value);
      window.history.replaceState(null, '', url);
    });
    status.className = 'visually-hidden';
    block.replaceChildren(header, status, body, source);
    render();
  } catch {
    status.textContent = labels.unavailable;
    block.classList.add('data-unavailable');
  }
}
