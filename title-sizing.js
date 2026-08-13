export function titleSizeFor(title) {
  const length = Array.from(String(title ?? '').trim()).length;
  if (length > 110) return 'compact';
  if (length > 60) return 'medium';
  return 'large';
}

export function pdfTitleFontSize(title) {
  return { large: 28, medium: 24, compact: 21 }[titleSizeFor(title)];
}
