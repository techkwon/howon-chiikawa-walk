const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createArrivalGate(position,stops,radius=4.6){return {previous:{x:position.x,z:position.z},travel:0,inside:stops.filter(s=>dist(position,s)<(s.radius??radius)).map(s=>s.id),pending:[]};}
export function sampleArrival(gate,position,stops,{active=false,goalId=null,radius=4.6,minTravel=1.5}={}){
 const inside=stops.filter(s=>dist(position,s)<(s.radius??radius)).map(s=>s.id),moved=dist(gate.previous,position),travel=active?gate.travel+moved:gate.travel;
 // Crossing can happen before the travel guard is satisfied. Retain that real
 // crossing while inside, rather than consuming it and losing the arrival.
 const crossed=active&&moved>.0001?inside.filter(id=>!gate.inside.includes(id)):[];
 const pending=active?[...new Set([...(gate.pending||[]),...crossed])].filter(id=>inside.includes(id)&&(!goalId||id===goalId)):[];
 const entered=active&&moved>.0001&&travel>=minTravel?pending:[];
 return {state:{previous:{x:position.x,z:position.z},travel,inside,pending:pending.filter(id=>!entered.includes(id))},entered};
}
