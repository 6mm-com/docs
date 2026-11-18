import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function readScopedTocCss() {
  const css = await readFile(new URL('../../fern/styles.css', import.meta.url), 'utf8');
  const scoped = css.match(/\/\* toc-motion-scope:start[\s\S]*?\/\* toc-motion-scope:end \*\//)?.[0];
  assert.ok(scoped, 'TOC motion overrides not found in fern/styles.css');
  return scoped;
}

export function sampleTocMotion(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#fern-toc .toc-root[data-toc-measured]');
    const spans = [...root.querySelectorAll('.toc-fill, .toc-connector-fill')];
    const props = ['--toc-fill-top', '--toc-fill-bottom'];
    const transitions = () => root.getAnimations({ subtree: true }).filter(a => props.includes(a.transitionProperty));
    const clipPaths = () => spans.map(span => getComputedStyle(span).clipPath);
    const original = props.map(prop => root.style.getPropertyValue(prop));
    // Start each variant at the same endpoint, even when a scroll reset
    // itself started another transition.
    transitions().forEach(animation => animation.finish());
    const initial = clipPaths();
    props.forEach((prop, i) => root.style.setProperty(prop, `${parseFloat(original[i]) + 56 + i * 18}px`));
    const updated = clipPaths();
    const active = transitions();
    const owners = [...new Set(active.map(animation => animation.effect.target.classList[0]))].sort();
    active.forEach(animation => animation.pause());
    try {
      if (active.some(animation => animation.effect.getTiming().duration !== 250)) throw new Error('Unexpected TOC duration');
      return { owners, frames: active.length ? [0, 40, 100, 165, 249].map(time => {
        active.forEach(animation => { animation.currentTime = time; });
        return clipPaths();
      }) : [initial, updated] };
    } finally {
      active.forEach(animation => animation.finish());
      props.forEach((prop, i) => root.style.setProperty(prop, original[i]));
      clipPaths();
      transitions().forEach(animation => animation.finish());
    }
  });
}
