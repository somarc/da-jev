import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { element, labels } from '../../scripts/lab-ui.js';

export default async function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  const path = new URL(getMetadata('nav') || '/nav', window.location.href).pathname;
  const fragment = await loadFragment(path);
  if (!fragment) return;
  const sections = [...fragment.children].filter((section) => section.textContent.trim());
  const nav = element('nav', 'header-nav');
  nav.setAttribute('aria-label', labels.primaryNavigation);
  const brand = element('div', 'header-brand');
  const brandLink = sections[0]?.querySelector('a');
  if (brandLink) {
    brandLink.classList.remove('button', 'primary', 'secondary', 'accent');
    brand.append(brandLink);
  }
  const menu = element('details', 'header-menu');
  const summary = element('summary', '', labels.menu);
  const panel = element('div', 'header-panel');
  const list = sections[1]?.querySelector('ul');
  if (list) {
    list.classList.add('header-links');
    list.setAttribute('role', 'list');
    panel.append(list);
  }
  const tool = sections[2]?.querySelector('a');
  if (tool) {
    tool.classList.add('header-tool');
    panel.append(tool);
  }
  panel.querySelectorAll('a[href]').forEach((link) => {
    const url = new URL(link.href);
    if (url.origin === window.location.origin && url.pathname === window.location.pathname) {
      link.setAttribute('aria-current', 'page');
    }
  });
  menu.append(summary, panel);
  nav.append(brand, menu);
  block.replaceChildren(nav);
  const desktop = window.matchMedia('(min-width: 62em)');
  const update = () => { menu.open = desktop.matches; };
  desktop.addEventListener('change', update);
  update();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open && !desktop.matches) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!desktop.matches && menu.open && !block.contains(event.target)) menu.open = false;
  });
}
