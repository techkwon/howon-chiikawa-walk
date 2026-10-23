// Hand-authored exterior paths in Three.js coordinates (x, y-up, z).
// Avoids classroom blocks, annex, tree trunks and canopy posts. Not a real route map.
export const NODES={field:[31,20],fieldN:[31,-20],junction:[9,20],south:[-18,20],school:[-18,9],gardenGate:[-28,20],annex:[-28,36],walkway:[8,-20],north:[9,-44],fieldE:[46,25]};
export const EDGES=[['field','junction'],['field','fieldN'],['field','fieldE'],['junction','south'],['south','school'],['south','gardenGate'],['gardenGate','annex'],['junction','walkway'],['walkway','north'],['north','fieldN']];
export const PLACES={field:{node:'field',label:'운동장',icon:'⚑'},walkway:{node:'walkway',label:'지붕 통로',icon:'⌒'},school:{node:'school',label:'학교 앞',icon:'▤'},annex:{node:'annex',label:'별관 앞',icon:'⌂'}};
export function route(from,to){const q=[[from]],seen=new Set([from]);while(q.length){const p=q.shift(),n=p.at(-1);if(n===to)return p;for(const [a,b] of EDGES){const next=a===n?b:b===n?a:null;if(next&&!seen.has(next)){seen.add(next);q.push([...p,next]);}}}return[from];}
export function nearestNode(x,z){return Object.keys(NODES).reduce((a,b)=>Math.hypot(NODES[a][0]-x,NODES[a][1]-z)<Math.hypot(NODES[b][0]-x,NODES[b][1]-z)?a:b);}
export const BUILDINGS=[{x1:-55,x2:-4,z1:-40,z2:6},{x1:-54,x2:-32,z1:21,z2:50}];
export function insideBuilding(x,z,margin=0){return BUILDINGS.some(b=>x>b.x1-margin&&x<b.x2+margin&&z>b.z1-margin&&z<b.z2+margin);}

export function lanePoint(node,i){let [x,z]=NODES[node];if(node==='walkway')z+=(i-1)*4.3;else if(['school','annex','gardenGate'].includes(node))z+=i*2.6;else{x+=(i-1)*2.7;z+=i%2?2.6:0;}return[x,z];}
export const TREES=[[-22,25],[-13,25],[-7,31],[-23,37],[-14,42],[-5,43],[-32,-15],[-35,-18],[-44,13],[-34,13],[-24,13],[-14,13],[-2,17]];
