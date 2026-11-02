import * as THREE from 'three';

// Meters are design units, not a survey. Rooms and their connections are fictional.
export const INTERIOR_NOTE='공개 사진 기반 체험용 재구성 · 실제 평면·치수와 다를 수 있어요';
export const ENTRY={x:-18,z:8.5};
export const INTERIOR_BOUNDS={x1:-10,x2:10,z1:-9,z2:4};
export const INTERACTIONS=[
  {id:'exit',x:0,z:3,label:'밖으로 나가기',text:'운동장으로 돌아가요.'},
  {id:'board',x:-8.6,z:-5.4,label:'칠판에 인사 남기기',text:'함께 배우는 하루! 칠판 인사는 체험용 연출이며 저장되지 않아요.'},
  {id:'book',x:7.4,z:-5,label:'책 펼쳐 보기',text:'한 쪽씩 천천히 읽어요. 가상의 책 펼치기 체험이에요.'},
  {id:'classroom',x:-5,z:1.2,label:'교실 문 열기',text:'교실로 들어가 책상 사이를 걸어 보세요.'},
  {id:'library',x:5,z:1.2,label:'도서관 문 열기',text:'혜윰도서관 사진에서 본 목재 가구와 창가를 둘러보세요.'},
];
export function nearestInteraction(p, doors){return INTERACTIONS.filter(i=>!(doors?.[i.id]&&['classroom','library'].includes(i.id))).map(i=>({...i,d:Math.hypot(i.x-p.x,i.z-p.z)})).filter(i=>i.d<1.8).sort((a,b)=>a.d-b.d)[0]||null;}
export function createInterior(){
 const group=new THREE.Group();group.visible=false;group.name='Photo-inspired interior reconstruction';
 const boxes=[],cameraWalls=[],doors={},actions={board:false,book:false},materials=new Map();
 const mat=c=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.86}));return materials.get(c);};
 function box(x,y,z,w,h,d,c,solid=false){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));mesh.position.set(x,y,z);mesh.receiveShadow=true;group.add(mesh);if(solid){boxes.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2});cameraWalls.push(mesh);}return mesh;}
 function label(text,x,y,z,w=2){const c=document.createElement('canvas');c.width=640;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#f8f6eb';ctx.fillRect(0,0,640,160);ctx.fillStyle='#254d45';ctx.textAlign='center';ctx.font='bold 48px sans-serif';ctx.fillText(text,320,98);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);group.add(mesh);return mesh;}
 // Floor tiles: muted green/cream checker corridor, grey classroom and library.
 const tiles=new Map();
 for(let x=-10;x<10;x++)for(let z=-9;z<4;z++){
   const color=z>=0?((x+z)%2?'#909f92':'#c7bd9f'):((x+z)%2?'#b6b9b4':'#bcc0bb');
   if(!tiles.has(color))tiles.set(color,[]);tiles.get(color).push([x+.5,-.06,z+.5]);
 }
 for(const [color,positions] of tiles){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.99,.12,.99),mat(color),positions.length);positions.forEach((p,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(...p)));mesh.receiveShadow=true;group.add(mesh);}
 box(0,3.3,-2.5,20,.14,13,'#e6e4da');
 box(-10,1.6,-2.5,.18,3.2,13,'#eee9dd',true);box(10,1.6,-2.5,.18,3.2,13,'#eee9dd',true);
 box(0,1.6,-9,20,3.2,.18,'#eee9dd',true);box(0,1.6,4,20,3.2,.18,'#eee9dd',true);
 box(0,1.6,-4.5,.18,3.2,9,'#ede8dc',true);
 // 1.6m clear openings, 2.25m door leaves, high transoms beneath a 3.3m ceiling.
 for(const center of [-5,5]){
   for(const side of [-1,1]){box(center+side*2.9,1.1,0,4.2,2.2,.16,'#ede9d8',true);box(center+side*.87,1.6,0,.14,3.2,.24,'#bd9f79');}
   box(center,2.82,0,1.6,.8,.12,'#cbd7d2');box(center,2.3,0,1.8,.12,.22,'#f1e9d2');
   for(let dx=-4;dx<=4;dx+=1){if(Math.abs(dx)<1)continue;box(center+dx,2.45,.1,.06,1.1,.1,'#fff2d9');}
   const id=center<0?'classroom':'library',leaf=box(center,1.12,0,1.6,2.24,.12,'#e0d5b8');
   doors[id]={leaf,open:false,amount:0,x:center};cameraWalls.push(leaf);label(center<0?'교실':'혜윰도서관',center,2.85,.18,1.7);
 }
 label('밖으로 →',0,1.7,3.88,2).rotation.y=Math.PI;label('사진을 따라 걷는 실내 산책',0,2.65,3.87,4).rotation.y=Math.PI;
 // Cream frames, window glass and curtains observed in official classroom photos.
 for(const cx of [-7.5,-4.8,-2.1,2.5,5.2,7.9]){
   box(cx,1.95,-8.86,2.2,1.65,.04,'#aec6cc');
   for(const side of [-1,1])box(cx+side*1.12,1.95,-8.78,.07,1.8,.08,'#f0eadc');
   box(cx,1.95,-8.78,.055,1.8,.08,'#f0eadc');box(cx,1.08,-8.75,2.35,.09,.15,'#e8dfcd');
   if(cx<0)for(const side of [-1,1])for(let n=0;n<4;n++)box(cx+side*(.8+n*.08),1.96,-8.65,.07,1.8,.13,n%2?'#8d9c9d':'#a1adae');
   else for(let y=2.3;y<2.8;y+=.1)box(cx,y,-8.66,2.2,.06,.1,'#d4c8a9');
 }
 // Front board is placed on the west wall, leaving a clear presentation aisle.
 const board=box(-9.82,1.55,-5.4,.08,1.25,4.8,'#285248');
 const message=label('함께 배우는 하루',-9.74,1.6,-5.4,2.6);message.rotation.y=Math.PI/2;message.visible=false;
 box(-9.7,1.9,-2,.1,.85,1.5,'#263737');box(-9.62,1.9,-2,.02,.7,1.3,'#b6c8c0');
 function chair(x,z,c,angle=0){boxes.push({x1:x-.24,x2:x+.24,z1:z-.24,z2:z+.24});const seat=box(x,.45,z,.44,.07,.44,c);box(x+Math.sin(angle)*.2,.73,z+Math.cos(angle)*.2,Math.abs(Math.cos(angle))*.44+Math.abs(Math.sin(angle))*.06,.48,Math.abs(Math.sin(angle))*.44+Math.abs(Math.cos(angle))*.06,c);for(const dx of [-.17,.17])for(const dz of [-.17,.17])box(x+dx,.22,z+dz,.035,.44,.035,'#7d8583');return seat;}
 function table(x,z,w,d,c='#d5bf91'){box(x,.74,z,w,.07,d,c,true);for(const dx of [-w/2+.08,w/2-.08])for(const dz of [-d/2+.08,d/2-.08])box(x+dx,.36,z+dz,.045,.72,.045,'#858d89');}
 for(const x of [-6.5,-4.7,-2.9])for(const z of [-6.8,-4.8,-2.8]){table(x,z,.7,.55,'#d9cda8');chair(x+.72,z,'#83b83d',Math.PI/2);boxes.push({x1:x+.48,x2:x+.96,z1:z-.25,z2:z+.25});}
 table(5,-5,3.4,1.15);for(const x of [3.8,5,6.2])for(const z of [-6,-4]){chair(x,z,'#bf9c6d',z< -5?Math.PI:0);boxes.push({x1:x-.25,x2:x+.25,z1:z-.25,z2:z+.25});}
 table(5,-8.2,7,.55);for(const x of [2.5,5,7.5])chair(x,-7.6,'#bf9c6d');
 // Low white shelves and stylized books, with no real titles or student artifacts.
 for(const z of [-2.4,-1]){box(8.8,.65,z,1.5,1.3,.45,'#eeece1',true);for(let n=0;n<9;n++)box(8.2+n*.14,.88,z-.26,.1,.45,.22,['#b98d68','#729792','#d0b267'][n%3]);}
 const book=new THREE.Group();book.position.set(6.1,.8,-5.35);group.add(book);for(const side of [-1,1]){const page=new THREE.Mesh(new THREE.BoxGeometry(.35,.035,.5),mat('#fff4d6'));page.position.x=side*.18;book.add(page);}
 for(const x of [-7,-3,3,7])for(const z of [-6,-2,2]){const light=box(x,3.19,z,1.4,.045,.35,'#ffffff');light.material=new THREE.MeshBasicMaterial({color:'#fff8e8'});}
 for(const x of [3.8,6.2]){box(x,2.9,-5,.02,.65,.02,'#565854');const shade=new THREE.Mesh(new THREE.ConeGeometry(.22,.16,16,1,true),mat('#454c4a'));shade.position.set(x,2.56,-5);group.add(shade);}
 const ambient=new THREE.AmbientLight('#fff3d9',.9);group.add(ambient);const fill=new THREE.PointLight('#f0f7ff',35,25);fill.position.set(0,2.8,-3);group.add(fill);const daylight=new THREE.DirectionalLight('#edf5ff',1.2);daylight.position.set(-4,3,-6);group.add(daylight);
 const marker=new THREE.Mesh(new THREE.RingGeometry(.4,.46,32),new THREE.MeshBasicMaterial({color:'#e3be66',side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.y=.02;group.add(marker);
 return {group,doors,actions,cameraWalls,marker,world(){return{bounds:INTERIOR_BOUNDS,boxes:[...boxes,...Object.values(doors).filter(d=>d.amount<.95).map(d=>({x1:d.x-.8,x2:d.x+.8,z1:-.1,z2:.1}))]};},interact(id){if(doors[id])doors[id].open=true;if(id==='board'){actions.board=!actions.board;message.visible=actions.board;return actions.board?'칠판에 인사를 남겼어요. 체험 중에만 보여요.':'칠판을 지웠어요.';}if(id==='book'){actions.book=!actions.book;book.userData.open=actions.book;return actions.book?'책을 펼쳤어요. 가상의 읽기 체험이에요.':'책을 덮었어요.';}},update(dt,reduced){for(const d of Object.values(doors)){d.amount=reduced?Number(d.open):Math.min(1,d.amount+(d.open?dt*2:0));d.leaf.position.x=d.x+d.amount*1.7;d.leaf.visible=d.amount<1;}const desired=book.userData.open?.55:0;book.children.forEach((p,i)=>p.rotation.z+=(desired*(i?1:-1)-p.rotation.z)*(reduced?1:Math.min(1,dt*8)));}};
}
