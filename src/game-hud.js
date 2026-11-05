// A single goal and contextual action; secondary controls keep their existing handlers.
export function goalView(state) {
  if(state.paused) return {title:state.interiorActive?state.room:(state.story?.label||'학교 산책'),hint:'잠깐 쉬는 중',action:'다시 걷기'};
  if (state.interaction) return {title:state.interiorActive?state.room:'학교 출입문',hint:state.interiorActive?'가상 실내 · 가까운 물건과 상호작용해요':'가까이 왔어요',action:state.interaction};
  if (state.interiorActive) return {title:state.room || '학교 안 둘러보기',hint:state.interaction ? '가까이 왔어요' : '가상 실내 · 앞뒤 이동 / 좌우 방향 전환',action:state.interaction || '밖으로 나가기'};
  if (state.progress.done) return {title:'여덟 곳을 모두 만났어요!',hint:'자유롭게 산책하거나 메뉴에서 다시 시작해요',action:state.paused?'다시 걷기':'이야기 다시 보기'};
  if(state.completed) return {title:state.story.label+' 완료!',hint:'다음 이야기를 만나러 가요',action:'다음 장소로'};
  return {title:state.story?.label || '친구와 함께 출발!',hint:state.arrived?'도착했어요 · 이야기를 읽고 게임을 해요':state.paused?'잠깐 쉬는 중':state.manual?'직접 걷는 중 · 친구에게 길을 맡길 수도 있어요':'친구가 데려다주는 중',action:state.paused?'다시 걷기':state.arrived?'이야기 보기':state.manual?'친구 따라 가기':'잠깐 쉬기'};
}
export function installGameHUD({read,resetInput,pause,resume,act}) {
  const $=selector=>document.querySelector(selector), menu=$('#game-menu'), content=$('#menu-content');
  for(const selector of ['#tour-progress','.toolbar','#experience-settings','.companions','.places','#interior-entry','#school-tour','#interior-note','#help','#credits']) {const section=$(selector);section.inert=false;section.classList.add('menu-section');if(selector==='.companions'||selector==='.places'){const group=document.createElement('details'),summary=document.createElement('summary');summary.textContent=selector==='.companions'?'친구 바꾸기':'자유 산책 장소';group.className='menu-group';group.append(summary,section);content.append(group);}else content.append(section);}
  let beforePause=false;
  function close(returnToMenu=false){if(!menu.open)return;resume(beforePause);menu.close();resetInput();(returnToMenu?$('#hud-toggle'):$('#scene')).focus({preventScroll:true});}
  $('#hud-toggle').onclick=()=>{if(document.querySelector('dialog[open]'))return;resetInput();beforePause=pause();menu.showModal();$('#menu-close').focus();};
  $('#menu-close').onclick=()=>close();
  menu.addEventListener('cancel',event=>{event.preventDefault();close(true);});
  content.addEventListener('click',event=>{if(event.target.closest('.toolbar button,.place,#interior-entry,#school-tour,#help,#credits,#tour-checklist button,#tour-restart'))close();},true);
  $('#goal-action').onclick=()=>{resetInput();act();$('#scene').focus({preventScroll:true});};
  $('#hud-chat').onclick=()=>{const on=document.body.dataset.chat!=='true';document.body.dataset.chat=String(on);$('#hud-chat').setAttribute('aria-pressed',String(on));$('#hud-chat').textContent=on?'친구 말풍선 끄기':'친구 말풍선 켜기';};
  let previous='';
  function update(){const state=read(),view=goalView(state),signature=JSON.stringify([state.started,state.loaded,state.galleryActive,state.reading,view,state.progress.completed,state.interiorActive]);if(signature===previous)return;previous=signature;const hidden=!state.started||!state.loaded||state.galleryActive;$('#game-goal').hidden=hidden||state.reading;$('#goal-action').hidden=hidden||state.reading;$('#goal-title').textContent=view.title;$('#goal-hint').textContent=view.hint;$('#goal-progress').textContent=`학교 산책 ${state.progress.completed} / ${state.progress.total}`;$('#goal-action').textContent=view.action;}
  update();return {update};
}
