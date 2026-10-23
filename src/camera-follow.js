export const clampFollowDistance = value => Math.max(8,Math.min(65,Number.isFinite(value)?value:22));
export function zoomFollowDistance(distance,delta){return clampFollowDistance(clampFollowDistance(distance)*Math.exp(Math.max(-200,Math.min(200,Number.isFinite(delta)?delta:0))*.0015));}
export function followPose(position,heading,distance){const d=clampFollowDistance(distance),angle=Number.isFinite(heading)?heading:0;return {camera:{x:position.x-Math.sin(angle)*d,y:position.y+Math.max(5,d*.5),z:position.z-Math.cos(angle)*d},target:{x:position.x,y:position.y+2,z:position.z}};}
export function steerHeading(heading,horizontal,dt){return heading-horizontal*2.25*Math.min(.05,Math.max(0,dt));}
export const clampFieldOfView = value => Math.max(35,Math.min(70,Number.isFinite(value)?value:44));
export const defaultFieldOfView = aspect => aspect<.8?55:44;
