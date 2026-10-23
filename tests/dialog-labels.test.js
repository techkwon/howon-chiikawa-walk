import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('every dialog has an explicit accessible name referencing existing text',()=>{for(const [,attrs] of html.matchAll(/<dialog\b([^>]*)>/g)){const ref=attrs.match(/aria-labelledby="([^"]+)"/);assert.ok(ref,attrs);for(const id of ref[1].split(/\s+/))assert.ok(html.includes(`id="${id}"`));}});
