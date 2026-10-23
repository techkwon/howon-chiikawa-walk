import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SCHOOL_STORIES } from '../src/school-stories.js';
import { NODES } from '../src/navigation.js';
import { createTourState, visitStop, getProgress } from '../src/tour-state.js';
import { createStopQuizState, isStopQuizCompleted, STOP_QUIZZES } from '../src/stop-quiz.js';
import { createArrivalGate, sampleArrival } from '../src/arrival-gate.js';

const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const productionFunction=name=>{
  const line=source.split('\n').find(line=>line.startsWith(`function ${name}(`));
  assert.ok(line,`production function ${name} exists`);
  return line;
};
function harness(storyNumber=0){
  const elements=new Map(),calls={quiz:0,story:0,navigate:0,discover:0};
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{hidden:true,dataset:{},replaceChildren(){},showModal(){calls.quiz++;this.open=true;}});
    return elements.get(selector);
  };
  const story=SCHOOL_STORIES[storyNumber],point=NODES[story.tourNode];
  const stops=[{id:story.id,x:point[0],z:point[1],radius:6}];
  const c={SCHOOL_STORIES:[story],NODES,STOP_QUIZZES,started:true,loaded:true,uiPhase:'game',galleryActive:false,paused:false,manual:true,selected:0,activeGoalId:null,storyIndex:0,stopQuizId:null,stopQuizWasPaused:false,introShownIds:new Set(),actors:[{model:{position:{x:point[0],z:point[1]}},wait:0}],arrivalStops:stops,arrivalGate:createArrivalGate({x:point[0]+10,z:point[1]},stops),sampleArrival,tour:createTourState([story.id]),stopQuiz:createStopQuizState(),visitStop,getProgress,isStopQuizCompleted,nextStopAt:null,time:0,$:selector=>selector==='dialog[open]'?null:element(selector),document:{createElement:()=>({})},audio:{play(){calls.discover++;}},fx(){},toast(){},updateGuideSpeech(){},refreshTour(){},input:{reset(){}},syncRunUI(){},syncPauseUI(){},renderStopQuiz(){},navigateStop(){calls.navigate++;}};
  c.applyTour=next=>{c.tour=next;};
  vm.createContext(c);
  vm.runInContext(['openStory','checkTourArrival','openStopQuiz'].map(productionFunction).join('\n'),c);
  const clickHandler=source.match(/\$\('#story-read'\)\.onclick=\(\)=>openStopQuiz\(storyIndex\);/);
  assert.ok(clickHandler,'production explicit quiz button binding exists');
  vm.runInContext(clickHandler[0],c);
  return {c,calls,element,story,point};
}
test('production arrival displays explanation and never opens quiz or schedules advance',()=>{
  const {c,calls,element,story}=harness();
  c.checkTourArrival();
  assert.equal(element('#story-card').hidden,false);
  assert.equal(element('#story-card').dataset.arrival,'true');
  assert.equal(c.introShownIds.has(story.id),true);
  assert.equal(calls.quiz,0);
  assert.equal(c.nextStopAt,null);
  c.time=100000;c.checkTourArrival();
  assert.equal(calls.quiz,0);assert.equal(calls.navigate,0);
  assert.equal(getProgress(c.tour).completed,0);
});
test('production explicit story-read click opens quiz only after explanation',()=>{
  const {c,calls,element}=harness();
  assert.match(source, /\$\('#story-read'\)\.onclick=\(\)=>openStopQuiz\(storyIndex\)/);
  c.checkTourArrival();
  assert.equal(calls.quiz,0);
  element('#story-read').onclick();
  assert.equal(calls.quiz,1);
  assert.equal(element('#story-card').hidden,true);
});
test('production quiz guard shows explanation first when it was never expanded',()=>{
  const {c,calls,element,story}=harness();
  c.tour=visitStop(c.tour,story.id);
  c.openStopQuiz(0);
  assert.equal(calls.quiz,0);
  assert.equal(element('#story-card').hidden,false);
  assert.equal(c.introShownIds.has(story.id),true);
  element('#story-read').onclick();
  assert.equal(calls.quiz,1);
});
test('production unanswered re-entry reopens explanation without repeat discovery or quiz',()=>{
  const {c,calls,element,point}=harness();
  c.checkTourArrival();element('#story-card').hidden=true;
  c.actors[0].model.position.x=point[0]+10;c.checkTourArrival();
  c.actors[0].model.position.x=point[0];c.checkTourArrival();
  assert.equal(element('#story-card').hidden,false);
  assert.equal(element('#story-card').dataset.arrival,'true');
  assert.equal(calls.discover,1);assert.equal(calls.quiz,0);
  assert.equal(getProgress(c.tour).completed,0);
});
test('production expanded explanation is required; hidden previews do not unlock quiz',()=>{
  const {c,story}=harness();
  c.openStory(0,{expand:false});
  assert.equal(c.introShownIds.has(story.id),false);
  c.openStory(0,{expand:true});
  assert.equal(c.introShownIds.has(story.id),true);
});
test('production arrival contains no quiz launch and no positive auto-advance assignment remains',()=>{
  assert.doesNotMatch(productionFunction('checkTourArrival'),/openStopQuiz\s*\(/);
  const assignments=[...source.matchAll(/nextStopAt\s*=(?!=)([^;\n,}]+)/g)].map(match=>match[1].trim());
  assert.ok(assignments.length>0);
  assert.ok(assignments.every(value=>value==='null'),JSON.stringify(assignments));
});

test('all eight production arrivals keep the explanation-first sequence',()=>{
  for(let i=0;i<SCHOOL_STORIES.length;i++){
    const {c,calls,element,story}=harness(i);
    c.checkTourArrival();
    assert.equal(element('#story-card').hidden,false,story.id);
    assert.equal(calls.quiz,0,story.id);
    element('#story-read').onclick();
    assert.equal(calls.quiz,1,story.id);
  }
});
