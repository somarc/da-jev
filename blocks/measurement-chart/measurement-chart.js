import {
  element, finiteNumber, labels, loadPublicRows, retainSource, safeReference, sourceLink, uniqueId,
} from '../../scripts/lab-ui.js';

const fields = [
  { id: 'serverUpstreamTimeMs', label: 'API upstream time (ms)', format: (value) => `${value.toLocaleString('en-US')} ms` },
  { id: 'inputTokens', label: 'Input tokens', format: (value) => value.toLocaleString('en-US') },
  { id: 'outputTokens', label: 'Output tokens', format: (value) => value.toLocaleString('en-US') },
  { id: 'inputCostUsd', label: 'Estimated input cost (USD)', format: (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 5 }).format(value) },
];

export default async function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const link = sourceLink(block);
  if (!link) return;
  const { href } = link;
  const source = retainSource(block, 'measurement-chart-source');
  const status = element('p', 'measurement-chart-status', labels.loading);
  status.setAttribute('role', 'status');
  block.append(status, source);
  try {
    const rows = await loadPublicRows(href);
    if (!rows.length) { status.textContent = labels.empty; return; }
    if (!rows.every((row) => typeof row.id === 'string' && typeof row.label === 'string'
      && typeof row.model === 'string'
      && [row.questionCount, row.requestCount].every((value) => (
        Number.isSafeInteger(finiteNumber(value)) && finiteNumber(value) >= 0
      )) && typeof row.scope === 'string'
      && row.scope.trim())) throw new Error('Invalid measurement record');
    const label = element('label', 'measurement-chart-picker');
    const select = element('select');
    select.id = uniqueId('measurement-field');
    label.htmlFor = select.id;
    fields.forEach((field) => { const option = element('option', '', field.label); option.value = field.id; select.append(option); });
    label.append(element('span', '', labels.measure), select);
    const chart = element('div', 'measurement-chart-bars');
    const render = () => {
      const field = fields.find((candidate) => candidate.id === select.value);
      const values = rows.map((row) => finiteNumber(row[field.id]));
      const largest = Math.max(...values.filter((value) => value !== null && value >= 0));
      const max = largest > 0 ? largest : 1;
      chart.replaceChildren();
      rows.forEach((row, index) => {
        const item = element('section', 'measurement-chart-item');
        const heading = element('h3', '', row.label || row.id);
        const reference = typeof row.referenceUrl === 'string' ? safeReference(row.referenceUrl) : null;
        if (reference) { const anchor = element('a', '', heading.textContent); anchor.href = reference.href; heading.replaceChildren(anchor); }
        const value = values[index];
        item.append(heading, element('p', 'measurement-chart-value', value !== null && value >= 0 ? field.format(value) : labels.notMeasured));
        if (value !== null && value >= 0) {
          const track = element('div', 'measurement-chart-track');
          track.setAttribute('aria-hidden', 'true');
          const fill = element('div', 'measurement-chart-fill');
          fill.style.inlineSize = `${(value / max) * 100}%`;
          fill.hidden = value === 0;
          track.append(fill); item.append(track);
        }
        const requests = `${row.requestCount} ${Number(row.requestCount) === 1 ? 'request' : 'requests'}`;
        item.append(element('p', 'measurement-chart-context', `${row.questionCount} questions · ${requests} · ${row.model}`));
        if (typeof row.scope === 'string') item.append(element('p', 'measurement-chart-scope', row.scope));
        chart.append(item);
      });
      status.textContent = `${field.label} · ${rows.length} recorded batches`;
    };
    select.addEventListener('change', render);
    status.className = 'visually-hidden';
    block.replaceChildren(label, element('p', 'measurement-chart-caveat', labels.differentWorkloads), status, chart, source);
    render();
  } catch {
    status.textContent = labels.unavailable;
    block.classList.add('data-unavailable');
  }
}
