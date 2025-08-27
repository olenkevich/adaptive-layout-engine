import { renderSVG } from './svg-renderer.js';

const q = id => document.getElementById(id);

export class UIController {
  constructor() {
    this.imageHref = '';
    this.logoHref = '';
    this.initElements();
    this.initEventListeners();
    this.paint();
  }

  initElements() {
    this.$w = q('w');
    this.$h = q('h');
    this.$header = q('header');
    this.$sub = q('subheader');
    this.$hw = q('hw');
    this.$sw = q('sw');
    this.$ff = q('ff');
    this.$wrap = q('wrap');
    this.$err = q('err');
    this.$meta = q('meta');
    this.$imgUrl = q('imgUrl');
    this.$imgFile = q('imgFile');
    this.$clearImg = q('clearImg');
    this.$pattern = q('pattern');
    this.$logoUrl = q('logoUrl');
    this.$logoFile = q('logoFile');
    this.$clearLogo = q('clearLogo');
    this.$logoPos = q('logoPos');
    this.$logoSize = q('logoSize');
    this.$bgColor = q('bgColor');
    this.$bgHex = q('bgHex');
    this.$textColor = q('textColor');
    this.$textHex = q('textHex');
    this.$viewport = q('viewport');
  }

  initEventListeners() {
    // Color input synchronization
    this.syncColorInputs(this.$bgColor, this.$bgHex);
    this.syncColorInputs(this.$textColor, this.$textHex);

    // Image handling
    this.$imgFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.imageHref = String(ev.target.result);
        this.$imgUrl.value = this.imageHref;
        this.paint();
      };
      reader.readAsDataURL(file);
    });

    this.$imgUrl.addEventListener('input', () => {
      this.imageHref = this.$imgUrl.value.trim();
      this.paint();
    });

    this.$clearImg.addEventListener('click', () => {
      this.imageHref = '';
      this.$imgUrl.value = '';
      this.$imgFile.value = '';
      this.paint();
    });

    // Logo handling
    this.$logoFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.logoHref = String(ev.target.result);
        this.$logoUrl.value = this.logoHref;
        this.paint();
      };
      reader.readAsDataURL(file);
    });

    this.$logoUrl.addEventListener('input', () => {
      this.logoHref = this.$logoUrl.value.trim();
      this.paint();
    });

    this.$clearLogo.addEventListener('click', () => {
      this.logoHref = '';
      this.$logoUrl.value = '';
      this.$logoFile.value = '';
      this.paint();
    });

    // General input/change listeners
    const allInputs = [
      this.$w, this.$h, this.$header, this.$sub, this.$hw, this.$sw, this.$ff,
      this.$imgUrl, this.$pattern, this.$logoUrl, this.$logoPos, this.$logoSize,
      this.$bgColor, this.$bgHex, this.$textColor, this.$textHex
    ];

    ['input', 'change'].forEach(eventType => {
      allInputs.forEach(input => {
        input.addEventListener(eventType, () => this.paint());
      });
    });

    // Window resize listener
    window.addEventListener('resize', () => this.paint());
  }

  syncColorInputs(colorInput, hexInput) {
    const updateFromPicker = () => {
      hexInput.value = colorInput.value;
      this.paint();
    };

    const updateFromHex = () => {
      const value = hexInput.value.trim().toLowerCase();
      const validHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : '#111111';
      hexInput.value = validHex;
      colorInput.value = validHex;
      this.paint();
    };

    colorInput.addEventListener('input', updateFromPicker);
    hexInput.addEventListener('input', updateFromHex);
  }

  paint() {
    try {
      this.$err.textContent = '';
      console.log('Paint method called');
      
      const width = Math.max(320, parseInt(this.$w.value || '1200', 10));
      const height = Math.max(320, parseInt(this.$h.value || '675', 10));
      console.log('Dimensions:', width, height);

      const { svg, meta } = renderSVG({
        width,
        height,
        header: this.$header.value,
        subheader: this.$sub.value,
        headerWeight: parseInt(this.$hw.value || '800', 10),
        subWeight: parseInt(this.$sw.value || '400', 10),
        fontFamily: this.$ff.value || 'Inter, system-ui, -apple-system, Segoe UI, Roboto',
        imageHref: this.imageHref || (this.$imgUrl.value.trim() || ''),
        patternChoice: this.$pattern.value,
        logoHref: this.logoHref || (this.$logoUrl.value.trim() || ''),
        logoPos: this.$logoPos.value,
        logoSize: this.$logoSize.value,
        textColor: this.$textHex.value,
        bgColor: this.$bgHex.value
      });

      // Update SVG display
      this.$wrap.style.width = width + 'px';
      this.$wrap.style.height = height + 'px';
      this.$wrap.innerHTML = svg;

      // Scale to fit viewport
      const viewWidth = this.$viewport.clientWidth - 32;
      const viewHeight = this.$viewport.clientHeight - 32;
      const scale = Math.min(1, viewWidth / width, viewHeight / height);
      this.$wrap.style.transform = `scale(${scale})`;

      // Update meta information
      const pattern = meta.pattern;
      const imgInfo = meta.imgBox ? ` — image ${pattern} ${meta.imgBox.w}×${meta.imgBox.h}px` : ' — no image';
      const logoInfo = meta.logoBox ? ` — logo ${this.$logoPos.value} ${meta.logoBox.w}×${meta.logoBox.h}px` : ' — no logo';
      
      this.$meta.textContent = `${width}×${height}px — header ${meta.headerSize}px — sub ${meta.subSize}px — padding ${meta.padding}px — img-text gap ${meta.imgTextGap}px${imgInfo}${logoInfo}`;
      
    } catch (error) {
      this.$err.textContent = String(error && error.message || error);
      console.error(error);
    }
  }
}