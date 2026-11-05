// Measure the remaining planned polyline, rather than straight-line goal distance:
// legitimate detours can initially move away from the destination.
export function remainingTravelDistance(position, points) {
  let distance=0, previous=position;
  for(const point of points){distance+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
  return distance;
}
export function trackTravelProgress(previous, remaining, now) {
  if(!previous||remaining<previous.best-.25) return {best:remaining,progressAt:now,stalled:false};
  return {...previous,stalled:now-previous.progressAt>=15};
}
