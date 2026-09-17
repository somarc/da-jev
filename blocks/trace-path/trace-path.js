export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const list = document.createElement('ol');
  list.className = 'trace-path-list';
  list.setAttribute('role', 'list');
  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('img')) return;
    const item = document.createElement('li');
    item.className = 'trace-path-step';
    [...row.children].forEach((cell, index) => {
      cell.classList.add(index === 0 ? 'trace-path-stage' : 'trace-path-detail', 'lab-flow');
      item.append(cell);
    });
    list.append(item);
  });
  block.replaceChildren(list);
}
