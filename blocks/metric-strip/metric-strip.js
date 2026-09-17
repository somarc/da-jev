export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const items = document.createElement('div');
  items.className = 'metric-strip-items';
  [...block.children].forEach((row) => {
    if (!row.textContent.trim()) return;
    row.className = 'metric-strip-item';
    [...row.children].forEach((cell, index) => {
      cell.classList.add(['metric-strip-value', 'metric-strip-label', 'metric-strip-note'][Math.min(index, 2)]);
      if (index === 0 && cell.textContent.trim().length > 9) cell.classList.add('compact-value');
    });
    items.append(row);
  });
  block.replaceChildren(items);
}
