import type { ReactNode } from 'react';

export function renderRichText(text: string): ReactNode {
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((paragraph, paragraphIndex) => (
    <p key={`${paragraphIndex}-${paragraph.slice(0, 12)}`}>{renderParagraph(paragraph)}</p>
  ));
}

function renderParagraph(paragraph: string): ReactNode[] {
  const lines = paragraph.split('\n');
  const rendered: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      rendered.push(<br key={`br-${lineIndex}`} />);
    }

    rendered.push(...renderInlineMarkdown(line, `${lineIndex}`));
  });

  return rendered;
}

export function renderInlineRichText(text: string, keyPrefix = 'inline'): ReactNode[] {
  return renderInlineMarkdown(text, keyPrefix);
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let keyIndex = 0;

  while (index < text.length) {
    if (text.startsWith('**', index)) {
      const closingIndex = text.indexOf('**', index + 2);

      if (closingIndex > index + 2) {
        const content = text.slice(index + 2, closingIndex);
        nodes.push(
          <strong key={`${keyPrefix}-strong-${keyIndex}`}>{renderInlineMarkdown(content, `${keyPrefix}-s${keyIndex}`)}</strong>,
        );
        index = closingIndex + 2;
        keyIndex += 1;
        continue;
      }
    }

    if (text[index] === '*' || text[index] === '_') {
      const delimiter = text[index];
      const closingIndex = text.indexOf(delimiter, index + 1);

      if (closingIndex > index + 1) {
        const content = text.slice(index + 1, closingIndex);
        nodes.push(<em key={`${keyPrefix}-em-${keyIndex}`}>{renderInlineMarkdown(content, `${keyPrefix}-e${keyIndex}`)}</em>);
        index = closingIndex + 1;
        keyIndex += 1;
        continue;
      }
    }

    const nextSpecialIndex = findNextSpecialIndex(text, index);
    const endIndex = nextSpecialIndex === -1 ? text.length : nextSpecialIndex;
    const content = text.slice(index, endIndex);

    if (content.length > 0) {
      nodes.push(<span key={`${keyPrefix}-text-${keyIndex}`}>{content}</span>);
      keyIndex += 1;
    }

    index = endIndex;
  }

  return nodes;
}

function findNextSpecialIndex(text: string, startIndex: number): number {
  for (let index = startIndex; index < text.length; index += 1) {
    if (text.startsWith('**', index) || text[index] === '*' || text[index] === '_') {
      return index;
    }
  }

  return -1;
}