import * as THREE from 'three';

// Original procedural fan-art. All geometry is authored here; no downloaded assets.
const sphere = new THREE.SphereGeometry(1, 28, 20);
const materials = new Map();
function material(color, roughness = .83) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(color);
}
const C = { white: '#fffaf0', blue: '#72b8e7', cream: '#ffe3a0', ink: '#312e32', pink: '#f7a6ad', inner: '#ffc5b9' };
function blob(parent, color, position, scale) {
  const mesh = new THREE.Mesh(sphere, material(color));
  mesh.position.set(...position); mesh.scale.set(...scale);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function stroke(parent, points, color = C.ink, radius = .018) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), material(color));
  parent.add(mesh); return mesh;
}
function triangleEar(parent, side) {
  const pivot = new THREE.Group(); pivot.position.set(side * .59, 2.18, -.015); parent.add(pivot);
  const shape = new THREE.Shape();
  shape.moveTo(-.25, 0); shape.quadraticCurveTo(-.18, .28, -.04, .53);
  shape.quadraticCurveTo(0, .58, .055, .5); shape.lineTo(.25, 0); shape.closePath();
  const ear = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .20, bevelEnabled: true, bevelThickness: .075, bevelSize: .06, bevelSegments: 3, steps: 1 }), material(C.blue));
  ear.position.z = -.10; ear.castShadow = true; pivot.add(ear);
  const inner = new THREE.Shape(); inner.moveTo(-.125,.10); inner.lineTo(0,.40); inner.lineTo(.13,.10); inner.closePath();
  const pink = new THREE.Mesh(new THREE.ShapeGeometry(inner), material(C.white)); pink.position.z = .183; pivot.add(pink);
  pivot.rotation.z = -side * .13; return pivot;
}
function roundEar(parent, side, rabbit, color) {
  const pivot = new THREE.Group(); pivot.position.set(side * (rabbit ? .39 : .62), rabbit ? 2.20 : 2.15, -.02); parent.add(pivot);
  blob(pivot, color, [0, rabbit ? .42 : .13, 0], rabbit ? [.185,.62,.17] : [.245,.265,.20]);
  blob(pivot, C.inner, [0,rabbit ? .45 : .16,rabbit ? .151 : .177], rabbit ? [.087,.43,.032] : [.13,.145,.026]);
  pivot.rotation.z = -side * (rabbit ? .09 : .24); return pivot;
}

/** Feet rest at y=0, face points toward +Z. Parent may scale/rotate freely. */
export function createCharacter(kind = 'chiikawa') {
  const key = String(kind).toLowerCase();
  const type = /hachi|하치/.test(key) ? 'hachiware' : /usagi|우사/.test(key) ? 'usagi' : 'chiikawa';
  const rabbit = type === 'usagi'; const cat = type === 'hachiware';
  const root = new THREE.Group(); root.name = { chiikawa:'Chiikawa',hachiware:'Hachiware',usagi:'Usagi' }[type];
  const rig = new THREE.Group(); root.add(rig);
  const color = rabbit ? C.cream : C.white;
  blob(rig, color, [0,.72,0], [.53,.62,.38]);
  // Soft belly, little hands, and independently pivoting legs.
  blob(rig, rabbit ? '#fff0c7' : '#ffffff', [0,.72,.302], [.36,.42,.105]);
  const legs = [-1,1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side*.25,.28,0); rig.add(pivot);
    blob(pivot, color, [0,-.10,.06], [.20,.18,.27]); return pivot;
  });
  const arms = [-1,1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side*.47,1.01,0); rig.add(pivot);
    blob(pivot,color,[side*.055,-.22,.01],[.17,.30,.18]); pivot.rotation.z = side*.16; return pivot;
  });
  const tail = blob(rig, cat ? C.blue : color, [0,.57,-.39], cat ? [.17,.30,.17] : [.22,.22,.20]);
  if (cat) { tail.rotation.x = -.55; tail.position.z = -.48; }
  const head = new THREE.Group(); rig.add(head);
  blob(head,cat ? C.blue : color,[0,1.69,0],[.89,.76,.63]);
  if (cat) {
    // White lower face overlaps the blue crown, with a central blaze.
    blob(head,C.white,[0,1.53,.125],[.844,.585,.553]);
    blob(head,C.white,[0,1.92,.34],[.24,.34,.26]);
  }
  const ears = [-1,1].map(side => cat ? triangleEar(head,side) : roundEar(head,side,rabbit,color));
  // Glossy black eyes, with two deliberate catchlights per eye.
  for (const side of [-1,1]) {
    const x = side*.30;
    blob(head,C.ink,[x,1.73,.601],[.098,rabbit?.14:.125,.065]);
    blob(head,'#ffffff',[x-.025,1.778,.659],[.031,.039,.014]);
    blob(head,'#fff7d9',[x+.031,1.696,.66],[.013,.016,.008]);
    blob(head,C.pink,[side*.55,1.49,.516],[.145,.075,.024]);
    for(let i=0;i<3;i++) stroke(head,[[side*(.49+i*.052),1.51,.546],[side*(.48+i*.052),1.465,.55]],'#df8390',.008);
  }
  // Rounded little nose and a W-shaped smile, not a flat texture.
  blob(head,C.ink,[0,1.568,.649],[.033,.024,.019]);
  if (rabbit) {
    blob(head,C.ink,[0,1.40,.625],[.17,.115,.035]);
    blob(head,'#f38d93',[0,1.365,.657],[.101,.049,.012]);
    stroke(head,[[-.18,1.47,.629],[-.105,1.43,.655],[0,1.49,.662],[.105,1.43,.655],[.18,1.47,.629]],C.ink,.019);
    for(const side of [-1,1]) {
      stroke(head,[[side*.67,1.59,.45],[side*.79,1.63,.395]],C.ink,.012);
      stroke(head,[[side*.68,1.53,.45],[side*.81,1.53,.385]],C.ink,.012);
    }
  } else {
    stroke(head,[[-.135,1.485,.633],[-.095,1.445,.654],[-.045,1.455,.664],[0,1.505,.666],[.045,1.455,.664],[.095,1.445,.654],[.135,1.485,.633]],C.ink,.017);
    if(cat) for(const side of [-1,1]) {
      stroke(head,[[side*.66,1.61,.47],[side*.80,1.65,.37]],C.ink,.012);
      stroke(head,[[side*.68,1.54,.47],[side*.82,1.54,.36]],C.ink,.012);
    }
  }
  root.userData.character = { type, rig, head, arms, legs, ears, earRest:ears.map(e=>e.rotation.z), tail };
  root.userData.kind = type;
  return root;
}

/** Animates only the internal rig; never overwrites the caller's world transform. */
export function animateCharacter(group, { time = 0, walking = false, speed = 1, mood = 'happy' } = {}) {
  const data = group.userData.character; if (!data) return;
  const t = Number.isFinite(time) ? time : 0;
  const moving = !!walking; const phase = t * (7.5 + Math.min(Math.abs(speed), 5)*1.1);
  const stride = moving ? Math.sin(phase) : 0;
  data.rig.position.y = moving ? Math.abs(Math.sin(phase))*.055 : Math.sin(t*2.3)*.012;
  data.rig.rotation.z = moving ? Math.sin(phase)*.025 : Math.sin(t*1.2)*.009;
  data.legs[0].rotation.x = stride*.44; data.legs[1].rotation.x = -stride*.44;
  data.arms.forEach((arm,i)=> { const side=i===0?-1:1; arm.rotation.x = stride*side*.36; arm.rotation.z=side*.16+(mood==='excited'?side*(.5+Math.sin(t*8)*.18):0); if(mood==='greet' && i===1) arm.rotation.z=2.4+Math.sin(t*7)*.22; });
  data.ears.forEach((ear,i)=> { ear.rotation.z=data.earRest[i]+Math.sin((moving?phase:t*2.1)+i)* (moving?.055:.018); ear.rotation.x=moving?Math.sin(phase+.7)*.045:0; });
  data.head.rotation.y = moving ? Math.sin(phase*.5)*.025 : Math.sin(t*.65)*(mood==='look'?.22:.045);
  data.tail.rotation.z = Math.sin(t*(moving?7:2))*.12;
}
