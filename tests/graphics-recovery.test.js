import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('context loss keeps a modal recovery notice until explicit reload, including Escape and repeated loss',()=>{
 const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 let handler,cancel,reloads=0,resets=0,focus=0,opens=0;
 const dialog={open:false,showModal(){this.open=true;opens++;},addEventListener(_,fn){cancel=fn;}};
 const button={focus(){focus++;}};
 const c={paused:false,input:{reset(){resets++;}},syncPauseUI(){},audio:{suspend(){}},canvas:{addEventListener(_,fn){handler=fn;}},$:id=>id==='#graphics-error'?dialog:button,location:{reload(){reloads++;}}};
 for(const line of source.split('\n').filter(x=>x.startsWith("canvas.addEventListener('webglcontextlost'")||x.startsWith("$('#graphics-error').addEventListener")||x.startsWith("$('#graphics-reload').onclick")))vm.runInNewContext(line,c);
 const event=new Event('webglcontextlost',{cancelable:true});handler(event);handler(event);
 assert.equal(event.defaultPrevented,true);assert.equal(c.paused,true);assert.equal(resets,2);assert.equal(dialog.open,true);assert.equal(opens,1);assert.equal(focus,2);assert.equal(reloads,0);
 const escape=new Event('cancel',{cancelable:true});cancel(escape);assert.equal(escape.defaultPrevented,true);assert.equal(dialog.open,true);
 button.onclick();assert.equal(reloads,1);
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/진행은 저장되지 않아 처음부터 시작해요/);
});
