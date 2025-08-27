import { fitLayout } from './layout-engine.js';
import { createMeasure } from './text-wrapper.js';

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderSVG(options) {
  const {
    width, height, header, subheader, headerWeight, subWeight, fontFamily,
    imageHref, patternChoice, imageRounded, logoHref, logoPos, logoSize,
    tagText, tagPos, tagSize, tagTextColor, tagShapeColor, textColor, bgColor, paddingSize
  } = options;

  const layout = fitLayout({
    W: width,
    H: height,
    header,
    subheader,
    fontFamily,
    headerWeight,
    subWeight,
    imageHref,
    patternChoice,
    imageRounded,
    logoHref,
    logoPos,
    logoSize,
    tagText,
    tagPos,
    tagSize,
    tagTextColor,
    tagShapeColor,
    textColor,
    bgColor,
    paddingSize
  });

  const svgParts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(layout.bgColor)}"/>`
  ];

  // Add image if present
  if (layout.imgBox && layout.imgBox.w > 0 && layout.imgBox.h > 0 && imageHref) {
    const roundedAttrs = layout.imageRounded ? ` rx="12" ry="12"` : '';
    svgParts.push(
      `<image href="${escapeXml(imageHref)}" x="${layout.imgBox.x}" y="${layout.imgBox.y}" width="${layout.imgBox.w}" height="${layout.imgBox.h}" preserveAspectRatio="xMidYMid slice"${roundedAttrs}/>`
    );
  }

  // Add logo if present
  if (layout.logoBox && logoHref) {
    svgParts.push(
      `<image href="${escapeXml(logoHref)}" x="${layout.logoBox.x}" y="${layout.logoBox.y}" width="${layout.logoBox.w}" height="${layout.logoBox.h}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  // Add tag if present
  if (layout.tagBox && layout.tagText && layout.tagText.trim()) {
    const tagPaddingX = Math.max(12, Math.floor(layout.tagBox.h * 0.4));
    const tagPaddingY = Math.max(6, Math.floor(layout.tagBox.h * 0.2));
    const tagRadius = Math.floor(layout.tagBox.h * 0.5); // Very round - half the height
    const tagTextSize = Math.max(10, Math.floor(layout.tagBox.h * 0.6));
    
    // Measure text width to wrap container tightly
    const tagMeasure = createMeasure(fontFamily, 500);
    const tagTextWidth = tagMeasure(tagTextSize, layout.tagText.trim());
    const tagContainerWidth = tagTextWidth + (tagPaddingX * 2);
    
    // Background rounded rectangle - wraps text tightly
    svgParts.push(
      `<rect x="${layout.tagBox.x}" y="${layout.tagBox.y}" width="${tagContainerWidth}" height="${layout.tagBox.h}" rx="${tagRadius}" ry="${tagRadius}" fill="${escapeXml(layout.tagShapeColor)}"/>`
    );
    
    // Tag text - centered in container
    const tagY = layout.tagBox.y + layout.tagBox.h * 0.5 + tagTextSize * 0.35;
    svgParts.push(
      `<text x="${layout.tagBox.x + tagPaddingX}" y="${tagY}" font-family="${fontFamily}" font-size="${tagTextSize}" font-weight="500" fill="${escapeXml(layout.tagTextColor)}">${escapeXml(layout.tagText.trim())}</text>`
    );
  }

  const textColorEscaped = escapeXml(textColor);

  // Add header text lines
  layout.headLines.forEach((line, index) => {
    const y = layout.headBox.y + (index + 1) * layout.headerSize * 1.20 - layout.headerSize * 0.20;
    svgParts.push(
      `<text x="${layout.headBox.x}" y="${y}" font-family="${fontFamily}" font-size="${layout.headerSize}" font-weight="${headerWeight}" fill="${textColorEscaped}">${escapeXml(line)}</text>`
    );
  });

  // Add subheader text lines
  layout.subLines.forEach((line, index) => {
    const y = layout.subBox.y + (index + 1) * layout.subSize * 1.44 - layout.subSize * 0.44;
    svgParts.push(
      `<text x="${layout.subBox.x}" y="${y}" font-family="${fontFamily}" font-size="${layout.subSize}" font-weight="${subWeight}" fill="${textColorEscaped}">${escapeXml(line)}</text>`
    );
  });

  svgParts.push(`</svg>`);

  return {
    svg: svgParts.join('\n'),
    meta: layout
  };
}