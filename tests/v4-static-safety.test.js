import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html'),js=read('src/main.js');
test('no HTML string injection sinks remain in production script',()=>{assert.doesNotMatch(js,/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\(/);});
test('school official links are not emitted into public UI',()=>{assert.doesNotMatch(html,/href=["'][^"']*(?:goeujb|schoolinfo)/);assert.doesNotMatch(js,/\.href\s*=\s*(?:q\.sourceURL|source\.url)/);});
test('no app persistence, analytics or new network API introduced',()=>{assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket|gtag\(|analytics/);});
test('outbound HTML links use noopener noreferrer and feedback goes to known repo',()=>{for(const [,attrs]of html.matchAll(/<a\b([^>]+)>/g)){if(/target="_blank"/.test(attrs))assert.match(attrs,/rel="[^"]*noopener noreferrer/);}assert.match(html,/https:\/\/github\.com\/techkwon\/howon-chiikawa-walk\/issues/);});
test('initial simple mode and start disabled reason are explicit',()=>{assert.match(js,/let compactHUD=true/);assert.match(html,/id="explore-start"[^>]*aria-describedby="start-hint"[^>]*disabled/);assert.match(html,/id="start-hint"/);});
test('operation end date is honest and not a fabricated deadline',()=>{assert.match(html,/운영 종료일 미정/);assert.doesNotMatch(html,/운영 기간 ○○|운영 종료일 20\d\d/);});
