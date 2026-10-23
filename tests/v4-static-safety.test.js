import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html'),js=read('src/main.js');
test('no HTML string injection sinks remain in production script',()=>{assert.doesNotMatch(js,/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\(/);});
test('school official links are not emitted into public UI',()=>{assert.doesNotMatch(html,/href=["'][^"']*(?:goeujb|schoolinfo)/);assert.doesNotMatch(js,/\.href\s*=\s*(?:q\.sourceURL|source\.url)/);});
test('no app persistence, analytics or new network API introduced',()=>{assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket|gtag\(|analytics/);});
test('outbound HTML links use noopener noreferrer and feedback goes to known repo',()=>{for(const [,attrs]of html.matchAll(/<a\b([^>]+)>/g)){if(/target="_blank"/.test(attrs))assert.match(attrs,/rel="[^"]*noopener noreferrer/);}assert.match(html,/https:\/\/github\.com\/techkwon\/howon-chiikawa-walk\/issues/);});
test('initial simple mode and start disabled reason are explicit',()=>{assert.match(js,/let compactHUD=true/);assert.match(html,/id="explore-start"[^>]*aria-describedby="start-hint"[^>]*disabled/);assert.match(html,/id="start-hint"/);});
test('confirmed publication period and private testing plan are explicit',()=>{assert.match(html,/2026-10-31까지/);assert.match(html,/Asia\/Seoul/);assert.match(html,/2026-11-01부터 비공개 기술 테스트만/);assert.doesNotMatch(html,/운영 기간 ○○|종료일.*미정/);});
test('Korean display names and work title are consistent while IDs and URLs stay stable',()=>{
 for(const p of ['index.html','src/main.js','src/guide-dialogue.js','src/school-quiz.js','README.md','LICENSE','CREDITS.md','public/site.webmanifest']) assert.doesNotMatch(read(p),/치이카와|하치와레|우사기/);
 for(const name of ['햄스터','가르마','토끼']){assert.ok(html.includes(name));assert.ok(read('src/guide-dialogue.js').includes(name));}
 assert.match(html,/<title>[^<]*먼작귀/);assert.match(html,/먼작귀·학교 공식 아님/);
 for(const id of ['chiikawa','hachiware','usagi']) assert.ok(html.includes('data-guide="'+id+'"'));
 assert.match(html,/https:\/\/techkwon.github.io\/howon-chiikawa-walk\//);
});
