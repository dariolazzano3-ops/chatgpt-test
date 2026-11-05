import {
  UPGRADES,ACHIEVEMENTS,FLAVORS,newGame,sanitizeState,getStats,
  getCost,clickScoop,buyUpgrade,produce,getMilestone,formatNumber
} from "./economy.mjs";

const STORAGE_KEY="projekt-x-gelato-clicker-v1";
const $=(selector)=>document.querySelector(selector);
const ui={
  score:$("#score"),perClick:$("#perClick"),perSecond:$("#perSecond"),
  totalPerSecond:$("#totalPerSecond"),upgradeCount:$("#upgradeCount"),
  upgrades:$("#upgradeList"),scoop:$("#scoopButton"),wrap:$("#scoopWrap"),
  floating:$("#floatingPoints"),mainScoop:$("#mainScoop"),
  milestoneName:$("#milestoneName"),milestoneCount:$("#milestoneCount"),
  milestoneProgress:$("#milestoneProgress"),achievements:$("#achievementList"),
  toast:$("#toast"),sound:$("#soundButton"),reset:$("#resetButton")
};
let state=readSave();
let lastTick=Date.now();
let toastTimer;
let soundOn=false;
let audioContext=null;
let previousAchievements=new Set();

function readSave(){
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return newGame();
    const parsed=sanitizeState(JSON.parse(raw));
    const elapsed=Math.max(0,(Date.now()-parsed.lastSaved)/1000);
    const earned=getStats(parsed).perSecond*Math.min(elapsed,8*3600);
    if(earned>=1) queueMicrotask(()=>showToast("Willkommen zurück! +"+formatNumber(earned)+" Kugeln während deiner Pause 🍦"));
    return {...produce(parsed,elapsed),lastSaved:Date.now()};
  }catch(error){
    console.warn("Projekt X: Spielstand konnte nicht geladen werden.",error);
    return newGame();
  }
}
function save(){
  try {
    state.lastSaved=Date.now();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  }catch(error){console.warn("Projekt X: Speichern momentan nicht möglich.",error);}
}
function showToast(message){
  ui.toast.textContent=message;
  ui.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>ui.toast.classList.remove("is-visible"),2600);
}
function sound(freq=550){
  if(!soundOn)return;
  try{
    const AudioCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtor)return;
    audioContext??=new AudioCtor();
    if(audioContext.state==="suspended") audioContext.resume();
    const o=audioContext.createOscillator();
    const gain=audioContext.createGain();
    o.type="sine";o.frequency.setValueAtTime(freq,audioContext.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq*1.2,audioContext.currentTime+.08);
    gain.gain.setValueAtTime(.0001,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.035,audioContext.currentTime+.01);
    gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+.13);
    o.connect(gain);gain.connect(audioContext.destination);
    o.start();o.stop(audioContext.currentTime+.14);
  }catch(error){soundOn=false;updateSoundLabel();}
}
function updateSoundLabel(){
  ui.sound.setAttribute("aria-pressed",String(soundOn));
  ui.sound.querySelector("span").textContent=soundOn?"Sound an":"Sound aus";
}
function renderShop(){
  const stats=getStats(state);
  ui.upgradeCount.textContent=formatNumber(stats.totalOwned)+" GEKAUFT";
  ui.upgrades.replaceChildren(...UPGRADES.map(u=>{
    const owned=state.owned[u.id]||0,cost=getCost(u,owned),affordable=state.balance>=cost;
    const button=document.createElement("button");
    button.className="upgrade";
    button.type="button";
    button.dataset.upgrade=u.id;
    button.disabled=!affordable;
    button.setAttribute("aria-label",u.name+", "+formatNumber(cost)+" Kugeln, "+owned+" gekauft. "+u.description);
    const icon=document.createElement("span");icon.className="upgrade__icon";icon.textContent=u.emoji;icon.setAttribute("aria-hidden","true");
    const copy=document.createElement("span");
    const title=document.createElement("span");title.className="upgrade__title";title.textContent=u.name+" ";
    const count=document.createElement("span");count.className="upgrade__owned";count.textContent=owned?"×"+owned:"";
    title.appendChild(count);
    const description=document.createElement("span");description.className="upgrade__desc";description.textContent=u.description;
    copy.append(title,description);
    const price=document.createElement("span");price.className="upgrade__price"+(affordable?"":" is-locked");
    const priceNum=document.createElement("span");priceNum.textContent=formatNumber(cost)+" 🍦";
    const hint=document.createElement("small");hint.textContent=affordable?"KAUFEN ↗":"NOCH SPAREN";
    price.append(priceNum,hint);button.append(icon,copy,price);
    return button;
  }));
}
function renderMilestone(){
  const m=getMilestone(state.totalMade);
  ui.milestoneName.textContent=m.name;
  ui.milestoneCount.textContent=formatNumber(Math.min(state.totalMade,m.at))+" / "+formatNumber(m.at);
  ui.milestoneProgress.style.width=(m.progress*100).toFixed(2)+"%";
}
function renderAchievements(){
  const unlocked=new Set(ACHIEVEMENTS.filter(a=>a.predicate(state)).map(a=>a.id));
  for(const a of ACHIEVEMENTS)if(unlocked.has(a.id)&&!previousAchievements.has(a.id)&&previousAchievements.size>0)showToast("Erfolg freigeschaltet: "+a.title+" ✨");
  previousAchievements=unlocked;
  ui.achievements.replaceChildren(...ACHIEVEMENTS.map(a=>{
    const block=document.createElement("div");block.className="achievement"+(unlocked.has(a.id)?" unlocked":"");
    const icon=document.createElement("span");icon.className="achievement__icon";icon.textContent=a.icon;
    const label=document.createElement("div");
    const strong=document.createElement("strong");strong.textContent=a.title;
    const small=document.createElement("small");small.textContent=a.detail;
    label.append(strong,small);block.append(icon,label);
    return block;
  }));
}
function render(){
  const stats=getStats(state);
  ui.score.textContent=formatNumber(Math.floor(state.balance));
  ui.score.setAttribute("aria-label",formatNumber(Math.floor(state.balance))+" Kugeln");
  ui.perClick.textContent="+"+formatNumber(stats.perClick);
  ui.perSecond.textContent=formatNumber(stats.perSecond);
  ui.totalPerSecond.textContent=formatNumber(stats.perSecond);
  renderShop();renderMilestone();renderAchievements();
}
function floatPoints(amount){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const span=document.createElement("span");span.textContent="+"+formatNumber(amount);
  span.style.left=(38+Math.random()*24)+"%";
  span.style.top=(37+Math.random()*20)+"%";
  ui.floating.append(span);
  span.addEventListener("animationend",()=>span.remove(),{once:true});
  setTimeout(()=>span.remove(),1200);
}
ui.scoop.addEventListener("click",()=>{
  const value=getStats(state).perClick;
  state=clickScoop(state);
  ui.scoop.classList.remove("is-popping");
  void ui.scoop.offsetWidth;
  ui.scoop.classList.add("is-popping");
  setTimeout(()=>ui.scoop.classList.remove("is-popping"),140);
  floatPoints(value);sound(470+Math.random()*170);render();save();
});
ui.upgrades.addEventListener("click",event=>{
  const button=event.target.closest("button[data-upgrade]");
  if(!button)return;
  const result=buyUpgrade(state,button.dataset.upgrade);
  if(!result.ok)return;
  state=result.state;
  const item=UPGRADES.find(u=>u.id===button.dataset.upgrade);
  sound(760);showToast(item.name+" gekauft! 🍨");
  render();save();
});
document.querySelectorAll(".flavor").forEach(button=>{
  button.addEventListener("click",()=>{
    const flavor=button.dataset.flavor;
    if(!FLAVORS.includes(flavor))return;
    state.flavor=flavor;
    ui.mainScoop.src="./assets/flavors/"+flavor+".webp";
    ui.mainScoop.alt=button.textContent.trim()+"-Eiskugel";
    document.querySelectorAll(".flavor").forEach(b=>{
      const active=b===button;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
    });
    sound(540);save();
  });
});
ui.sound.addEventListener("click",()=>{soundOn=!soundOn;updateSoundLabel();sound(620);});
ui.reset.addEventListener("click",()=>{
  if(!window.confirm("Willst du wirklich alle Kugeln und Upgrades löschen?"))return;
  state=newGame();lastTick=Date.now();previousAchievements=new Set();
  ui.mainScoop.src="./assets/flavors/vanille.webp";
  ui.mainScoop.alt="Vanille-Eiskugel";
  document.querySelectorAll(".flavor").forEach(b=>{
    const isVanille=b.dataset.flavor==="vanille";
    b.classList.toggle("active",isVanille);b.setAttribute("aria-pressed",String(isVanille));
  });
  render();save();showToast("Neustart! Die erste Kugel wartet auf dich. 🍦");
});
function tick(){
  const now=Date.now();
  const elapsed=Math.max(0,(now-lastTick)/1000);
  lastTick=now;
  if(elapsed>0 && getStats(state).perSecond>0){
    state=produce(state,elapsed);render();
  }
}
document.addEventListener("visibilitychange",()=>{tick();if(document.hidden)save();});
window.addEventListener("pagehide",()=>{tick();save();});
window.setInterval(tick,250);
window.setInterval(save,5000);
ui.mainScoop.src="./assets/flavors/"+state.flavor+".webp";
ui.mainScoop.alt=state.flavor+"-Eiskugel";
document.querySelectorAll(".flavor").forEach(b=>{
  const selected=b.dataset.flavor===state.flavor;
  b.classList.toggle("active",selected);b.setAttribute("aria-pressed",String(selected));
});
render();
