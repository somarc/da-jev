import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

export default async function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const path = new URL(getMetadata('footer') || '/footer', window.location.href).pathname;
  const fragment = await loadFragment(path);
  if (!fragment) return;
  const inner = document.createElement('div');
  inner.className = 'footer-inner';
  [...fragment.children].filter((section) => section.textContent.trim()).forEach((section) => {
    section.querySelectorAll('.default-content-wrapper').forEach((wrapper) => wrapper.classList.add('lab-flow'));
    inner.append(section);
  });
  block.replaceChildren(inner);
}
