import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const site = 'https://techkwon.github.io/howon-chiikawa-walk/';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
const manifest = JSON.parse(fs.readFileSync(new URL('../public/site.webmanifest', import.meta.url), 'utf8'));
const tags = [...head.matchAll(/<(meta|link)\b([^>]+)>/g)].map(([, tag, attrs]) => ({
  tag,
  ...Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])),
}));
const meta = key => tags.find(tag => tag.tag === 'meta' && (tag.name === key || tag.property === key))?.content;
const link = rel => tags.find(tag => tag.tag === 'link' && tag.rel === rel)?.href;
const title = head.match(/<title>([^<]+)<\/title>/)?.[1];
const publicFile = href => {
  const url = new URL(href, site);
  assert.equal(url.origin, new URL(site).origin);
  assert.ok(url.pathname.startsWith(new URL(site).pathname), `${url.href} must retain the GitHub Pages project path`);
  return new URL(`../public/${url.pathname.slice(new URL(site).pathname.length)}`, import.meta.url);
};

test('document metadata preserves Korean, device scaling, and an explicit fan-project identity', () => {
  assert.match(html, /<html\s+lang="ko">/);
  assert.equal(tags.find(tag => tag.charset)?.charset, 'UTF-8');
  assert.match(meta('viewport'), /width=device-width/);
  assert.match(meta('viewport'), /initial-scale=1\.0/);
  assert.doesNotMatch(meta('viewport'), /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/);
  assert.match(title, /호원 산책/);
  assert.match(title, /비공식 팬/);
  assert.match(meta('description'), /비공식 팬/);
  assert.match(meta('description'), /공식 서비스가 아닙니다/);
  assert.match(meta('robots'), /\bindex\b/);
  assert.doesNotMatch(meta('robots'), /noindex|nofollow/);
});

test('canonical and share metadata consistently use the real public project URL', () => {
  assert.equal(link('canonical'), site);
  assert.equal(meta('og:url'), site);
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:locale'), 'ko_KR');
  assert.equal(meta('og:title'), title);
  assert.equal(meta('twitter:title'), title);
  assert.equal(meta('og:description'), meta('description'));
  assert.equal(meta('twitter:description'), meta('description'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  for (const key of ['description', 'og:url', 'og:title', 'og:description', 'og:image', 'twitter:card']) {
    assert.equal(tags.filter(tag => tag.name === key || tag.property === key).length, 1, `${key} must be unique`);
  }
});

test('social cards reference the existing PNG and report its real pixel dimensions', () => {
  assert.equal(meta('og:image'), `${site}guide-friends.png`);
  assert.equal(meta('twitter:image'), meta('og:image'));
  assert.equal(meta('og:image:type'), 'image/png');
  const png = fs.readFileSync(publicFile(meta('og:image')));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(Number(meta('og:image:width')), png.readUInt32BE(16));
  assert.equal(Number(meta('og:image:height')), png.readUInt32BE(20));
  assert.match(meta('og:image:alt'), /팬 3D 캐릭터/);
  assert.equal(meta('twitter:image:alt'), meta('og:image:alt'));
});

test('favicon and linked manifest resolve inside the deployed subdirectory', () => {
  const favicon = tags.find(tag => tag.rel === 'icon');
  assert.equal(favicon.type, 'image/svg+xml');
  assert.equal(favicon.sizes, 'any');
  const svg = fs.readFileSync(publicFile(favicon.href), 'utf8');
  assert.match(svg, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(svg, /<title[^>]*>[^<]+<\/title>/);
  assert.doesNotMatch(svg, /<script|<foreignObject|\son\w+=|(?:href|src)="https?:/i);
  assert.ok(fs.existsSync(publicFile(link('manifest'))));
});

test('manifest launches within the project and does not claim offline or fullscreen capabilities', () => {
  assert.equal(new URL(manifest.id, site).href, site);
  assert.equal(new URL(manifest.start_url, site).href, site);
  assert.equal(new URL(manifest.scope, site).href, site);
  assert.equal(manifest.lang, 'ko-KR');
  assert.equal(manifest.display, 'browser');
  assert.match(manifest.description, /비공식 팬/);
  assert.equal(manifest.theme_color, meta('theme-color'));
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) {
    const iconUrl = new URL(icon.src, new URL(link('manifest'), site));
    assert.ok(fs.existsSync(publicFile(iconUrl.href)));
    assert.equal(icon.type, 'image/svg+xml');
    assert.equal(icon.sizes, 'any');
    assert.equal(icon.purpose, 'any');
  }
});

test('crawler files list only the canonical page and do not fabricate update dates', () => {
  const robots = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/howon-chiikawa-walk\/$/m);
  assert.ok(robots.includes(`Sitemap: ${site}sitemap.xml`));
  assert.doesNotMatch(robots, /^Disallow:\s*\//m);
  const sitemap = fs.readFileSync(publicFile(link('sitemap')), 'utf8');
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc), [site]);
  assert.doesNotMatch(sitemap, /<lastmod>|<changefreq>|<priority>/);
});

test('structured data describes the fan website rather than impersonating the school', () => {
  const script = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const data = JSON.parse(script);
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data['@type'], 'WebSite');
  assert.equal(data.url, site);
  assert.equal(data.inLanguage, 'ko-KR');
  assert.match(data.description, /비공식 팬/);
  assert.match(data.description, /공식 서비스가 아닙니다/);
  assert.equal(data.publisher, undefined);
  assert.equal(data.aggregateRating, undefined);
});
