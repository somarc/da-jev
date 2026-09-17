export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const rows = [...block.children];
  if (!rows.length) return;
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const body = document.createElement('tbody');
  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    [...row.children].forEach((cell) => {
      const target = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) target.scope = 'col';
      target.append(...cell.childNodes);
      tr.append(target);
    });
    (index === 0 ? head : body).append(tr);
  });
  table.append(head, body);
  block.replaceChildren(table);
}
