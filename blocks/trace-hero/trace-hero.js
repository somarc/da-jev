export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const row = block.firstElementChild;
  if (!row) return;
  row.classList.add('trace-hero-layout');
  const [copy, ribbon, ...extra] = [...row.children];
  copy?.classList.add('trace-hero-copy', 'lab-flow');
  const eyebrow = copy?.querySelector('h1, h2')?.previousElementSibling;
  if (eyebrow?.tagName === 'P') eyebrow.classList.add('trace-hero-eyebrow');
  ribbon?.classList.add('trace-hero-ribbon');
  extra.forEach((cell) => cell.classList.add('lab-flow'));
  const list = ribbon?.querySelector('ol');
  if (!list?.children.length) return;
  block.classList.add('has-trace');
  list.setAttribute('role', 'list');
  [...list.children].forEach((item, index) => {
    const number = document.createElement('span');
    number.className = 'trace-hero-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1).padStart(2, '0');
    item.prepend(number);
  });
}
