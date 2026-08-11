export const A4_CONTENT_HEIGHT_MM = 262;

export function countPdfPages(blockHeightsMm, pageHeightMm = A4_CONTENT_HEIGHT_MM, coverPages = 1) {
  if (!Number.isFinite(pageHeightMm) || pageHeightMm <= 0) {
    throw new RangeError('Page height must be a positive number.');
  }

  let pages = Math.max(0, Math.trunc(coverPages));
  let usedHeight = 0;

  for (const rawHeight of blockHeightsMm) {
    const height = Number(rawHeight);
    if (!Number.isFinite(height) || height <= 0) continue;

    if (height <= pageHeightMm) {
      if (usedHeight === 0 || usedHeight + height > pageHeightMm) {
        pages += 1;
        usedHeight = height;
      } else {
        usedHeight += height;
      }
      continue;
    }

    if (usedHeight > 0) usedHeight = 0;
    pages += Math.ceil(height / pageHeightMm);
    usedHeight = height % pageHeightMm;
  }

  return pages;
}
