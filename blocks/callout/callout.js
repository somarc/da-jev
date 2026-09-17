export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const body = document.createElement('div');
  body.className = 'callout-body lab-flow';
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => body.append(...cell.childNodes));
  });
  block.replaceChildren(body);
}
