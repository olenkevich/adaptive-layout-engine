(function(){
  const clamp=(min,v,max)=>Math.max(min,Math.min(v,max));
  const round8=v=>Math.round(v/8)*8;
  const q=id=>document.getElementById(id);

  // Layout constants
  const LAYOUT_CONSTANTS = {
    // Typography ratios
    HEADER_TO_SUB_RATIO: 1.6,
    HEADER_LINE_HEIGHT: 1.20,
    SUB_LINE_HEIGHT: 1.44,
    GAP_RATIO: 0.40,
    
    // Sizing constraints
    MIN_DIMENSION: 320,
    MAX_DIMENSION: 8000,
    MIN_HEADER_SIZE: 12,
    MIN_SUB_SIZE: 10,
    
    // Image layout fractions
    SIDE_FRACTION: 0.40,
    TOP_FRACTION_SHORT: 0.56,
    TOP_FRACTION_LONG: 0.40,
    MIN_SIDE_FRACTION: 0.26,
    MIN_TOP_FRACTION: 0.26,
    
    // Spacing
    LOGO_GAP: 12,
    TAG_GAP: 8,
    MIN_IMG_TEXT_GAP: 16,
    
    // File constraints
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    
    // Performance
    DEBOUNCE_DELAY: 150,
    FONT_LOAD_TIMEOUT: 200
  };

  // Canvas context cache to prevent memory leaks
  const canvasCache = new Map();
  
  // Debounce utility for performance
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  function createMeasure(fontFamily, weight){
    const key = `${fontFamily}:${weight}`;
    if (!canvasCache.has(key)) {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      canvasCache.set(key, ctx);
    }
    const ctx = canvasCache.get(key);
    return (fs, t) => {
      ctx.font = String(weight) + ' ' + fs + 'px ' + fontFamily;
      return ctx.measureText(t).width;
    };
  }
  function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

  function wrapNoBreak(measure, fs, text, maxWidth){
    const words=(text||'').trim().split(/\s+/).filter(Boolean);
    if(!words.length) return {lines:[], tooWide:false};
    const lines=[]; let line=''; let tooWide=false;

    for(let w of words){
      if (measure(fs,w) > maxWidth) {
        tooWide = true;
      }
      const cand=line?line+' '+w:w;
      if(measure(fs,cand)<=maxWidth){
        line=cand;
      } else {
        if(line) lines.push(line);
        line=w;
      }
    }
    if(line) lines.push(line);
    return {lines, tooWide};
  }

  function choosePattern(auto, aspect, hasImage){
    if(!hasImage) return 'none';
    if(auto!=='auto') return auto;
    return aspect>=1.3 ? 'side' : 'top';
  }

  function fitLayout({W,H,header,subheader,fontFamily,headerWeight,subWeight,imageHref,patternChoice,imageRounded,logoHref,logoPos,logoSize,tagText,tagPos,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingSize}){
    const minDim=Math.min(W,H);
    const mH=createMeasure(fontFamily, headerWeight);
    const mS=createMeasure(fontFamily, subWeight);

    let padding;
    if (paddingSize === 'auto') {
      padding = round8(clamp(24, minDim*0.10, 120));
    } else {
      const paddingMap = {
        s: Math.max(16, Math.floor(minDim * 0.06)),
        m: Math.max(32, Math.floor(minDim * 0.10)), 
        l: Math.max(64, Math.floor(minDim * 0.16))
      };
      padding = round8(paddingMap[paddingSize] || paddingMap.m);
    }
    const ratio = LAYOUT_CONSTANTS.HEADER_TO_SUB_RATIO;
    const lhH = LAYOUT_CONSTANTS.HEADER_LINE_HEIGHT;
    const lhS = LAYOUT_CONSTANTS.SUB_LINE_HEIGHT;
    const gapK = LAYOUT_CONSTANTS.GAP_RATIO;

    const hdrMax=clamp(28, Math.floor(minDim*0.14), 200);
    const hdrMin = LAYOUT_CONSTANTS.MIN_HEADER_SIZE;
    const subMin = LAYOUT_CONSTANTS.MIN_SUB_SIZE;

    const aspect=W/H;
    const hasImage=!!imageHref;
    let pat=choosePattern(patternChoice, aspect, hasImage);

    let sideFrac = LAYOUT_CONSTANTS.SIDE_FRACTION;
    let topFracShort = LAYOUT_CONSTANTS.TOP_FRACTION_SHORT;
    let topFracLong = LAYOUT_CONSTANTS.TOP_FRACTION_LONG;
    const sideFracMin = LAYOUT_CONSTANTS.MIN_SIDE_FRACTION;
    const topFracMin = LAYOUT_CONSTANTS.MIN_TOP_FRACTION;

    const logoBase = Math.floor(minDim * 0.10);
    const sizeMap = { s: Math.max(48, Math.floor(logoBase*0.8)), m: Math.max(64, logoBase), l: Math.max(88, Math.floor(logoBase*1.4)) };
    const hasLogo = !!logoHref;
    const logoPosTop = (logoPos==='top');
    const logoGap = LAYOUT_CONSTANTS.LOGO_GAP;

    const tagBase = Math.floor(minDim * 0.06);
    const tagSizeMap = { s: Math.max(20, Math.floor(tagBase*0.8)), m: Math.max(28, tagBase), l: Math.max(36, Math.floor(tagBase*1.2)) };
    const hasTag = !!(tagText && tagText.trim());
    const tagPosAbove = (tagPos === 'above');
    const tagGap = LAYOUT_CONSTANTS.TAG_GAP;

    function attempt(pad, sideF, topF){
      const cw = W - 2*pad, ch = H - 2*pad;
      let lo=hdrMin, hi=hdrMax, best=null;
      while(lo<=hi){
        const mid=Math.floor((lo+hi)/2);
        const Hs=mid, Ss=Math.max(subMin, Math.floor(Hs/ratio));
        const gap=Math.max(10, Math.floor(Hs*gapK));
        const imgTextGapPx = Math.max(16, Math.floor(Hs * 0.5));

        const logoH = hasLogo ? Math.max(sizeMap[logoSize]||sizeMap.m, Ss) : 0;
        const tagH = hasTag ? tagSizeMap[tagSize]||tagSizeMap.m : 0;
        
        // Logo and TAG space is reserved only for text area, not for image area
        let tw=cw, th=ch, imgBox=null, headYoffset=0;
        if (hasImage && pat!=='none') {
          if (pat==='side') {
            const iw = Math.floor(cw * sideF);
            imgBox = { x: 0, y: 0, w: iw, h: th, mode:'side' };
            tw = cw - iw - imgTextGapPx;
          } else if (pat==='top') {
            const isLong = (subheader||'').length > 80 || header.length > 60;
            const ih = Math.floor(th * (isLong ? topFracLong : topF));
            imgBox = { x: 0, y: 0, w: cw, h: ih, mode:'top' };
            th = th - ih - imgTextGapPx;
            headYoffset = ih + imgTextGapPx;
          }
        }
        
        // Reserve logo and tag space within the text area
        const logoReserveTop = hasLogo && logoPosTop ? (logoH + logoGap) : 0;
        const logoReserveBottom = hasLogo && !logoPosTop ? (logoH + logoGap) : 0;
        const tagReserveTop = hasTag && tagPosAbove ? (tagH + tagGap) : 0;
        const tagReserveBottom = hasTag && !tagPosAbove ? (tagH + tagGap) : 0;
        
        const textReserveTop = logoReserveTop + tagReserveTop;
        const textReserveBottom = logoReserveBottom + tagReserveBottom;
        const textHeight = th - textReserveTop - textReserveBottom;
        headYoffset += textReserveTop;

        const hw=wrapNoBreak(mH,Hs,header,tw);
        const sw=wrapNoBreak(mS,Ss,subheader,tw);

        const headH = hw.lines.length * Hs * lhH;
        const subH  = (subheader? sw.lines.length * Ss * lhS : 0);
        const total = headH + (subheader? gap + subH : 0);

        if (total <= textHeight) {
          best = { padding: pad, Hs, Ss, gap, imgTextGapPx, headLines: hw.lines, subLines: sw.lines,
                   headH, subH, cw, ch, tw, th, imgBox, headYoffset, textReserveTop, textReserveBottom, logoH, tagH,
                   logoReserveTop, logoReserveBottom, tagReserveTop, tagReserveBottom };
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return best;
    }

    let fit=null, tries=0;
    while(!fit && tries<16){
      fit = attempt(padding, sideFrac, topFracShort);
      if (fit) break;
      if (hasImage && pat==='side' && sideFrac > sideFracMin) { sideFrac = Math.max(sideFracMin, sideFrac - 0.04); }
      else if (hasImage && pat==='top' && topFracShort > topFracMin) { topFracShort = Math.max(topFracMin, topFracShort - 0.04); }
      else { if (padding > 12) padding = Math.max(12, Math.floor(padding*0.9)); else break; }
      tries++;
    }
    if (!fit) { pat='none'; fit = attempt(12, sideFrac, topFracShort); }

    fit.Hs = Math.max(10, Math.floor(fit.Hs * 0.95));
    fit.Ss = Math.max(9, Math.floor(fit.Ss * 0.95));

    const pad=fit.padding, baseX=pad, baseY=pad;

    let imgBox=null;
    if (fit.imgBox) {
      if (fit.imgBox.mode==='side') {
        imgBox = { x: baseX + (fit.cw - fit.imgBox.w), y: baseY, w: fit.imgBox.w, h: fit.ch };
      } else if (fit.imgBox.mode==='top') {
        imgBox = { x: baseX, y: baseY, w: fit.cw, h: fit.imgBox.h };
      }
    }

    const headBox = { x: baseX, y: baseY + fit.headYoffset, w: fit.tw, h: fit.headH };
    const subBox  = { x: headBox.x, y: Math.round(headBox.y + fit.headH + fit.gap), w: fit.tw, h: fit.subH };

    let logoBox=null;
    if (hasLogo) {
      // Position logo in text column area, not full content area
      const logoX = headBox.x; // Use text column x position
      if (logoPosTop) logoBox = { x: logoX, y: baseY + (fit.imgBox && fit.imgBox.mode==='top' ? fit.imgBox.h + fit.imgTextGapPx : 0), w: fit.logoH, h: fit.logoH };
      else logoBox = { x: logoX, y: H - pad - fit.logoH, w: fit.logoH, h: fit.logoH };
    }

    let tagBox=null;
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

    return { padding: fit.padding, headerSize: fit.Hs, subSize: fit.Ss, gap: fit.gap, imgTextGap: fit.imgTextGapPx,
             headLines: fit.headLines, subLines: fit.subLines, headBox, subBox, imgBox, pattern: pat, logoBox, tagBox,
             imageRounded, tagText, tagTextColor, tagShapeColor, textColor, bgColor };
  }

  // Golden ratio and simple grid layouts
  const GOLDEN_RATIO = 1.618;
  const GRID_LAYOUTS = [
    {
      name: '2x2-grid',
      grid: { rows: 2, cols: 2 },
      cells: [
        { element: 'image', row: 0, col: 0, rowSpan: 2, colSpan: 1 }, // Left column
        { element: 'text', row: 0, col: 1, rowSpan: 1, colSpan: 1 },  // Top right
        { element: 'logo', row: 1, col: 1, rowSpan: 1, colSpan: 1 }   // Bottom right
      ]
    },
    {
      name: '3x2-grid', 
      grid: { rows: 3, cols: 2 },
      cells: [
        { element: 'image', row: 0, col: 0, rowSpan: 1, colSpan: 2 }, // Top row
        { element: 'text', row: 1, col: 0, rowSpan: 1, colSpan: 1 },  // Middle left
        { element: 'logo', row: 1, col: 1, rowSpan: 1, colSpan: 1 },  // Middle right
        { element: 'tag', row: 2, col: 1, rowSpan: 1, colSpan: 1 }    // Bottom right
      ]
    },
    {
      name: '2x3-grid',
      grid: { rows: 2, cols: 3 },
      cells: [
        { element: 'text', row: 0, col: 0, rowSpan: 1, colSpan: 2 },  // Top left span
        { element: 'logo', row: 0, col: 2, rowSpan: 1, colSpan: 1 },  // Top right
        { element: 'image', row: 1, col: 0, rowSpan: 1, colSpan: 3 }  // Bottom full
      ]
    },
    {
      name: 'golden-split',
      grid: { rows: 2, cols: 2 },
      cells: [
        { element: 'text', row: 0, col: 0, rowSpan: 1, colSpan: 2 },  // Top full
        { element: 'image', row: 1, col: 0, rowSpan: 1, colSpan: 1 }, // Bottom left
        { element: 'logo', row: 1, col: 1, rowSpan: 1, colSpan: 1 }   // Bottom right
      ]
    },
    {
      name: 'sidebar-layout',
      grid: { rows: 3, cols: 3 },
      cells: [
        { element: 'image', row: 0, col: 0, rowSpan: 3, colSpan: 1 }, // Left sidebar
        { element: 'text', row: 0, col: 1, rowSpan: 2, colSpan: 2 },  // Right top
        { element: 'logo', row: 2, col: 1, rowSpan: 1, colSpan: 1 },  // Bottom left
        { element: 'tag', row: 2, col: 2, rowSpan: 1, colSpan: 1 }    // Bottom right
      ]
    }
  ];

  function getRandomGridLayout() {
    return GRID_LAYOUTS[Math.floor(Math.random() * GRID_LAYOUTS.length)];
  }

  function fitRandomLayout({W,H,header,subheader,fontFamily,headerWeight,subWeight,imageHref,imageRounded,logoHref,logoSize,tagText,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingSize}) {
    const gridLayout = getRandomGridLayout();
    const minDim = Math.min(W, H);
    const mH = createMeasure(fontFamily, headerWeight);
    const mS = createMeasure(fontFamily, subWeight);
    
    let padding;
    if (paddingSize === 'auto') {
      padding = round8(clamp(20, minDim * 0.06, 60));
    } else {
      const paddingMap = { s: Math.max(16, Math.floor(minDim * 0.04)), m: Math.max(24, Math.floor(minDim * 0.06)), l: Math.max(40, Math.floor(minDim * 0.10)) };
      padding = round8(paddingMap[paddingSize] || paddingMap.m);
    }
    
    const contentWidth = W - 2 * padding;
    const contentHeight = H - 2 * padding;
    const gap = Math.max(16, Math.floor(minDim * 0.02)); // Gap between grid cells
    
    // Calculate grid cell dimensions using golden ratio proportions
    const { rows, cols } = gridLayout.grid;
    const availableWidth = contentWidth - (cols - 1) * gap;
    const availableHeight = contentHeight - (rows - 1) * gap;
    
    // Use golden ratio for row/column proportions
    let colWidths, rowHeights;
    if (cols === 2) {
      const goldenWidth = availableWidth / (1 + GOLDEN_RATIO);
      colWidths = [Math.floor(goldenWidth * GOLDEN_RATIO), Math.floor(goldenWidth)];
    } else if (cols === 3) {
      const baseWidth = availableWidth / 3;
      colWidths = [Math.floor(baseWidth), Math.floor(baseWidth), Math.floor(baseWidth)];
    } else {
      colWidths = [availableWidth];
    }
    
    if (rows === 2) {
      const goldenHeight = availableHeight / (1 + GOLDEN_RATIO);
      rowHeights = [Math.floor(goldenHeight * GOLDEN_RATIO), Math.floor(goldenHeight)];
    } else if (rows === 3) {
      const baseHeight = availableHeight / 3;
      rowHeights = [Math.floor(baseHeight), Math.floor(baseHeight), Math.floor(baseHeight)];
    } else {
      rowHeights = [availableHeight];
    }
    
    // Calculate grid positions
    const gridPositions = [];
    let currentY = padding;
    for (let row = 0; row < rows; row++) {
      let currentX = padding;
      for (let col = 0; col < cols; col++) {
        gridPositions.push({ x: currentX, y: currentY, w: colWidths[col], h: rowHeights[row] });
        currentX += colWidths[col] + gap;
      }
      currentY += rowHeights[row] + gap;
    }
    
    // Place elements in grid cells
    let imgBox = null, headBox = null, subBox = null, logoBox = null, tagBox = null;
    const headerSize = clamp(18, Math.floor(minDim * 0.05), 100);
    const subSize = Math.max(12, Math.floor(headerSize * 0.7));
    const textGap = Math.max(8, Math.floor(headerSize * 0.25));
    
    for (const cell of gridLayout.cells) {
      const gridIndex = cell.row * cols + cell.col;
      if (gridIndex >= gridPositions.length) continue;
      
      // Calculate cell dimensions based on span
      let cellX = gridPositions[cell.row * cols + cell.col].x;
      let cellY = gridPositions[cell.row * cols + cell.col].y;
      let cellW = 0, cellH = 0;
      
      // Calculate spanned width
      for (let c = 0; c < cell.colSpan; c++) {
        if (cell.col + c < cols) {
          cellW += colWidths[cell.col + c];
          if (c > 0) cellW += gap;
        }
      }
      
      // Calculate spanned height  
      for (let r = 0; r < cell.rowSpan; r++) {
        if (cell.row + r < rows) {
          cellH += rowHeights[cell.row + r];
          if (r > 0) cellH += gap;
        }
      }
      
      const cellPadding = Math.max(8, Math.floor(gap * 0.5));
      const innerX = cellX + cellPadding;
      const innerY = cellY + cellPadding;
      const innerW = cellW - 2 * cellPadding;
      const innerH = cellH - 2 * cellPadding;
      
      switch (cell.element) {
        case 'image':
          if (imageHref) {
            imgBox = { x: innerX, y: innerY, w: innerW, h: innerH };
          }
          break;
          
        case 'text':
          if (header || subheader) {
            const textWidth = innerW;
            const headerWrap = wrapNoBreak(mH, headerSize, header, textWidth);
            const subWrap = wrapNoBreak(mS, subSize, subheader, textWidth);
            const headerHeight = headerWrap.lines.length * headerSize * 1.2;
            const subHeight = subheader ? subWrap.lines.length * subSize * 1.3 : 0;
            const totalTextHeight = headerHeight + (subheader ? textGap + subHeight : 0);
            
            // Center text vertically in cell
            const textY = innerY + Math.max(0, Math.floor((innerH - totalTextHeight) / 2));
            
            headBox = { x: innerX, y: textY, w: textWidth, h: headerHeight };
            if (subheader) {
              subBox = { x: innerX, y: textY + headerHeight + textGap, w: textWidth, h: subHeight };
            }
          }
          break;
          
        case 'logo':
          if (logoHref) {
            const logoSize = Math.min(innerW, innerH, Math.max(40, Math.floor(minDim * 0.08)));
            const logoX = innerX + Math.floor((innerW - logoSize) / 2);
            const logoY = innerY + Math.floor((innerH - logoSize) / 2);
            logoBox = { x: logoX, y: logoY, w: logoSize, h: logoSize };
          }
          break;
          
        case 'tag':
          if (tagText && tagText.trim()) {
            const tagHeight = Math.max(28, Math.floor(minDim * 0.04));
            const tagWidth = Math.min(innerW, 180);
            const tagX = innerX + Math.floor((innerW - tagWidth) / 2);
            const tagY = innerY + Math.floor((innerH - tagHeight) / 2);
            tagBox = { x: tagX, y: tagY, w: tagWidth, h: tagHeight };
          }
          break;
      }
    }
    
    return { 
      padding, headerSize, subSize, 
      gap: textGap, imgTextGap: gap, 
      headLines: headBox ? wrapNoBreak(mH, headerSize, header, headBox.w).lines : [],
      subLines: subBox ? wrapNoBreak(mS, subSize, subheader, subBox.w).lines : [], 
      headBox, subBox, imgBox, 
      pattern: imageHref ? 'grid' : 'none', 
      logoBox, tagBox, imageRounded, tagText, tagTextColor, tagShapeColor, textColor, bgColor, 
      randomLayout: gridLayout.name 
    };
  }

  function renderSVG(opts){
    const {width,height,header,subheader,headerWeight,subWeight,fontFamily,imageHref,patternChoice,imageRounded,logoHref,logoPos,logoSize,tagText,tagPos,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingSize} = opts;
    const m = isRandomMode ? 
      fitRandomLayout({W:width,H:height,header,subheader,fontFamily,headerWeight,subWeight,imageHref,imageRounded,logoHref,logoSize,tagText,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingSize}) :
      fitLayout({W:width,H:height,header,subheader,fontFamily,headerWeight,subWeight,imageHref,patternChoice,imageRounded,logoHref,logoPos,logoSize,tagText,tagPos,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingSize});
    const parts = [`<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="100%" height="100%" fill="${esc(m.bgColor)}"/>`];
    if (m.imgBox && m.imgBox.w>0 && m.imgBox.h>0 && imageHref) {
      const roundedAttrs = m.imageRounded ? ` rx="12" ry="12"` : '';
      parts.push(`<image href="${esc(imageHref)}" x="${m.imgBox.x}" y="${m.imgBox.y}" width="${m.imgBox.w}" height="${m.imgBox.h}" preserveAspectRatio="xMidYMid slice"${roundedAttrs}/>`);
    }
    if (m.logoBox && logoHref) {
      parts.push(`<image href="${esc(logoHref)}" x="${m.logoBox.x}" y="${m.logoBox.y}" width="${m.logoBox.w}" height="${m.logoBox.h}" preserveAspectRatio="xMidYMid meet"/>`);
    }
    // Add tag if present
    if (m.tagBox && m.tagText && m.tagText.trim()) {
      const tagPaddingX = Math.max(12, Math.floor(m.tagBox.h * 0.4));
      const tagPaddingY = Math.max(6, Math.floor(m.tagBox.h * 0.2));
      const tagRadius = Math.floor(m.tagBox.h * 0.5); // Very round - half the height
      const tagTextSize = Math.max(10, Math.floor(m.tagBox.h * 0.6));
      
      // Measure text width to wrap container tightly
      const tagMeasure = createMeasure(fontFamily, 500);
      const tagTextWidth = tagMeasure(tagTextSize, m.tagText.trim());
      const tagContainerWidth = tagTextWidth + (tagPaddingX * 2);
      
      // Background rounded rectangle - wraps text tightly
      parts.push(`<rect x="${m.tagBox.x}" y="${m.tagBox.y}" width="${tagContainerWidth}" height="${m.tagBox.h}" rx="${tagRadius}" ry="${tagRadius}" fill="${esc(m.tagShapeColor)}"/>`);
      
      // Tag text - centered in container
      const tagY = m.tagBox.y + m.tagBox.h * 0.5 + tagTextSize * 0.35;
      parts.push(`<text x="${m.tagBox.x + tagPaddingX}" y="${tagY}" font-family="${fontFamily}" font-size="${tagTextSize}" font-weight="500" fill="${esc(m.tagTextColor)}">${esc(m.tagText.trim())}</text>`);
    }
    const txt = esc(textColor);
    m.headLines.forEach((ln,i)=>{
      const y = m.headBox.y + (i+1)*m.headerSize*1.20 - m.headerSize*0.20;
      parts.push(`<text x="${m.headBox.x}" y="${y}" font-family="${fontFamily}" font-size="${m.headerSize}" font-weight="${headerWeight}" fill="${txt}">${esc(ln)}</text>`);
    });
    m.subLines.forEach((ln,i)=>{
      const y = m.subBox.y + (i+1)*m.subSize*1.44 - m.subSize*0.44;
      parts.push(`<text x="${m.subBox.x}" y="${y}" font-family="${fontFamily}" font-size="${m.subSize}" font-weight="${subWeight}" fill="${txt}">${esc(ln)}</text>`);
    });
    parts.push(`</svg>`);
    return {svg: parts.join("\n"), meta: m};
  }

  // UI
  const $w=q('w'), $h=q('h'), $header=q('header'), $sub=q('subheader'),
        $hw=q('headerWeight'), $sw=q('subWeight'), $ff=q('fontFamily'),
        $wrap=q('wrap'), $err=q('err'),
        $imgFile=q('imgFile'), $clearImg=q('clearImg'), $pattern=q('pattern'), $imageRounded=q('imageRounded'),
        $logoFile=q('logoFile'), $clearLogo=q('clearLogo'), $logoPos=q('logoPos'), $logoSize=q('logoSize'),
        $tagText=q('tagText'), $tagPos=q('tagPos'), $tagSize=q('tagSize'),
        $tagTextColor=q('tagTextColor'), $tagTextHex=q('tagTextHex'), $tagShapeColor=q('tagShapeColor'), $tagShapeHex=q('tagShapeHex'),
        $paddingH=q('paddingH'), $paddingV=q('paddingV'), $recraftStyleId=q('recraftStyleId'),
        $bgColor=q('bgColor'), $bgHex=q('bgHex'), $textColor=q('textColor'), $textHex=q('textHex'),
        $viewport=q('viewport'), $downloadJpg=q('downloadJpg'), $sizePreset=q('sizePreset'), $customSizeInputs=q('customSizeInputs');

  let imageHref = '', logoHref = '';
  let currentSvg = '', currentWidth = 1200, currentHeight = 675;
  let isRandomMode = false;

  // Google Fonts management - Modern designer favorites
  const googleFonts = {
    'Inter': 'Inter:wght@300;400;500;600;700;800;900',
    'Poppins': 'Poppins:wght@300;400;500;600;700;800;900',
    'Manrope': 'Manrope:wght@300;400;500;600;700;800',
    'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800',
    'Space Grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
    'DM Sans': 'DM+Sans:wght@300;400;500;600;700;800;900',
    'Outfit': 'Outfit:wght@300;400;500;600;700;800;900',
    'Sora': 'Sora:wght@300;400;500;600;700;800',
    'JetBrains Mono': 'JetBrains+Mono:wght@300;400;500;600;700;800',
    'Fira Code': 'Fira+Code:wght@300;400;500;600;700',
    'Poppins': 'Poppins:wght@300;400;500;600;700;800;900',
    'Manrope': 'Manrope:wght@300;400;500;600;700;800',
    'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800',
    'Space Grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
    'DM Sans': 'DM+Sans:wght@300;400;500;600;700;800;900',
    'Outfit': 'Outfit:wght@300;400;500;600;700;800;900',
    'Satoshi': 'Satoshi:wght@300;400;500;600;700;800;900',
    'General Sans': 'General+Sans:wght@300;400;500;600;700;800',
    'Cabinet Grotesk': 'Cabinet+Grotesk:wght@300;400;500;600;700;800;900',
    'Clash Display': 'Clash+Display:wght@400;500;600;700',
    'Familjen Grotesk': 'Familjen+Grotesk:wght@400;500;600;700',
    'Sora': 'Sora:wght@300;400;500;600;700;800',
    'Cal Sans': 'Cal+Sans:wght@400;500;600;700',
    'Instrument Sans': 'Instrument+Sans:wght@400;500;600;700'
  };

  const loadedFonts = new Set(['Inter']); // Inter is loaded by default

  function loadGoogleFont(fontName) {
    if (loadedFonts.has(fontName) || !googleFonts[fontName]) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://fonts.googleapis.com';
      document.head.appendChild(link);
      
      const link2 = document.createElement('link');
      link2.rel = 'preconnect';
      link2.href = 'https://fonts.gstatic.com';
      link2.crossOrigin = '';
      document.head.appendChild(link2);
      
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = `https://fonts.googleapis.com/css2?family=${googleFonts[fontName]}&display=swap`;
      
      // Wait for font to load before resolving
      fontLink.onload = () => {
        // Additional check using FontFace API if available
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            loadedFonts.add(fontName);
            resolve();
          });
        } else {
          // Fallback - wait a bit for font to be available
          setTimeout(() => {
            loadedFonts.add(fontName);
            resolve();
          }, LAYOUT_CONSTANTS.FONT_LOAD_TIMEOUT);
        }
      };
      
      fontLink.onerror = () => {
        showError(`Failed to load font: ${fontName}`);
        reject(new Error(`Font loading failed: ${fontName}`));
      };
      
      document.head.appendChild(fontLink);
    });
  }

  // Font search functionality removed
  
  $ff.addEventListener('change', () => {
    const selectedOption = $ff.options[$ff.selectedIndex];
    const fontName = selectedOption.textContent;
    loadGoogleFont(fontName).then(() => {
      // Clear canvas cache when font changes to force remeasurement
      canvasCache.clear();
      paint();
    }).catch((error) => {
      console.error('Font loading error:', error);
      paint(); // Paint anyway with fallback font
    });
  });

  // Size presets
  const sizePresets = {
    '16:9-hd': [1920, 1080],
    '16:9-4k': [3840, 2160],
    '4:3': [1024, 768],
    '1:1': [1080, 1080],
    '9:16': [1080, 1920],
    'a4-portrait': [2480, 3508],
    'a4-landscape': [3508, 2480],
    'letter-portrait': [2550, 3300],
    'letter-landscape': [3300, 2550],
    'custom': null
  };

  function handleSizePresetChange() {
    const preset = $sizePreset.value;
    if (preset === 'custom') {
      $customSizeInputs.style.display = 'grid';
    } else {
      $customSizeInputs.style.display = 'none';
      const [width, height] = sizePresets[preset];
      $w.value = width;
      $h.value = height;
      paint();
    }
  }

  // Initialize size preset functionality
  handleSizePresetChange();
  $sizePreset.addEventListener('change', handleSizePresetChange);
  
  // Load default font
  loadGoogleFont('Inter');

  // Update preset selector when custom values change
  function updatePresetSelector() {
    const currentW = parseInt($w.value);
    const currentH = parseInt($h.value);
    let matchedPreset = 'custom';
    
    for (const [presetName, dimensions] of Object.entries(sizePresets)) {
      if (dimensions && dimensions[0] === currentW && dimensions[1] === currentH) {
        matchedPreset = presetName;
        break;
      }
    }
    
    if ($sizePreset.value !== matchedPreset) {
      $sizePreset.value = matchedPreset;
      handleSizePresetChange();
    }
  }

  function syncColorInputs(colorInput, hexInput){
    const updateFromPicker = ()=>{ hexInput.value = colorInput.value; paint(); };
    const updateFromHex = ()=>{
      const originalValue = hexInput.value.trim().toLowerCase();
      const isValid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(originalValue);
      
      if (isValid) {
        hexInput.value = originalValue;
        colorInput.value = originalValue;
        hexInput.style.backgroundColor = '#f1f3f4'; // Reset background
      } else {
        hexInput.style.backgroundColor = '#ffebea'; // Light red background for invalid
        showError('Invalid hex color format. Use #RGB or #RRGGBB');
        return; // Don't update or paint with invalid color
      }
      paint();
    };
    colorInput.addEventListener('input', updateFromPicker);
    hexInput.addEventListener('input', updateFromHex);
  }
  syncColorInputs($bgColor, $bgHex);
  syncColorInputs($textColor, $textHex);
  syncColorInputs($tagTextColor, $tagTextHex);
  syncColorInputs($tagShapeColor, $tagShapeHex);

  function showError(message) {
    $err.textContent = message;
    setTimeout(() => { if ($err.textContent === message) $err.textContent = ''; }, 5000);
  }

  $imgFile.addEventListener('change', e=>{
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 10MB)
    if (file.size > LAYOUT_CONSTANTS.MAX_FILE_SIZE) {
      showError('Image file too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file.');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        imageHref = String(ev.target.result);
        document.getElementById('imgPreviewImg').src = imageHref;
        document.getElementById('imgPreview').classList.add('show');
        paint();
      } catch (error) {
        showError('Failed to process image file.');
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      showError('Failed to read image file. File may be corrupted.');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  });
  $clearImg.addEventListener('click', ()=>{ imageHref=''; $imgFile.value=''; document.getElementById('imgPreview').classList.remove('show'); paint(); });

  $logoFile.addEventListener('change', e=>{
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 10MB)
    if (file.size > LAYOUT_CONSTANTS.MAX_FILE_SIZE) {
      showError('Logo file too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file for logo.');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        logoHref = String(ev.target.result);
        document.getElementById('logoPreviewImg').src = logoHref;
        document.getElementById('logoPreview').classList.add('show');
        paint();
      } catch (error) {
        showError('Failed to process logo file.');
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      showError('Failed to read logo file. File may be corrupted.');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  });
  $clearLogo.addEventListener('click', ()=>{ logoHref=''; $logoFile.value=''; document.getElementById('logoPreview').classList.remove('show'); paint(); });

  function downloadAsJPG() {
    try {
      const width = Math.max(320, parseInt($w.value||'1200',10));
      const height = Math.max(320, parseInt($h.value||'675',10));
      
      const {svg} = renderSVG({
        width, height,
        header: $header.value,
        subheader: $sub.value,
        headerWeight: parseInt($hw.value||'800',10),
        subWeight: parseInt($sw.value||'400',10),
        fontFamily: $ff.value || 'Inter, system-ui, -apple-system, Segoe UI, Roboto',
        imageHref: imageHref,
        patternChoice: $pattern.value,
        imageRounded: $imageRounded.checked,
        logoHref: logoHref,
        logoPos: $logoPos.value,
        logoSize: $logoSize.value,
        tagText: $tagText.value,
        tagPos: $tagPos.value,
        tagSize: $tagSize.value,
        tagTextColor: $tagTextHex.value,
        tagShapeColor: $tagShapeHex.value,
        textColor: $textHex.value,
        bgColor: $bgHex.value,
        paddingSize: 'auto'
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = function() {
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(function(blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `layout-${width}x${height}-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.95);
      };

      const svgBlob = new Blob([svg], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
    } catch(e) {
      showError('Download failed: ' + (e.message || 'Unknown error occurred'));
      console.error('Download error:', e);
    }
  }

  $downloadJpg.addEventListener('click', downloadAsJPG);

  function paint(){
    try{
      $err.textContent='';
      
      // Validate required inputs
      if (!$header.value.trim()) {
        showError('Header text is required');
        return;
      }
      
      const width = Math.max(320, parseInt($w.value||'1200',10));
      const height= Math.max(320, parseInt($h.value||'675',10));
      const {svg, meta} = renderSVG({
        width, height,
        header: $header.value,
        subheader: $sub.value,
        headerWeight: parseInt($hw.value||'800',10),
        subWeight: parseInt($sw.value||'400',10),
        fontFamily: $ff.value || 'Inter, system-ui, -apple-system, Segoe UI, Roboto',
        imageHref: imageHref,
        patternChoice: $pattern.value,
        imageRounded: $imageRounded.checked,
        logoHref: logoHref,
        logoPos: $logoPos.value,
        logoSize: $logoSize.value,
        tagText: $tagText.value,
        tagPos: $tagPos.value,
        tagSize: $tagSize.value,
        tagTextColor: $tagTextHex.value,
        tagShapeColor: $tagShapeHex.value,
        textColor: $textHex.value,
        bgColor: $bgHex.value,
        paddingSize: 'auto'
      });

      // Store current layout
      currentSvg = svg;
      currentWidth = width;
      currentHeight = height;
      
      $wrap.innerHTML = svg;
      $wrap.style.width = width + 'px';
      $wrap.style.height = height + 'px';
      
      updateScale(width, height);
    }catch(e){ 
      showError('Layout generation failed: ' + (e.message || 'Unknown error'));
      console.error('Paint error:', e); 
    }
  }

  function updateScale(width, height) {
    // Get actual viewport size
    const viewportRect = $viewport.getBoundingClientRect();
    const availableWidth = viewportRect.width - 40;  // 20px padding each side
    const availableHeight = viewportRect.height - 80; // Space for button
    
    // Only scale down if layout is larger than available space
    const scale = Math.min(1, availableWidth / width, availableHeight / height);
    
    if (scale < 1) {
      $wrap.style.transform = `scale(${scale})`;
    } else {
      $wrap.style.transform = 'none';
    }
    $wrap.style.transformOrigin = 'center center';
  }

  // Debounced paint for input events
  const debouncedPaint = debounce(paint, LAYOUT_CONSTANTS.DEBOUNCE_DELAY);
  
  // Text inputs get debounced updates for typing, others get immediate
  [$header, $sub, $tagText].forEach(n => n.addEventListener('input', debouncedPaint));
  [$w,$h,$hw,$sw,$pattern,$imageRounded,$logoPos,$logoSize,$tagPos,$tagSize,$tagTextColor,$tagTextHex,$tagShapeColor,$tagShapeHex,$paddingH,$paddingV,$bgColor,$bgHex,$textColor,$textHex,$sizePreset].forEach(n => n.addEventListener('change', paint));
  
  // Add special handling for width/height to update preset selector and validate bounds
  function validateDimensionInput(input, dimension) {
    const value = parseInt(input.value, 10);
    const min = LAYOUT_CONSTANTS.MIN_DIMENSION;
    const max = LAYOUT_CONSTANTS.MAX_DIMENSION;
    
    if (isNaN(value) || value < min) {
      input.style.backgroundColor = '#ffebea';
      showError(`${dimension} must be at least ${min}px`);
      return false;
    } else if (value > max) {
      input.style.backgroundColor = '#ffebea';
      showError(`${dimension} must be no more than ${max}px`);
      return false;
    } else {
      input.style.backgroundColor = '#f1f3f4';
      return true;
    }
  }
  
  $w.addEventListener('input', () => {
    if (validateDimensionInput($w, 'Width')) {
      updatePresetSelector();
    }
  });
  
  $h.addEventListener('input', () => {
    if (validateDimensionInput($h, 'Height')) {
      updatePresetSelector();
    }
  });
  
  window.addEventListener('resize', () => {
    // Use stored dimensions, not recalculated ones
    updateScale(currentWidth, currentHeight);
  });
  document.getElementById('clearImg').addEventListener('click', paint);
  document.getElementById('clearLogo').addEventListener('click', paint);
  
  // Layout mode functionality - removed for current version
  
  // Profile menu functionality
  const profileMenuTrigger = document.getElementById('profileMenuTrigger');
  const profileMenu = document.getElementById('profileMenu');
  
  profileMenuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('show');
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!profileMenu.contains(e.target) && !profileMenuTrigger.contains(e.target)) {
      profileMenu.classList.remove('show');
    }
  });
  
  // Handle menu item clicks
  const menuItems = profileMenu.querySelectorAll('.profile-menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const text = item.textContent.trim();
      profileMenu.classList.remove('show');
      
      // Placeholder functionality for auth integration
      switch(text) {
        case 'Profile Settings':
          console.log('Profile Settings clicked - ready for auth integration');
          break;
        case 'Preferences':
          console.log('Preferences clicked - ready for auth integration');
          break;
        case 'Sign Out':
          console.log('Sign Out clicked - ready for auth integration');
          break;
      }
    });
  });
  
  // AI Generation functionality
  const $aiPrompt = q('aiPrompt');
  const $generateAI = q('generateAI');

  function showAIStatus(message, type = 'loading') {
    console.log(`AI Status: ${message} (${type})`);
  }

  function hideAIStatus() {
    console.log('AI Status cleared');
  }


  async function generateWithAI() {
    const prompt = $aiPrompt.value.trim();
    if (!prompt) {
      showAIStatus('Please enter a description for your layout', 'error');
      setTimeout(hideAIStatus, 3000);
      return;
    }

    $generateAI.disabled = true;
    
    try {
      // Step 1: Generate text content using serverless function
      showAIStatus('Step 1: Generating text content...', 'loading');
      
      const textResponse = await fetch('/api/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!textResponse.ok) {
        throw new Error(`Text generation failed: ${textResponse.status}`);
      }

      const textData = await textResponse.json();
      console.log('Text generation response:', textData);

      if (!textData.success) {
        console.error('Text generation not successful:', textData);
        throw new Error('Text generation was not successful');
      }

      // Update form fields with generated text
      $header.value = textData.result.header;
      $sub.value = textData.result.subheader;
      if (textData.result.tag) {
        $tagText.value = textData.result.tag;
      }

      // Step 2: Generate image using serverless function
      showAIStatus('Step 2: Generating image...', 'loading');
      
      const imageResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imagePrompt: textData.result.imagePrompt,
          styleId: $recraftStyleId.value.trim() || null
        })
      });

      if (!imageResponse.ok) {
        throw new Error(`Image generation failed: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.json();
      console.log('Image generation response:', imageData);

      if (!imageData.success) {
        console.error('Image generation failed:', imageData);
      }

      if (imageData.success && imageData.imageUrl) {
        // Set the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            imageHref = canvas.toDataURL();
          } catch (e) {
            // If canvas fails, use direct URL
            imageHref = imageData.imageUrl;
          }
          
          // Determine success message based on what was actually generated
          let statusMsg = '✓ Layout generated!';
          if (textData.demo && imageData.demo) {
            statusMsg = '✓ Demo layout generated!';
          } else if (textData.demo) {
            statusMsg = '✓ Layout with AI image generated!';
          } else if (imageData.demo || imageData.fallback) {
            statusMsg = '✓ Layout with AI text generated!';
          } else {
            statusMsg = '✓ Full AI layout generated!';
          }
          
          showAIStatus(statusMsg, 'success');
          setTimeout(hideAIStatus, 3000);
          
          // Trigger layout update
          paint();
        };
        img.onerror = function() {
          imageHref = imageData.imageUrl;
          showAIStatus('✓ Layout generated!', 'success');
          setTimeout(hideAIStatus, 3000);
          paint();
        };
        img.src = imageData.imageUrl;
      } else {
        // Text generation worked, image failed
        showAIStatus('✓ Text generated! Image failed, layout updated.', 'success');
        paint();
        setTimeout(hideAIStatus, 3000);
      }

    } catch (error) {
      console.error('AI generation error:', error);
      showAIStatus(`Error: ${error.message}`, 'error');
      setTimeout(hideAIStatus, 5000);
    } finally {
      $generateAI.disabled = false;
    }
  }

  $generateAI.addEventListener('click', generateWithAI);

  paint();
})();