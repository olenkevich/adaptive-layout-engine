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
  // Text measurement cache to avoid repeated expensive calculations
  const textMeasureCache = new Map();
  // Layout calculation cache for identical inputs
  const layoutCache = new Map();
  
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
      // Create cache key for this specific measurement
      const measureKey = `${key}:${fs}:${t}`;
      if (textMeasureCache.has(measureKey)) {
        return textMeasureCache.get(measureKey);
      }
      
      ctx.font = String(weight) + ' ' + fs + 'px ' + fontFamily;
      const width = ctx.measureText(t).width;
      
      // Cache the result (with size limit to prevent memory leaks)
      if (textMeasureCache.size < 1000) {
        textMeasureCache.set(measureKey, width);
      }
      return width;
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
    if(auto!=='auto') return auto; // This preserves 'left', 'side', 'top' selections
    return aspect>=1.3 ? 'side' : 'top';
  }

  function fitLayout({W,H,header,subheader,fontFamily,headerWeight,subWeight,imageHref,patternChoice,imageRounded,imagePadding,logoHref,logoPos,logoSize,tagText,tagPos,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingH,paddingV,headerLetterSpacing,subLetterSpacing}){
    // Create cache key for layout (excluding colors since they don't affect layout)
    const layoutKey = `${W}:${H}:${header}:${subheader}:${fontFamily}:${headerWeight}:${subWeight}:${patternChoice}:${imageRounded}:${imagePadding}:${logoPos}:${logoSize}:${tagPos}:${tagSize}:${paddingH}:${paddingV}`;
    
    if (layoutCache.has(layoutKey)) {
      const cached = layoutCache.get(layoutKey);
      // Return cached result with updated colors
      return { ...cached, tagTextColor, tagShapeColor, textColor, bgColor };
    }
    
    const minDim=Math.min(W,H);
    const mH=createMeasure(fontFamily, headerWeight);
    const mS=createMeasure(fontFamily, subWeight);

    // Force generous minimum padding - ALWAYS at least 48px regardless of UI input
    const minRequiredPadding = 48;
    const calculatedPadding = paddingH || round8(clamp(minRequiredPadding, minDim*0.10, 120));
    const padding = Math.max(minRequiredPadding, calculatedPadding);
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
    console.log('🎯 fitLayout called with patternChoice:', patternChoice, ', final pattern:', pat, ', hasImage:', hasImage);

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
      
      // Optimize binary search range based on container size
      const estimatedOptimal = Math.floor(minDim * 0.08);
      let lo = Math.max(hdrMin, estimatedOptimal - 20); // Start closer to likely result
      let hi = Math.min(hdrMax, estimatedOptimal + 30); // Smaller search range
      let best=null;
      
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
          } else if (pat==='left') {
            const iw = Math.floor(cw * sideF);
            imgBox = { x: 0, y: 0, w: iw, h: th, mode:'left' };
            tw = cw - iw - imgTextGapPx;
            console.log('🔥 LEFT pattern detected! Image width:', iw, ', text width:', tw, ', hasImage:', hasImage, ', imageHref:', !!imageHref);
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
      if (imagePadding === 'fill') {
        // Fill to edges - ignore padding for image positioning
        if (fit.imgBox.mode==='side') {
          imgBox = { x: W - fit.imgBox.w, y: 0, w: fit.imgBox.w, h: H };
        } else if (fit.imgBox.mode==='left') {
          imgBox = { x: 0, y: 0, w: fit.imgBox.w, h: H };
        } else if (fit.imgBox.mode==='top') {
          imgBox = { x: 0, y: 0, w: W, h: fit.imgBox.h };
        }
      } else {
        // Respect layout padding (default behavior)
        if (fit.imgBox.mode==='side') {
          imgBox = { x: baseX + (fit.cw - fit.imgBox.w), y: baseY, w: fit.imgBox.w, h: fit.ch };
        } else if (fit.imgBox.mode==='left') {
          imgBox = { x: baseX, y: baseY, w: fit.imgBox.w, h: fit.ch };
        } else if (fit.imgBox.mode==='top') {
          imgBox = { x: baseX, y: baseY, w: fit.cw, h: fit.imgBox.h };
        }
      }
    }

    // Adjust text position based on image layout
    let textX = baseX;
    if (fit.imgBox && fit.imgBox.mode === 'left') {
      textX = baseX + fit.imgBox.w + fit.imgTextGapPx;
      console.log('LEFT positioning: image at x=0, text at x=', textX);
    } else if (fit.imgBox && fit.imgBox.mode === 'side') {
      console.log('SIDE positioning: text at x=', textX, ', image will be at right');
    }
    
    const headBox = { x: textX, y: baseY + fit.headYoffset, w: fit.tw, h: fit.headH };
    const subBox  = { x: headBox.x, y: Math.round(headBox.y + fit.headH + fit.gap), w: fit.tw, h: fit.subH };

    let logoBox=null;
    if (hasLogo) {
      // Position logo in text column area, not full content area
      const logoX = textX; // Use text column x position
      if (logoPosTop) logoBox = { x: logoX, y: baseY + (fit.imgBox && fit.imgBox.mode==='top' ? fit.imgBox.h + fit.imgTextGapPx : 0), w: fit.logoH, h: fit.logoH };
      else logoBox = { x: logoX, y: H - pad - fit.logoH, w: fit.logoH, h: fit.logoH };
    }

    let tagBox=null;
    if (hasTag) {
      // Position tag in text column area, accounting for logo position
      const tagX = textX;
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

    console.log('📐 fitLayout result:', { pattern: pat, hasImgBox: !!imgBox, imgBox, hasImage, imageHref: !!imageHref });
    const result = { padding: fit.padding, headerSize: fit.Hs, subSize: fit.Ss, gap: fit.gap, imgTextGap: fit.imgTextGapPx,
             headLines: fit.headLines, subLines: fit.subLines, headBox, subBox, imgBox, pattern: pat, logoBox, tagBox,
             imageRounded, tagText, tagTextColor, tagShapeColor, textColor, bgColor, 
             headerLetterSpacing, subLetterSpacing };
    
    // Cache result (with size limit to prevent memory leaks)
    if (layoutCache.size < 50) {
      layoutCache.set(layoutKey, result);
    }
    
    return result;
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

  function fitRandomLayout({W,H,header,subheader,fontFamily,headerWeight,subWeight,imageHref,imageRounded,imagePadding,logoHref,logoSize,tagText,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingH,paddingV,headerLetterSpacing,subLetterSpacing}) {
    const gridLayout = getRandomGridLayout();
    const minDim = Math.min(W, H);
    const mH = createMeasure(fontFamily, headerWeight);
    const mS = createMeasure(fontFamily, subWeight);
    
    // Force generous minimum padding for random layouts - ALWAYS at least 40px regardless of UI input
    const minRequiredPadding = 40;
    const calculatedPadding = paddingH || round8(clamp(minRequiredPadding, minDim * 0.08, 100));
    const padding = Math.max(minRequiredPadding, calculatedPadding);
    
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
            if (imagePadding === 'fill') {
              // Fill to edges - use full cell dimensions
              imgBox = { x: cellX, y: cellY, w: cellW, h: cellH };
            } else {
              // Respect layout padding
              imgBox = { x: innerX, y: innerY, w: innerW, h: innerH };
            }
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
      headerLetterSpacing, subLetterSpacing,
      randomLayout: gridLayout.name 
    };
  }

  function renderSVG(opts){
    const {width,height,header,subheader,headerWeight,subWeight,fontFamily,imageHref,patternChoice,imageRounded,imagePadding,logoHref,logoPos,logoSize,tagText,tagPos,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingH,paddingV,headerLetterSpacing,subLetterSpacing} = opts;
    const m = isRandomMode ? 
      fitRandomLayout({W:width,H:height,header,subheader,fontFamily,headerWeight,subWeight,imageHref,imageRounded,imagePadding,logoHref,logoSize,tagText,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingH,paddingV,headerLetterSpacing,subLetterSpacing}) :
      fitLayout({W:width,H:height,header,subheader,fontFamily,headerWeight,subWeight,imageHref,patternChoice,imageRounded,imagePadding,logoHref,logoPos,logoSize,tagText,tagPos,tagSize,tagTextColor,tagShapeColor,textColor,bgColor,paddingH,paddingV,headerLetterSpacing,subLetterSpacing});
    const parts = [`<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="100%" height="100%" fill="${esc(m.bgColor)}"/>`];
    console.log('🖼️ Image rendering check:', { hasImgBox: !!m.imgBox, imgBox: m.imgBox, hasImageHref: !!imageHref, pattern: m.pattern });
    if (m.imgBox && m.imgBox.w>0 && m.imgBox.h>0 && imageHref) {
      console.log('✅ Rendering image with box:', m.imgBox);
      if (imageRounded) {
        // Add rounded corners using clipPath
        const radius = Math.min(m.imgBox.w, m.imgBox.h) * 0.1; // 10% radius
        const clipId = `imgClip_${Date.now()}`;
        parts.push(`<defs><clipPath id="${clipId}"><rect x="${m.imgBox.x}" y="${m.imgBox.y}" width="${m.imgBox.w}" height="${m.imgBox.h}" rx="${radius}" ry="${radius}"/></clipPath></defs>`);
        parts.push(`<image href="${esc(imageHref)}" x="${m.imgBox.x}" y="${m.imgBox.y}" width="${m.imgBox.w}" height="${m.imgBox.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`);
      } else {
        parts.push(`<image href="${esc(imageHref)}" x="${m.imgBox.x}" y="${m.imgBox.y}" width="${m.imgBox.w}" height="${m.imgBox.h}" preserveAspectRatio="xMidYMid slice"/>`);
      }
    } else {
      console.log('❌ Image NOT rendered. Reasons:', { 
        noImgBox: !m.imgBox, 
        zeroWidth: m.imgBox && m.imgBox.w <= 0, 
        zeroHeight: m.imgBox && m.imgBox.h <= 0, 
        noImageHref: !imageHref 
      });
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
      const tagLetterSpacing = m.subLetterSpacing || '0'; // Tags use sub letter-spacing since they're smaller text
      parts.push(`<text x="${m.tagBox.x + tagPaddingX}" y="${tagY}" font-family="${fontFamily}" font-size="${tagTextSize}" font-weight="500" fill="${esc(m.tagTextColor)}" letter-spacing="${tagLetterSpacing}">${esc(m.tagText.trim())}</text>`);
    }
    const txt = esc(textColor);
    m.headLines.forEach((ln,i)=>{
      const y = m.headBox.y + (i+1)*m.headerSize*1.20 - m.headerSize*0.20;
      parts.push(`<text x="${m.headBox.x}" y="${y}" font-family="${fontFamily}" font-size="${m.headerSize}" font-weight="${headerWeight}" letter-spacing="${m.headerLetterSpacing || '0'}" fill="${txt}">${esc(ln)}</text>`);
    });
    m.subLines.forEach((ln,i)=>{
      const y = m.subBox.y + (i+1)*m.subSize*1.44 - m.subSize*0.44;
      parts.push(`<text x="${m.subBox.x}" y="${y}" font-family="${fontFamily}" font-size="${m.subSize}" font-weight="${subWeight}" letter-spacing="${m.subLetterSpacing || '0'}" fill="${txt}">${esc(ln)}</text>`);
    });
    parts.push(`</svg>`);
    return {svg: parts.join("\n"), meta: m};
  }

  // UI
  const $w=q('w'), $h=q('h'), $header=q('header'), $sub=q('subheader'),
        $hw=q('headerWeight'), $sw=q('subWeight'), $ff=q('fontFamily'),
        $wrap=q('wrap'), $err=q('err'),
        $imgFile=q('imgFile'), $clearImg=q('clearImg'), $pattern=q('pattern'), $imageRounded=q('imageRounded'), $imagePadding=q('imagePadding'),
        $logoFile=q('logoFile'), $clearLogo=q('clearLogo'), $logoPos=q('logoPos'), $logoSize=q('logoSize'),
        $tagText=q('tagText'), $tagPos=q('tagPos'), $tagSize=q('tagSize'),
        $tagTextColor=q('tagTextColor'), $tagTextHex=q('tagTextHex'), $tagShapeColor=q('tagShapeColor'), $tagShapeHex=q('tagShapeHex'),
        $paddingH=q('paddingH'), $paddingV=q('paddingV'), $recraftStyleId=q('recraftStyleId'),
        $bgColor=q('bgColor'), $bgHex=q('bgHex'), $textColor=q('textColor'), $textHex=q('textHex'),
        $viewport=q('viewport'), $downloadJpg=q('downloadJpg'), $sizePreset=q('sizePreset'), $customSizeInputs=q('customSizeInputs'),
        $randomizeLayout=q('randomizeLayout');

  let imageHref = '', logoHref = '';
  let currentSvg = '', currentWidth = 1200, currentHeight = 675;
  let isRandomMode = false;
  
  // Expose functions globally for the randomization button
  window.enableRandomGrids = () => {
    isRandomMode = true;
    console.log('✅ Random grid mode enabled - left/bottom positioning available');
  };
  
  window.disableRandomGrids = () => {
    isRandomMode = false;
    console.log('📐 Standard layout mode enabled');
  };
  
  // Expose paint function globally
  window.paint = null; // Will be set later

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
        imagePadding: $imagePadding.value,
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
        paddingH: parseInt($paddingH.value||'24',10),
        paddingV: parseInt($paddingV.value||'24',10)
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

  // Test contrast calculation function (for debugging)
  window.testContrast = function(bg, text) {
    const ratio = getContrastRatio(text, bg);
    const result = ratio >= 4.5 ? '✅ PASS' : '❌ FAIL';
    console.log(`Contrast test: ${text} on ${bg} = ${ratio.toFixed(2)} ${result}`);
    return ratio;
  };
  
  // Professional Typography Generator following design principles
  function generateProfessionalTypography() {
    // Define professional typography systems following the 9 rules
    const typographySystems = [
      // Rule 1: Serif + Sans combinations (workhorse + accent)
      {
        name: 'Classic Editorial',
        fontFamily: 'Georgia, serif',
        headerWeight: '700',   // Bold for structure  
        subWeight: '400',      // Regular for body
        contrast: '3.5:1',     // Strong hierarchy
        category: 'serif-sans',
        // Rule 4: Letter-spacing for different text types
        headerLetterSpacing: '-0.02em',  // Tighten headlines for impact
        subLetterSpacing: '0em'          // Default for body readability
      },
      {
        name: 'Modern Editorial', 
        fontFamily: 'Times, serif',
        headerWeight: '800',   // Bold for titles
        subWeight: '400',      // Regular for readability
        contrast: '4:1',
        category: 'serif-sans',
        headerLetterSpacing: '-0.025em',  // Tight for serif headlines
        subLetterSpacing: '0em'
      },
      
      // Rule 1: Single family with weight contrast
      {
        name: 'Swiss Modern',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto',
        headerWeight: '800',   // Extra bold for impact
        subWeight: '400',      // Regular for body  
        contrast: '4:1',       // Strong visual hierarchy
        category: 'single-family',
        headerLetterSpacing: '-0.03em',   // Aggressive tightening for impact
        subLetterSpacing: '-0.01em'       // Slight tightening for body
      },
      {
        name: 'Neo-Grotesque',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto', 
        headerWeight: '900',   // Black for maximum impact
        subWeight: '300',      // Light for contrast
        contrast: '6:1',       // Dramatic hierarchy
        category: 'single-family',
        headerLetterSpacing: '-0.04em',   // Very tight for black weight
        subLetterSpacing: '0.01em'        // Slightly open for light weight
      },
      {
        name: 'Bauhaus Functional',
        fontFamily: 'DM Sans, sans-serif',
        headerWeight: '800',   
        subWeight: '400',      
        contrast: '4:1',
        category: 'single-family',
        headerLetterSpacing: '-0.025em',  // Functional tightening
        subLetterSpacing: '0em'           // Clean, default
      },
      {
        name: 'Constructivist',
        fontFamily: 'Space Grotesk, sans-serif',
        headerWeight: '700',
        subWeight: '400',
        contrast: '3.5:1', 
        category: 'single-family',
        headerLetterSpacing: '-0.02em',   // Moderate impact
        subLetterSpacing: '0em'
      },
      {
        name: 'Humanist Balance',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        headerWeight: '700',
        subWeight: '400', 
        contrast: '3.5:1',
        category: 'single-family',
        headerLetterSpacing: '-0.015em',  // Gentle tightening
        subLetterSpacing: '0em'
      },
      {
        name: 'Corporate Clean',
        fontFamily: 'Manrope, sans-serif',
        headerWeight: '800',
        subWeight: '400',
        contrast: '4:1',
        category: 'single-family',
        headerLetterSpacing: '-0.03em',   // Strong corporate impact
        subLetterSpacing: '-0.005em'      // Slight tightening for precision
      },
      {
        name: 'Tech Precision',
        fontFamily: 'Outfit, sans-serif', 
        headerWeight: '700',
        subWeight: '400',
        contrast: '3.5:1',
        category: 'single-family',
        headerLetterSpacing: '-0.02em',   // Technical precision
        subLetterSpacing: '0em'
      },
      {
        name: 'Contemporary Edge',
        fontFamily: 'Sora, sans-serif',
        headerWeight: '700',
        subWeight: '400', 
        contrast: '3.5:1',
        category: 'single-family',
        headerLetterSpacing: '-0.02em',   // Modern tightening
        subLetterSpacing: '0em'
      }
    ];
    
    // Select a random professional system
    const system = typographySystems[Math.floor(Math.random() * typographySystems.length)];
    
    return {
      ...system,
      // Add calculated contrast for validation
      calculatedContrast: parseFloat(system.headerWeight) / parseFloat(system.subWeight)
    };
  }

  // Professional Spacing Generator following typography rules
  function generateProfessionalSpacing() {
    // Professional spacing systems based on typographic rhythm
    const spacingSystems = [
      // Rule 5: Minimum 1x type size, Ideal 1.5x-2x for breathing
      {
        name: 'Bauhaus Minimal',
        horizontal: 48,    // Increased from 32 - more generous minimum
        vertical: 56,      // Increased from 40 - better vertical rhythm
        rhythm: 'minimal',
        principle: 'Generous minimal - proper breathing room'
      },
      {
        name: 'Swiss Grid',
        horizontal: 64,    // Increased from 48 - more structured space
        vertical: 72,      // Increased from 56 - proportional vertical
        rhythm: 'structured',
        principle: 'Structured grid with generous spacing'
      },
      {
        name: 'Editorial Classic',
        horizontal: 72,    // Increased from 56 - more editorial feel
        vertical: 88,      // Increased from 72 - better reading flow
        rhythm: 'generous',
        principle: 'Editorial spaciousness for readability'
      },
      {
        name: 'Constructivist',
        horizontal: 56,    // Increased from 40 - less tight
        vertical: 80,      // Increased from 64 - more dramatic
        rhythm: 'asymmetric',
        principle: 'Asymmetric with generous margins'
      },
      {
        name: 'Modernist Comfortable',
        horizontal: 40,    // Increased from 24 - no longer tight
        vertical: 48,      // Increased from 32 - better minimum
        rhythm: 'comfortable',
        principle: 'Comfortable minimum with proper space'
      },
      {
        name: 'Contemporary Flow',
        horizontal: 80,    // Increased from 64 - more spacious
        vertical: 104,     // Increased from 88 - modern generous spacing
        rhythm: 'flowing',
        principle: 'Contemporary generous flow'
      },
      {
        name: 'Poster Impact',
        horizontal: 96,    // Increased from 80 - dramatic impact
        vertical: 112,     // Increased from 96 - maximum breathing
        rhythm: 'impactful',
        principle: 'Poster-style dramatic spacing'
      },
      {
        name: 'Grid Precision',
        horizontal: 64,    // Increased from 48 - 4x base grid unit
        vertical: 80,      // Increased from 64 - 5x base grid unit
        rhythm: 'modular',
        principle: 'Precise modular grid with generous space'
      }
    ];
    
    // Select random spacing system
    const system = spacingSystems[Math.floor(Math.random() * spacingSystems.length)];
    
    return {
      ...system,
      // Ensure values are within reasonable bounds for the layout system
      horizontal: Math.max(24, Math.min(120, system.horizontal)),
      vertical: Math.max(24, Math.min(120, system.vertical))
    };
  }

  // Manual unified color test function
  window.testUnifiedColors = function() {
    console.log('🧪 Testing unified color palette...');
    
    // Generate a test unified scheme without image
    const testScheme = generateUnifiedColorPalette();
    
    // Apply all colors from the same palette
    $bgColor.value = testScheme.background;
    $bgHex.value = testScheme.background;
    $textColor.value = testScheme.text;
    $textHex.value = testScheme.text;
    $tagShapeColor.value = testScheme.tagBackground;
    $tagShapeHex.value = testScheme.tagBackground;
    $tagTextColor.value = testScheme.tagText;
    $tagTextHex.value = testScheme.tagText;
    
    // Trigger updates
    [$bgColor, $textColor, $tagShapeColor, $tagTextColor].forEach(input => {
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    });
    
    console.log('🎯 Applied unified scheme:', testScheme);
    
    // Force repaint
    setTimeout(() => {
      if (window.paint) {
        window.paint();
        console.log('🎨 Forced repaint with unified colors');
      }
    }, 100);
  };
  
  // Auto-test function that runs on page load
  window.autoTestUnified = function() {
    setTimeout(() => {
      console.log('🤖 Auto-testing unified color system on page load...');
      
      // Test the new unified color system
      if (window.testUnifiedColors) {
        testUnifiedColors();
      }
    }, 2000);
  };

  // Color utility functions for beautiful randomization
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;
    
    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getContrastRatio(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // Extract dominant colors from an image
  function extractImageColors(imageElement, callback) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Scale down for performance
      const maxSize = 100;
      const ratio = Math.min(maxSize / imageElement.width, maxSize / imageElement.height);
      canvas.width = imageElement.width * ratio;
      canvas.height = imageElement.height * ratio;
      
      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const colorCounts = {};
      
      // Sample every 4th pixel for performance
      for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const alpha = pixels[i + 3];
        
        // Skip transparent pixels
        if (alpha < 128) continue;
        
        // Group similar colors by rounding to nearest 20
        const roundedR = Math.round(r / 20) * 20;
        const roundedG = Math.round(g / 20) * 20;
        const roundedB = Math.round(b / 20) * 20;
        
        const colorKey = `${roundedR},${roundedG},${roundedB}`;
        colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
      }
      
      // Get top colors
      const sortedColors = Object.entries(colorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([color]) => {
          const [r, g, b] = color.split(',').map(Number);
          return rgbToHex(r, g, b);
        });
      
      callback(sortedColors);
    } catch (error) {
      console.log('Could not extract colors from image:', error);
      callback([]);
    }
  }

  // Generate palette from extracted image colors
  function generateImageBasedPalette(imageColors) {
    if (!imageColors || imageColors.length === 0) {
      return null;
    }
    
    // Sort colors by luminance to separate light and dark
    const colorsByLuminance = imageColors
      .map(color => ({ color, luminance: getLuminance(color) }))
      .sort((a, b) => a.luminance - b.luminance);
    
    // Find suitable background (very light colors)
    const lightColors = colorsByLuminance.filter(c => c.luminance > 0.8);
    const darkColors = colorsByLuminance.filter(c => c.luminance < 0.3);
    const midColors = colorsByLuminance.filter(c => c.luminance >= 0.3 && c.luminance <= 0.8);
    
    // Create palette structure with more colors for variety
    const palette = {
      name: 'From Image',
      source: 'image',
      backgrounds: lightColors.length > 0 ? lightColors.map(c => c.color) : ['#ffffff', '#f8fafc', '#f1f5f9'],
      accents: darkColors.length > 0 ? darkColors.map(c => c.color) : ['#1a1a1a', '#374151', '#475569'],
      vibrants: [
        // Use all extracted colors as vibrants for maximum variety
        ...imageColors,
        // Add some fallbacks in case image has limited colors
        ...(midColors.length > 0 ? midColors.map(c => c.color) : ['#3b82f6', '#8b5cf6', '#f59e0b'])
      ].slice(0, 6) // Keep up to 6 vibrant colors
    };
    
    console.log(`🖼️ Created image palette with ${palette.backgrounds.length} backgrounds, ${palette.accents.length} accents, ${palette.vibrants.length} vibrants`);
    
    return palette;
  }

  function generateUnifiedColorPalette(imageBasedPalette = null) {
    // If image-based palette exists, ALWAYS use it (image colors are priority)
    let palette;
    
    if (imageBasedPalette) {
      palette = imageBasedPalette;
      console.log('🎨 Using image-based color palette');
    } else {
      // Define beautiful, harmonious color palettes
      const palettes = [
      // Modern Neutral (high contrast, professional)
      { 
        name: 'Modern Neutral',
        backgrounds: ['#ffffff', '#f8fafc', '#f1f5f9'],
        accents: ['#0f172a', '#1e293b', '#334155'],
        vibrants: ['#3b82f6', '#6366f1', '#8b5cf6']
      },
      // Warm Earth (cozy, approachable)
      { 
        name: 'Warm Earth',
        backgrounds: ['#fefcfb', '#fef7f0', '#fef2f2'],
        accents: ['#7c2d12', '#9a3412', '#a16207'],
        vibrants: ['#ea580c', '#f59e0b', '#eab308']
      },
      // Cool Ocean (calm, trustworthy)
      { 
        name: 'Cool Ocean',
        backgrounds: ['#f8fafc', '#f0f9ff', '#ecfeff'],
        accents: ['#0c4a6e', '#164e63', '#155e75'],
        vibrants: ['#0284c7', '#0891b2', '#06b6d4']
      },
      // Fresh Green (nature, growth)
      { 
        name: 'Fresh Green',
        backgrounds: ['#f7fef7', '#f0fdf4', '#ecfdf5'],
        accents: ['#14532d', '#166534', '#15803d'],
        vibrants: ['#16a34a', '#22c55e', '#4ade80']
      },
      // Royal Purple (luxury, creative)
      { 
        name: 'Royal Purple',
        backgrounds: ['#fefcfe', '#faf5ff', '#f5f3ff'],
        accents: ['#581c87', '#6b21a8', '#7c3aed'],
        vibrants: ['#8b5cf6', '#a855f7', '#c084fc']
      },
      // Sunset Orange (energetic, warm)
      { 
        name: 'Sunset Orange',
        backgrounds: ['#fffbf7', '#fff7ed', '#fef2f2'],
        accents: ['#9a3412', '#c2410c', '#dc2626'],
        vibrants: ['#ea580c', '#f97316', '#fb923c']
      }
    ];
      
      // Choose a random palette
      palette = palettes[Math.floor(Math.random() * palettes.length)];
    }
    
    console.log(`🎯 Selected palette: ${palette.name}`);
    
    // Create a unified color scheme from this single palette
    return createUnifiedScheme(palette);
  }
  
  function createUnifiedScheme(palette) {
    // Randomly select base colors from the palette  
    const background = palette.backgrounds[Math.floor(Math.random() * palette.backgrounds.length)];
    const textColor = palette.accents[Math.floor(Math.random() * palette.accents.length)];
    const accent1 = palette.vibrants[Math.floor(Math.random() * palette.vibrants.length)];
    const accent2 = palette.vibrants[Math.floor(Math.random() * palette.vibrants.length)];
    
    // Ensure text contrast
    let finalTextColor = textColor;
    if (getContrastRatio(finalTextColor, background) < 4.5) {
      finalTextColor = getLuminance(background) > 0.5 ? '#0f172a' : '#ffffff';
    }
    
    // Tag gets a different vibrant color for visual interest, but text uses background for contrast
    let tagBackground = accent1;
    let tagText = background;
    
    // Verify tag contrast and fix if needed
    if (getContrastRatio(tagText, tagBackground) < 4.5) {
      tagText = getLuminance(tagBackground) > 0.5 ? '#000000' : '#ffffff';
    }
    
    const scheme = {
      // Layout colors
      background: background,
      text: finalTextColor,
      
      // Tag colors (can be different from text for visual variety)
      tagBackground: tagBackground,
      tagText: tagText,
      
      // Additional accent for potential future use
      accent: accent2,
      
      // Metadata
      palette: palette.name,
      source: palette.source || 'predefined'
    };
    
    console.log(`🎨 Unified color scheme from "${palette.name}":`, {
      bg: scheme.background,
      text: scheme.text, 
      tagBg: scheme.tagBackground,
      tagText: scheme.tagText,
      accent: scheme.accent
    });
    
    return scheme;
  }

  // Randomization function
  function randomizeLayout() {
    console.log('🚀 RANDOMIZE BUTTON CLICKED - STARTING FULL DEBUG TRACE');
    console.log('🔍 Step 1: Function entry confirmed');
    
    // Clear layout cache to ensure fresh calculations with new parameters
    layoutCache.clear();
    const randomOptions = {
      patterns: ['auto', 'top', 'side', 'left'],
      logoPositions: ['top', 'bottom'],
      logoSizes: ['s', 'm', 'l'],
      tagPositions: ['above', 'below'],
      tagSizes: ['s', 'm', 'l'],
      fontFamilies: [
        'Inter, system-ui, -apple-system, Segoe UI, Roboto',
        'Poppins, sans-serif',
        'Manrope, sans-serif',
        'Plus Jakarta Sans, sans-serif',
        'Space Grotesk, sans-serif',
        'DM Sans, sans-serif',
        'Outfit, sans-serif',
        'Sora, sans-serif'
      ],
      headerWeights: ['300', '400', '500', '600', '700', '800', '900'],
      subWeights: ['300', '400', '500', '600', '700'],
      colors: ['#1a1a1a', '#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669', '#0891b2', '#0284c7', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c026d3', '#db2777'],
      bgColors: ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#f0fdf4', '#ecfdf5', '#f0fdfa', '#ecfeff', '#f0f9ff', '#eff6ff', '#eef2ff', '#f5f3ff', '#faf5ff', '#fdf4ff', '#fef7f7']
    };

    // Randomize pattern (image layout)
    if (Math.random() > 0.3) { // 70% chance to randomize pattern
      const randomPattern = randomOptions.patterns[Math.floor(Math.random() * randomOptions.patterns.length)];
      $pattern.value = randomPattern;
    }

    // Randomize image rounded corners
    $imageRounded.checked = Math.random() > 0.5;
    // Randomize image padding behavior
    $imagePadding.value = Math.random() > 0.7 ? 'fill' : 'layout'; // 30% chance for edge-fill

    // Randomize logo position and size
    if (Math.random() > 0.4) { // 60% chance to randomize logo
      const randomLogoPos = randomOptions.logoPositions[Math.floor(Math.random() * randomOptions.logoPositions.length)];
      const randomLogoSize = randomOptions.logoSizes[Math.floor(Math.random() * randomOptions.logoSizes.length)];
      $logoPos.value = randomLogoPos;
      $logoSize.value = randomLogoSize;
    }

    // Randomize tag position and size  
    if (Math.random() > 0.4) { // 60% chance to randomize tag
      const randomTagPos = randomOptions.tagPositions[Math.floor(Math.random() * randomOptions.tagPositions.length)];
      const randomTagSize = randomOptions.tagSizes[Math.floor(Math.random() * randomOptions.tagSizes.length)];
      $tagPos.value = randomTagPos;
      $tagSize.value = randomTagSize;
    }

    // Professional Typography System
    console.log('📝 Applying professional typography rules...');
    const typographySystem = generateProfessionalTypography();
    
    // Apply font family
    $ff.value = typographySystem.fontFamily;
    
    // Apply weights with proper hierarchy (3:1 minimum contrast ratio)
    $hw.value = typographySystem.headerWeight;
    $sw.value = typographySystem.subWeight;
    
    console.log(`📝 Typography applied: ${typographySystem.name}`, {
      font: typographySystem.fontFamily,
      headerWeight: typographySystem.headerWeight,
      subWeight: typographySystem.subWeight,
      headerLetterSpacing: typographySystem.headerLetterSpacing,
      subLetterSpacing: typographySystem.subLetterSpacing,
      contrast: typographySystem.contrast
    });
    
    // Store typography for paint function to use
    window.currentTypography = {
      headerLetterSpacing: typographySystem.headerLetterSpacing,
      subLetterSpacing: typographySystem.subLetterSpacing
    };

    // Professional padding based on typography rules (1.5x-2x type size for breathing)
    console.log('📐 Applying professional spacing rules...');
    const spacingSystem = generateProfessionalSpacing();
    
    $paddingH.value = spacingSystem.horizontal;
    $paddingV.value = spacingSystem.vertical;
    
    console.log(`📐 Spacing applied: ${spacingSystem.name}`, {
      horizontal: spacingSystem.horizontal,
      vertical: spacingSystem.vertical,
      rhythm: spacingSystem.rhythm
    });

    console.log('🔍 Step 2: Reached color randomization section');
    // Always apply unified color palette for all elements
    console.log('🎨 Generating unified color palette for all elements...');
      // Try to extract colors from current image
      const tryImageBasedColors = () => {
        // Try multiple selectors to find the image
        const imageElement = document.querySelector('image') || 
                           document.querySelector('.layout-container image') ||
                           document.querySelector('svg image');
        
        console.log('🔍 Step 3: Looking for image element:', imageElement);
        
        if (imageElement && imageElement.href && imageElement.href.baseVal) {
          console.log('📸 Found image - image colors take priority, shuffling image-based palette');
          // Create temporary img element to extract colors
          const tempImg = new Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.onload = () => {
            console.log('✅ Image loaded, extracting colors...');
            extractImageColors(tempImg, (imageColors) => {
              console.log('🎨 Extracted image colors:', imageColors);
              const imageBasedPalette = generateImageBasedPalette(imageColors);
              if (imageBasedPalette) {
                console.log('🎯 Generated image-based palette:', imageBasedPalette);
              }
              const colorScheme = generateUnifiedColorPalette(imageBasedPalette);
              applyColorScheme(colorScheme);
            });
          };
          tempImg.onerror = (e) => {
            console.log('❌ Failed to load image:', e);
            // Fallback to predefined palettes
            const colorScheme = generateUnifiedColorPalette();
            applyColorScheme(colorScheme);
          };
          tempImg.src = imageElement.href.baseVal;
        } else {
          console.log('🔍 Step 4: No image found, generating new unified predefined palette');
          // No image found, use predefined unified palettes
          const colorScheme = generateUnifiedColorPalette();
          console.log('🔍 Step 5: Generated color scheme:', colorScheme);
          applyColorScheme(colorScheme);
        }
      };
      
      const applyColorScheme = (colorScheme) => {
        console.log('🔍 Step 6: Entering applyColorScheme function');
        console.log(`🎨 Applied "${colorScheme.palette}" color scheme:`, colorScheme);
        
        // ALWAYS apply all unified colors (no probability)
        console.log('🔍 Step 7: Applying background color:', colorScheme.background);
        $bgColor.value = colorScheme.background;
        $bgHex.value = colorScheme.background;

        console.log('🔍 Step 8: Applying text color:', colorScheme.text);
        $textColor.value = colorScheme.text;
        $textHex.value = colorScheme.text;

        // Apply tag colors
        console.log('🔍 Step 9: Checking tag text value:', $tagText.value);
        console.log(`🔍 Tag elements exist: tagTextColor=${!!$tagTextColor}, tagShapeColor=${!!$tagShapeColor}`);
        
        if ($tagText.value.trim()) { // Always apply tag colors if tag exists
          console.log(`🔍 BEFORE: tagTextColor=${$tagTextColor.value}, tagShapeColor=${$tagShapeColor.value}`);
          console.log(`🔍 APPLYING: tagText=${colorScheme.tagText}, tagBackground=${colorScheme.tagBackground}`);
          
          $tagTextColor.value = colorScheme.tagText;
          $tagTextHex.value = colorScheme.tagText;
          $tagShapeColor.value = colorScheme.tagBackground;
          $tagShapeHex.value = colorScheme.tagBackground;
          
          console.log(`🔍 Step 10: AFTER setting values: tagTextColor=${$tagTextColor.value}, tagShapeColor=${$tagShapeColor.value}`);
          console.log(`🏷️ Tag colors set - Background: ${colorScheme.tagBackground}, Text: ${colorScheme.tagText}`);
        } else {
          console.log('🔍 Step 10: No tag text found, skipping tag colors');
        }
        
        console.log('🔍 Step 11: Triggering all input/change events');
        // Trigger change events to make sure the UI updates
        [$bgColor, $textColor, $tagTextColor, $tagShapeColor].forEach((element, index) => {
          if (element) {
            console.log(`🔍 Triggering events for element ${index}:`, element.id);
            element.dispatchEvent(new Event('input'));
            element.dispatchEvent(new Event('change'));
          }
        });
        
        console.log('🔍 Step 12: Scheduling repaint');
        // Force immediate repaint
        setTimeout(() => {
          if (window.paint) {
            console.log('🔍 Step 13: Calling paint()');
            window.paint();
            console.log('✅ PAINT COMPLETED - unified colors should now be visible');
          } else {
            console.error('❌ window.paint function not found!');
          }
        }, 50);
      };
      
    console.log('🔍 Step 14: Calling tryImageBasedColors()');
    tryImageBasedColors();

    console.log('🔍 Step 15: Setting randomization mode');
    // Always use standard layout mode for randomization to ensure pattern selection works
    // This allows 'left', 'side', 'top' patterns to work properly
    isRandomMode = false;

    // Apply font loading if needed
    const selectedOption = $ff.options[$ff.selectedIndex];
    const fontName = selectedOption ? selectedOption.textContent : 'Inter';
    loadGoogleFont(fontName).then(() => {
      canvasCache.clear();
      paint();
    }).catch(() => {
      console.log('🔍 Step 17: Calling final paint()');
      paint();
    });
    
    console.log('🔍 Step 18: Function about to end - calling paint() to ensure update');
    paint(); // Ensure layout always updates immediately
    console.log('✅ RANDOMIZATION FUNCTION COMPLETED!');
  }

  // Debug: Check if button exists
  console.log('Looking for randomizeLayout button...');
  console.log('$randomizeLayout:', $randomizeLayout);
  if ($randomizeLayout) {
    console.log('Random button found, adding event listener');
    $randomizeLayout.addEventListener('click', randomizeLayout);
  } else {
    console.error('Random button not found!');
  }

  function paint(){
    console.log('🖌️ PAINT FUNCTION CALLED');
    // Clear layout cache to ensure new padding rules are applied
    layoutCache.clear();
    console.log('🔍 Current color values at paint time:');
    console.log('  - Background:', $bgColor.value, '/', $bgHex.value);
    console.log('  - Text:', $textColor.value, '/', $textHex.value);  
    console.log('  - Tag shape:', $tagShapeColor.value, '/', $tagShapeHex.value);
    console.log('  - Tag text:', $tagTextColor.value, '/', $tagTextHex.value);
    
    try{
      $err.textContent='';
      
      // Validate required inputs
      if (!$header.value.trim()) {
        showError('Header text is required');
        return;
      }
      
      const width = Math.max(320, parseInt($w.value||'1200',10));
      const height= Math.max(320, parseInt($h.value||'675',10));
      console.log('🎨 paint() called with:', { imageHref: imageHref ? 'HAS_IMAGE' : 'NO_IMAGE', patternChoice: $pattern.value });
      console.log('🔍 Colors being passed to renderSVG:');
      const renderParams = {
        width, height,
        header: $header.value,
        subheader: $sub.value,
        headerWeight: parseInt($hw.value||'800',10),
        subWeight: parseInt($sw.value||'400',10),
        fontFamily: $ff.value || 'Inter, system-ui, -apple-system, Segoe UI, Roboto',
        imageHref: imageHref,
        patternChoice: $pattern.value,
        imageRounded: $imageRounded.checked,
        imagePadding: $imagePadding.value,
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
        paddingH: parseInt($paddingH.value||'24',10),
        paddingV: parseInt($paddingV.value||'24',10),
        // Add typography parameters from randomization
        headerLetterSpacing: window.currentTypography?.headerLetterSpacing || '0',
        subLetterSpacing: window.currentTypography?.subLetterSpacing || '0'
      };
      
      console.log('  - tagTextColor:', renderParams.tagTextColor);
      console.log('  - tagShapeColor:', renderParams.tagShapeColor);
      console.log('  - textColor:', renderParams.textColor);
      console.log('  - bgColor:', renderParams.bgColor);
      
      const {svg, meta} = renderSVG(renderParams);

      // Store current layout
      currentSvg = svg;
      currentWidth = width;
      currentHeight = height;
      
      $wrap.innerHTML = svg;
      $wrap.style.width = width + 'px';
      $wrap.style.height = height + 'px';
      $wrap.className = ''; // Remove rounded class from container
      
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
  [$w,$h,$hw,$sw,$ff,$pattern,$imageRounded,$imagePadding,$logoPos,$logoSize,$tagPos,$tagSize,$tagTextColor,$tagTextHex,$tagShapeColor,$tagShapeHex,$paddingH,$paddingV,$bgColor,$bgHex,$textColor,$textHex,$sizePreset].forEach(n => n.addEventListener('change', paint));
  
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

  // Removed duplicate simple randomizeLayout function - using comprehensive version above

  // Random Layout Button Event Listener
  console.log('Looking for randomizeLayout button...');
  console.log('$randomizeLayout:', $randomizeLayout);
  if ($randomizeLayout) {
    console.log('Random button found, adding event listener');
    $randomizeLayout.addEventListener('click', randomizeLayout);
  } else {
    console.error('Random button not found!');
  }

  // Expose functions globally for external access
  window.paint = paint;
  
  // FORCE override of any existing randomizeLayout function
  console.log('🔧 Setting up unified randomizeLayout function (overriding any existing)');
  window.randomizeLayout = randomizeLayout;
  
  // Auto-run test to verify unified colors work on page load
  setTimeout(() => {
    console.log('🤖 Auto-testing unified color system...');
    if (window.autoTestUnified) {
      window.autoTestUnified();
    }
  }, 3000);
  
  paint();
})();