import { createMeasure, wrapNoBreak } from './text-wrapper.js';

const clamp = (min, value, max) => Math.max(min, Math.min(value, max));
const round8 = value => Math.round(value / 8) * 8;

// Random layout configurations
const RANDOM_LAYOUTS = [
  {
    name: 'header-full-image-left',
    header: { position: 'top', width: 1.0 },
    image: { position: 'left', width: 0.3, height: 0.6 },
    tag: { position: 'bottom-right' },
    logo: { position: 'top-left' }
  },
  {
    name: 'image-top-header-center',
    header: { position: 'center', width: 0.7 },
    image: { position: 'top', width: 1.0, height: 0.4 },
    tag: { position: 'top-right' },
    logo: { position: 'bottom-center' }
  },
  {
    name: 'split-vertical',
    header: { position: 'left', width: 0.5 },
    image: { position: 'right', width: 0.5, height: 1.0 },
    tag: { position: 'left-bottom' },
    logo: { position: 'left-top' }
  },
  {
    name: 'corner-design',
    header: { position: 'bottom-left', width: 0.6 },
    image: { position: 'top-right', width: 0.4, height: 0.5 },
    tag: { position: 'top-left' },
    logo: { position: 'bottom-right' }
  },
  {
    name: 'magazine-style',
    header: { position: 'center-top', width: 0.8 },
    image: { position: 'bottom-left', width: 0.45, height: 0.5 },
    tag: { position: 'top-right' },
    logo: { position: 'center-bottom' }
  },
  {
    name: 'asymmetric',
    header: { position: 'right', width: 0.4 },
    image: { position: 'left-full', width: 0.6, height: 1.0 },
    tag: { position: 'right-top' },
    logo: { position: 'right-bottom' }
  }
];

function getRandomLayout() {
  return RANDOM_LAYOUTS[Math.floor(Math.random() * RANDOM_LAYOUTS.length)];
}

function choosePattern(auto, aspect, hasImage) {
  if (!hasImage) return 'none';
  if (auto !== 'auto') return auto;
  return aspect >= 1.3 ? 'side' : 'top';
}

export function fitLayout({
  W, H, header, subheader, fontFamily, headerWeight, subWeight,
  imageHref, patternChoice, imageRounded, logoHref, logoPos, logoSize, 
  tagText, tagPos, tagSize, tagTextColor, tagShapeColor, textColor, bgColor, paddingSize
}) {
  const minDim = Math.min(W, H);
  const measureHeader = createMeasure(fontFamily, headerWeight);
  const measureSub = createMeasure(fontFamily, subWeight);

  let padding;
  if (paddingSize === 'auto') {
    padding = round8(clamp(24, minDim * 0.10, 120));
  } else {
    const paddingMap = {
      s: Math.max(16, Math.floor(minDim * 0.06)),
      m: Math.max(32, Math.floor(minDim * 0.10)), 
      l: Math.max(64, Math.floor(minDim * 0.16))
    };
    padding = round8(paddingMap[paddingSize] || paddingMap.m);
  }
  const ratio = 1.6;
  const lineHeightHeader = 1.20;
  const lineHeightSub = 1.44;
  const gapK = 0.40;

  const headerMax = clamp(28, Math.floor(minDim * 0.14), 200);
  const headerMin = 12;
  const subMin = 10;

  const aspect = W / H;
  const hasImage = !!imageHref;
  let pattern = choosePattern(patternChoice, aspect, hasImage);

  let sideFrac = 0.40;
  let topFracShort = 0.56;
  let topFracLong = 0.40;
  const sideFracMin = 0.26;
  const topFracMin = 0.26;

  const logoBase = Math.floor(minDim * 0.10);
  const sizeMap = {
    s: Math.max(48, Math.floor(logoBase * 0.8)),
    m: Math.max(64, logoBase),
    l: Math.max(88, Math.floor(logoBase * 1.4))
  };
  const hasLogo = !!logoHref;
  const logoPosTop = (logoPos === 'top');
  const logoGap = 12;

  const tagBase = Math.floor(minDim * 0.06);
  const tagSizeMap = {
    s: Math.max(20, Math.floor(tagBase * 0.8)),
    m: Math.max(28, tagBase),
    l: Math.max(36, Math.floor(tagBase * 1.2))
  };
  const hasTag = !!(tagText && tagText.trim());
  const tagPosAbove = (tagPos === 'above');
  const tagGap = 8;

  function attempt(pad, sideF, topF) {
    const contentWidth = W - 2 * pad;
    const contentHeight = H - 2 * pad;
    let lo = headerMin;
    let hi = headerMax;
    let best = null;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const headerSize = mid;
      const subSize = Math.max(subMin, Math.floor(headerSize / ratio));
      const gap = Math.max(10, Math.floor(headerSize * gapK));
      const imgTextGapPx = Math.max(16, Math.floor(headerSize * 0.5));

      const logoHeight = hasLogo ? Math.max(sizeMap[logoSize] || sizeMap.m, subSize) : 0;
      const tagHeight = hasTag ? tagSizeMap[tagSize] || tagSizeMap.m : 0;
      
      // Logo and TAG space is reserved only for text area, not for image area
      let textWidth = contentWidth;
      let textHeight = contentHeight;
      let imgBox = null;
      let headYoffset = 0;

      if (hasImage && pattern !== 'none') {
        if (pattern === 'side') {
          const imageWidth = Math.floor(contentWidth * sideF);
          imgBox = { x: 0, y: 0, w: imageWidth, h: textHeight, mode: 'side' };
          textWidth = contentWidth - imageWidth - imgTextGapPx;
        } else if (pattern === 'top') {
          const isLong = (subheader || '').length > 80 || header.length > 60;
          const imageHeight = Math.floor(textHeight * (isLong ? topFracLong : topF));
          imgBox = { x: 0, y: 0, w: contentWidth, h: imageHeight, mode: 'top' };
          textHeight = textHeight - imageHeight - imgTextGapPx;
          headYoffset = imageHeight + imgTextGapPx;
        }
      }
      
      // Reserve logo and tag space within the text area
      const logoReserveTop = hasLogo && logoPosTop ? (logoHeight + logoGap) : 0;
      const logoReserveBottom = hasLogo && !logoPosTop ? (logoHeight + logoGap) : 0;
      const tagReserveTop = hasTag && tagPosAbove ? (tagHeight + tagGap) : 0;
      const tagReserveBottom = hasTag && !tagPosAbove ? (tagHeight + tagGap) : 0;
      
      const textReserveTop = logoReserveTop + tagReserveTop;
      const textReserveBottom = logoReserveBottom + tagReserveBottom;
      const availableTextHeight = textHeight - textReserveTop - textReserveBottom;
      headYoffset += textReserveTop;

      const headerWrap = wrapNoBreak(measureHeader, headerSize, header, textWidth);
      const subWrap = wrapNoBreak(measureSub, subSize, subheader, textWidth);

      const headerHeight = headerWrap.lines.length * headerSize * lineHeightHeader;
      const subHeight = subheader ? subWrap.lines.length * subSize * lineHeightSub : 0;
      const totalHeight = headerHeight + (subheader ? gap + subHeight : 0);

      if (totalHeight <= availableTextHeight) {
        best = {
          padding: pad,
          Hs: headerSize,
          Ss: subSize,
          gap,
          imgTextGapPx,
          headLines: headerWrap.lines,
          subLines: subWrap.lines,
          headH: headerHeight,
          subH: subHeight,
          cw: contentWidth,
          ch: contentHeight,
          tw: textWidth,
          th: textHeight,
          imgBox,
          headYoffset,
          textReserveTop,
          textReserveBottom,
          logoH: logoHeight,
          tagH: tagHeight,
          logoReserveTop,
          logoReserveBottom,
          tagReserveTop,
          tagReserveBottom
        };
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  let fit = null;
  let tries = 0;
  
  while (!fit && tries < 16) {
    fit = attempt(padding, sideFrac, topFracShort);
    if (fit) break;
    
    if (hasImage && pattern === 'side' && sideFrac > sideFracMin) {
      sideFrac = Math.max(sideFracMin, sideFrac - 0.04);
    } else if (hasImage && pattern === 'top' && topFracShort > topFracMin) {
      topFracShort = Math.max(topFracMin, topFracShort - 0.04);
    } else {
      if (padding > 12) {
        padding = Math.max(12, Math.floor(padding * 0.9));
      } else {
        break;
      }
    }
    tries++;
  }
  
  if (!fit) {
    pattern = 'none';
    fit = attempt(12, sideFrac, topFracShort);
  }

  // Comfort shrink
  fit.Hs = Math.max(10, Math.floor(fit.Hs * 0.95));
  fit.Ss = Math.max(9, Math.floor(fit.Ss * 0.95));

  const pad = fit.padding;
  const baseX = pad;
  const baseY = pad;

  let imgBox = null;
  if (fit.imgBox) {
    if (fit.imgBox.mode === 'side') {
      imgBox = { x: baseX + (fit.cw - fit.imgBox.w), y: baseY, w: fit.imgBox.w, h: fit.ch };
    } else if (fit.imgBox.mode === 'top') {
      imgBox = { x: baseX, y: baseY, w: fit.cw, h: fit.imgBox.h };
    }
  }

  const headBox = { x: baseX, y: baseY + fit.headYoffset, w: fit.tw, h: fit.headH };
  const subBox = { x: headBox.x, y: Math.round(headBox.y + fit.headH + fit.gap), w: fit.tw, h: fit.subH };

  let logoBox = null;
  if (hasLogo) {
    // Position logo in text column area, not full content area
    const logoX = headBox.x; // Use text column x position
    if (logoPosTop) {
      logoBox = { x: logoX, y: baseY + (fit.imgBox && fit.imgBox.mode==='top' ? fit.imgBox.h + fit.imgTextGapPx : 0), w: fit.logoH, h: fit.logoH };
    } else {
      logoBox = { x: logoX, y: H - pad - fit.logoH, w: fit.logoH, h: fit.logoH };
    }
  }

  let tagBox = null;
  if (hasTag) {
    // Position tag in text column area, accounting for logo position
    const tagX = headBox.x;
    if (tagPosAbove) {
      let tagY = baseY + (fit.imgBox && fit.imgBox.mode==='top' ? fit.imgBox.h + fit.imgTextGapPx : 0);
      if (hasLogo && logoPosTop) {
        tagY += fit.logoH + logoGap;
      }
      tagBox = { x: tagX, y: tagY, w: fit.tw, h: fit.tagH };
    } else {
      let tagY = H - pad - fit.tagH;
      if (hasLogo && !logoPosTop) {
        tagY -= fit.logoH + logoGap;
      }
      tagBox = { x: tagX, y: tagY, w: fit.tw, h: fit.tagH };
    }
  }

  return {
    padding: fit.padding,
    headerSize: fit.Hs,
    subSize: fit.Ss,
    gap: fit.gap,
    imgTextGap: fit.imgTextGapPx,
    headLines: fit.headLines,
    subLines: fit.subLines,
    headBox,
    subBox,
    imgBox,
    pattern,
    logoBox,
    tagBox,
    imageRounded,
    tagText,
    tagTextColor,
    tagShapeColor,
    textColor,
    bgColor
  };
}

export function fitRandomLayout({
  W, H, header, subheader, fontFamily, headerWeight, subWeight,
  imageHref, imageRounded, logoHref, logoSize, 
  tagText, tagSize, tagTextColor, tagShapeColor, textColor, bgColor, paddingSize
}) {
  const layout = getRandomLayout();
  const minDim = Math.min(W, H);
  const measureHeader = createMeasure(fontFamily, headerWeight);
  const measureSub = createMeasure(fontFamily, subWeight);
  
  // Calculate padding
  let padding;
  if (paddingSize === 'auto') {
    padding = round8(clamp(24, minDim * 0.08, 80)); // Smaller padding for random layouts
  } else {
    const paddingMap = {
      s: Math.max(12, Math.floor(minDim * 0.04)),
      m: Math.max(24, Math.floor(minDim * 0.08)), 
      l: Math.max(48, Math.floor(minDim * 0.12))
    };
    padding = round8(paddingMap[paddingSize] || paddingMap.m);
  }
  
  const contentWidth = W - 2 * padding;
  const contentHeight = H - 2 * padding;
  
  // Calculate font sizes
  const headerSize = clamp(16, Math.floor(minDim * 0.06), 120);
  const subSize = Math.max(10, Math.floor(headerSize * 0.7));
  const gap = Math.max(8, Math.floor(headerSize * 0.3));
  
  // Position elements based on random layout
  let imgBox = null;
  let headBox = null;
  let subBox = null;
  let logoBox = null;
  let tagBox = null;
  
  const baseX = padding;
  const baseY = padding;
  
  // Position image
  if (imageHref && layout.image) {
    const imgW = Math.floor(contentWidth * layout.image.width);
    const imgH = Math.floor(contentHeight * layout.image.height);
    
    let imgX = baseX, imgY = baseY;
    
    switch(layout.image.position) {
      case 'left':
        imgX = baseX;
        imgY = baseY + Math.floor((contentHeight - imgH) / 2);
        break;
      case 'right':
        imgX = baseX + contentWidth - imgW;
        imgY = baseY + Math.floor((contentHeight - imgH) / 2);
        break;
      case 'top':
        imgX = baseX + Math.floor((contentWidth - imgW) / 2);
        imgY = baseY;
        break;
      case 'bottom-left':
        imgX = baseX;
        imgY = baseY + contentHeight - imgH;
        break;
      case 'top-right':
        imgX = baseX + contentWidth - imgW;
        imgY = baseY;
        break;
      case 'left-full':
        imgX = baseX;
        imgY = baseY;
        break;
    }
    
    imgBox = { x: imgX, y: imgY, w: imgW, h: imgH };
  }
  
  // Position header text
  const textWidth = Math.floor(contentWidth * layout.header.width);
  let textX = baseX, textY = baseY;
  
  switch(layout.header.position) {
    case 'top':
      textX = baseX + Math.floor((contentWidth - textWidth) / 2);
      textY = baseY + padding;
      break;
    case 'center':
      textX = baseX + Math.floor((contentWidth - textWidth) / 2);
      textY = baseY + Math.floor(contentHeight * 0.4);
      break;
    case 'left':
      textX = baseX + padding;
      textY = baseY + Math.floor(contentHeight * 0.3);
      break;
    case 'right':
      textX = baseX + contentWidth - textWidth - padding;
      textY = baseY + Math.floor(contentHeight * 0.3);
      break;
    case 'bottom-left':
      textX = baseX + padding;
      textY = baseY + contentHeight - Math.floor(contentHeight * 0.4);
      break;
    case 'center-top':
      textX = baseX + Math.floor((contentWidth - textWidth) / 2);
      textY = baseY + Math.floor(contentHeight * 0.2);
      break;
  }
  
  // Avoid overlapping with image
  if (imgBox) {
    if (textX < imgBox.x + imgBox.w && textX + textWidth > imgBox.x &&
        textY < imgBox.y + imgBox.h && textY + headerSize * 3 > imgBox.y) {
      // Move text to avoid overlap
      if (layout.image.position.includes('left')) {
        textX = imgBox.x + imgBox.w + 20;
      } else if (layout.image.position.includes('right')) {
        textX = Math.max(baseX, imgBox.x - textWidth - 20);
      } else if (layout.image.position === 'top') {
        textY = imgBox.y + imgBox.h + 20;
      }
    }
  }
  
  // Wrap text
  const headerWrap = wrapNoBreak(measureHeader, headerSize, header, textWidth);
  const subWrap = wrapNoBreak(measureSub, subSize, subheader, textWidth);
  
  const headerHeight = headerWrap.lines.length * headerSize * 1.2;
  const subHeight = subheader ? subWrap.lines.length * subSize * 1.4 : 0;
  
  headBox = { x: textX, y: textY, w: textWidth, h: headerHeight };
  subBox = { x: textX, y: textY + headerHeight + gap, w: textWidth, h: subHeight };
  
  // Position logo
  if (logoHref) {
    const logoH = Math.max(32, Math.floor(minDim * 0.06));
    let logoX = baseX, logoY = baseY;
    
    switch(layout.logo.position) {
      case 'top-left':
        logoX = baseX;
        logoY = baseY;
        break;
      case 'bottom-center':
        logoX = baseX + Math.floor((contentWidth - logoH) / 2);
        logoY = baseY + contentHeight - logoH;
        break;
      case 'left-top':
        logoX = baseX;
        logoY = baseY + 20;
        break;
      case 'bottom-right':
        logoX = baseX + contentWidth - logoH;
        logoY = baseY + contentHeight - logoH;
        break;
      case 'right-bottom':
        logoX = baseX + contentWidth - logoH;
        logoY = baseY + contentHeight - logoH - 20;
        break;
    }
    
    logoBox = { x: logoX, y: logoY, w: logoH, h: logoH };
  }
  
  // Position tag
  if (tagText && tagText.trim()) {
    const tagH = Math.max(24, Math.floor(minDim * 0.04));
    let tagX = baseX, tagY = baseY;
    
    switch(layout.tag.position) {
      case 'bottom-right':
        tagX = baseX + Math.floor(contentWidth * 0.6);
        tagY = baseY + contentHeight - tagH - 20;
        break;
      case 'top-right':
        tagX = baseX + Math.floor(contentWidth * 0.7);
        tagY = baseY + 10;
        break;
      case 'left-bottom':
        tagX = baseX + 10;
        tagY = baseY + contentHeight - tagH - 40;
        break;
      case 'top-left':
        tagX = baseX + 10;
        tagY = baseY + 10;
        break;
      case 'right-top':
        tagX = baseX + contentWidth - 120;
        tagY = baseY + 30;
        break;
    }
    
    tagBox = { x: tagX, y: tagY, w: Math.min(200, textWidth), h: tagH };
  }
  
  return {
    padding,
    headerSize,
    subSize,
    gap,
    imgTextGap: 20,
    headLines: headerWrap.lines,
    subLines: subWrap.lines,
    headBox,
    subBox,
    imgBox,
    pattern: imageHref ? 'random' : 'none',
    logoBox,
    tagBox,
    imageRounded,
    tagText,
    tagTextColor,
    tagShapeColor,
    textColor,
    bgColor,
    randomLayout: layout.name
  };
}