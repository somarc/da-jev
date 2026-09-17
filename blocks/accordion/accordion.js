export default function decorate(block) {
  if (block.dataset.decorated) return;
  block.dataset.decorated = 'true';
  [...block.children].forEach((row) => {
    const [question, ...answers] = [...row.children];
    if (!question?.textContent.trim() || !answers.length) return;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const paragraph = question.children.length === 1 && question.firstElementChild.tagName === 'P'
      ? question.firstElementChild : question;
    summary.append(...paragraph.childNodes);
    const body = document.createElement('div');
    body.className = 'accordion-answer lab-flow';
    answers.forEach((answer) => body.append(...answer.childNodes));
    details.append(summary, body);
    row.replaceWith(details);
  });
}
