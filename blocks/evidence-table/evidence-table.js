export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const rows = [...block.children];
  if (!rows.length) return;
  const table = document.createElement('table');
  let previous = block.closest('.evidence-table-wrapper')?.previousElementSibling;
  let heading;
  while (previous && !heading) {
    if (previous.classList.contains('default-content-wrapper')) {
      heading = [...previous.querySelectorAll('h2, h3')].at(-1);
    }
    previous = previous.previousElementSibling;
  }
  const caption = document.createElement('caption');
  caption.className = 'visually-hidden';
  caption.textContent = heading?.textContent.trim() || 'Evidence table';
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
  table.append(caption, head, body);
  block.replaceChildren(table);
}
