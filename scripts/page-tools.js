import { getMetadata } from './aem.js';
import { element, labels } from './lab-ui.js';

export default function enhanceReading(main) {
  if (!['article', 'experiment'].includes(getMetadata('template'))
    || main.querySelector(':scope > .reading-tools')) return;
  const headings = [...main.querySelectorAll('.default-content-wrapper > h2[id]')];
  if (headings.length < 2) return;
  const tools = element('div', 'reading-tools');
  const details = element('details');
  const list = element('ol');
  headings.forEach((heading) => {
    const item = element('li');
    const anchor = element('a', '', heading.textContent);
    anchor.href = `#${heading.id}`;
    item.append(anchor); list.append(item);
  });
  details.append(element('summary', '', labels.onThisPage), list);
  tools.append(details);
  const first = main.querySelector(':scope > .section');
  if (first) first.after(tools);
}
