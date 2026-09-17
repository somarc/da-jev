import { element, labels, uniqueId } from '../../scripts/lab-ui.js';

export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const records = [];
  const list = element('div', 'experiment-list-items');
  [...block.children].forEach((row) => {
    if (!row.textContent.trim()) return;
    const cells = [...row.children];
    const category = (cells[0]?.querySelector('p') || cells[0])?.textContent.trim() || '';
    const item = element('article', 'experiment-list-item');
    cells.forEach((cell, index) => {
      cell.classList.add(['experiment-list-category', 'experiment-list-copy', 'experiment-list-scope'][Math.min(index, 2)], 'lab-flow');
      item.append(cell);
    });
    records.push({ item, category, text: item.textContent.toLocaleLowerCase('en') });
    list.append(item);
  });
  block.replaceChildren(list);
  if (!records.length) return;
  const controls = element('div', 'experiment-list-controls');
  const searchLabel = element('label', 'experiment-list-label');
  const search = element('input');
  search.type = 'search';
  search.id = uniqueId('experiment-search');
  searchLabel.htmlFor = search.id;
  searchLabel.append(element('span', '', labels.searchExperiments), search);
  const filterLabel = element('label', 'experiment-list-label');
  const filter = element('select');
  filter.id = uniqueId('experiment-category');
  filterLabel.htmlFor = filter.id;
  const all = element('option', '', labels.allCategories);
  all.value = '';
  filter.append(all);
  [...new Set(records.map((record) => record.category).filter(Boolean))].forEach((category) => {
    const option = element('option', '', category);
    option.value = category;
    filter.append(option);
  });
  filterLabel.append(element('span', '', labels.filterCategory), filter);
  const status = element('p', 'experiment-list-status');
  status.setAttribute('role', 'status');
  const update = () => {
    const query = search.value.trim().toLocaleLowerCase('en');
    let count = 0;
    records.forEach((record) => {
      const show = (!filter.value || record.category === filter.value)
        && record.text.includes(query);
      record.item.hidden = !show;
      if (show) count += 1;
    });
    status.textContent = `${count} of ${records.length} experiments`;
  };
  search.addEventListener('input', update);
  filter.addEventListener('change', update);
  controls.append(searchLabel, filterLabel, status);
  block.prepend(controls);
  update();
}
