export function createMeasure(fontFamily, weight) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  return (fontSize, text) => {
    ctx.font = String(weight) + ' ' + fontSize + 'px ' + fontFamily;
    return ctx.measureText(text).width;
  };
}

export function wrapNoBreak(measure, fontSize, text, maxWidth) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], tooWide: false };
  
  const lines = [];
  let line = '';
  let tooWide = false;

  for (let word of words) {
    if (measure(fontSize, word) > maxWidth) {
      tooWide = true;
    }
    
    const candidate = line ? line + ' ' + word : word;
    if (measure(fontSize, candidate) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  
  if (line) lines.push(line);
  return { lines, tooWide };
}