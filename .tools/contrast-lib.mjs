/**
 * Contrast harness. REPORT_BODY is a browser-side function body; it is emitted to
 * dist/contrast.js and injected with page.addScriptTag, then run per route:
 *
 *   node .tools/contrast-lib.mjs emit      // writes dist/contrast.js
 *   window.__contrast()                    // -> { judged, barePhoto, fails, skips }
 *
 * Deliberately conservative about photographs: a text painted over a photo is
 * judged against the worst case the photo can be (white if the type is light,
 * black if it is dark), because a screenshot of one day's image proves nothing
 * about the next. A scrim is only credited when it really covers the glyphs.
 */
export const REPORT_BODY = String.raw`
  const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = (r, g, b) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
  const parse = (s) => { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
  const alphaOf = (s) => (s.indexOf('rgba') === 0 ? Number(/rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)/.exec(s)[1]) : 1);
  const ratio = (a, b) => { const [l1, l2] = [lum(...a), lum(...b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const over = (fg, bg) => { const a = fg[3] == null ? 1 : fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };

  function scrimAt(grad, f) {
    const stops = [...grad.matchAll(/rgba?\(([^)]+)\)([^,;)]*)/g)].map((m) => {
      const c = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      const pct = /(\d+(?:\.\d+)?)%/.exec(m[2] || '');
      return { c: [c[0], c[1], c[2], c.length > 3 ? c[3] : 1], at: pct ? Number(pct[1]) / 100 : null };
    });
    if (!stops.length) return null;
    stops.forEach((s, i) => { if (s.at == null) s.at = stops.length === 1 ? 0 : i / (stops.length - 1); });
    if (f <= stops[0].at) return stops[0].c;
    for (let i = 1; i < stops.length; i++) {
      if (f <= stops[i].at) {
        const a = stops[i - 1], b = stops[i];
        const k = b.at === a.at ? 0 : (f - a.at) / (b.at - a.at);
        return a.c.map((v, j) => v + (b.c[j] - v) * k);
      }
    }
    return stops[stops.length - 1].c;
  }

  const covers = (layer, t) => {
    const r = layer.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2 && r.left <= t.left + 1 && r.top <= t.top + 1 && r.right >= t.right - 1 && r.bottom >= t.bottom - 1;
  };

  function scrimOf(node, t) {
    const self = node.matches('.media-scrim, .media-scrim-flat') ? node : node.querySelector('.media-scrim, .media-scrim-flat');
    if (!self) return null;
    const bi = getComputedStyle(self).backgroundImage;
    if (!/gradient/.test(bi)) return null;
    const r = self.getBoundingClientRect();
    const f = 1 - Math.min(1, Math.max(0, (t.top + t.height / 2 - r.top) / Math.max(r.height, 1)));
    const s = scrimAt(bi, f);
    return s ? over(s, [255, 255, 255, 1]) : null; // photograph worst-cased as sky
  }

  /** A media layer painted beside the text, in the same parent. */
  function siblingLayer(node, child, t) {
    let scrim = null, photo = false;
    for (const c of node.children) {
      if (c === child || c.contains(t.el) || !covers(c, t)) continue;
      const s = scrimOf(c, t);
      if (s) scrim = s;
      else if (c.tagName === 'IMG' || c.querySelector('img')) photo = true;
    }
    return scrim || photo ? { scrim, photo } : null;
  }

  function backdrop(el) {
    const t = el.getBoundingClientRect();
    t.el = el;
    // stack[0] is the topmost layer, so the walk pushes each level's children
    // before that level's own background, and starts at the text's own element.
    const stack = [];
    let node = el, child = null, barePhoto = false;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const sib = siblingLayer(node, child, t);
      if (sib) {
        if (sib.scrim) stack.push(sib.scrim);
        if (sib.photo && !sib.scrim) { barePhoto = true; break; }
      }
      const bi = cs.backgroundImage;
      if (bi && bi !== 'none') {
        const r = node.getBoundingClientRect();
        const s = /gradient/.test(bi) ? scrimAt(bi, 1 - Math.min(1, Math.max(0, (t.top + t.height / 2 - r.top) / Math.max(r.height, 1)))) : null;
        if (s) stack.push(over(s, [255, 255, 255, 1]));
        else {
          if (node.tagName === 'IMG' || node.querySelector('img')) barePhoto = true;
          break;
        }
      }
      const own = cs.backgroundColor;
      if (own !== 'rgba(0, 0, 0, 0)') stack.push([...parse(own), alphaOf(own)]);
      child = node;
      node = node.parentElement;
    }
    const fg = parse(getComputedStyle(el).color);
    // Behind a photograph the colour is unknown, so take the worst case: white sky
    // behind light type, shadow behind dark type. Everywhere else the page is white.
    let out = barePhoto ? (lum(...fg) > 0.18 ? [255, 255, 255, 1] : [0, 0, 0, 1]) : [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return { rgb: out.slice(0, 3), overPhoto: barePhoto };
  }

  const fades = (el) => { for (let a = el; a && a !== document.documentElement; a = a.parentElement) if (Number(getComputedStyle(a).opacity) < 0.5) return true; return false; };

  const fails = [], seen = new Set();
  let judged = 0, overPhoto = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    if (text.length < 2) continue;
    const el = n.parentElement;
    if (!el || el.closest('[aria-hidden=true], template, noscript')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || fades(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight);
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const bg = backdrop(el);
    judged++;
    if (bg.overPhoto) overPhoto++;
    const cr = ratio(over(parse(cs.color), bg.rgb).slice(0, 3), bg.rgb);
    if (cr < need) {
      const key = el.className + '|' + text.slice(0, 28);
      if (seen.has(key)) continue;
      seen.add(key);
      fails.push({ text: text.slice(0, 40), size, weight, need, got: +cr.toFixed(2), sel: String(el.className || el.tagName).slice(0, 58) });
    }
  }
  return { url: location.hash, judged, overPhoto, fails };
`;

if (process.argv[2] === 'emit') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('dist/contrast.js', 'window.__contrast = function () {' + REPORT_BODY + '};\n');
  console.log('dist/contrast.js emitted');
}
