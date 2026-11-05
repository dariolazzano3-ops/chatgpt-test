export const GAME_VERSION = 1;
export const UPGRADES = Object.freeze([
  {id:"streusel", name:"Extra Streusel", emoji:"✨", description:"+1 Kugel pro Klick", category:"click", effect:1, baseCost:15},
  {id:"waffel", name:"Goldene Waffel", emoji:"🧇", description:"+5 Kugeln pro Klick", category:"click", effect:5, baseCost:120},
  {id:"löffel", name:"Profi-Eislöffel", emoji:"🥄", description:"+25 Kugeln pro Klick", category:"click", effect:25, baseCost:1100},
  {id:"helfer", name:"Eis-Assistent", emoji:"👨‍🍳", description:"+1 Kugel pro Sekunde", category:"auto", effect:1, baseCost:45},
  {id:"maschine", name:"Eismaschine", emoji:"⚙️", description:"+8 Kugeln pro Sekunde", category:"auto", effect:8, baseCost:420},
  {id:"wagen", name:"Gelato-Wagen", emoji:"🛺", description:"+40 Kugeln pro Sekunde", category:"auto", effect:40, baseCost:2600},
  {id:"labor", name:"Eislabor", emoji:"🍨", description:"+180 Kugeln pro Sekunde", category:"auto", effect:180, baseCost:15000},
  {id:"filiale", name:"Zweite Gelateria", emoji:"🏛️", description:"+1000 Kugeln pro Sekunde", category:"auto", effect:1000, baseCost:85000}
]);
export const MILESTONES = Object.freeze([
  {at:100, name:"Die ersten 100 Kugeln"},
  {at:500, name:"Der erste große Eisbecher"},
  {at:2500, name:"Die Nachbarschaft liebt dein Eis"},
  {at:10000, name:"Dein eigenes Eislabor"},
  {at:100000, name:"Eine echte Gelato-Legende"},
  {at:1000000, name:"Das Eis-Imperium"},
  {at:10000000, name:"Der Gelato-Olymp"}
]);
export const ACHIEVEMENTS = Object.freeze([
  {id:"first", icon:"🍦", title:"Der erste Löffel", detail:"Stelle deine erste Kugel her.", predicate:s=>s.totalMade>=1},
  {id:"hundred", icon:"💯", title:"Süße Hundert", detail:"Erreiche 100 Kugeln insgesamt.", predicate:s=>s.totalMade>=100},
  {id:"helper", icon:"👨‍🍳", title:"Ein kleines Team", detail:"Kaufe deinen ersten Helfer.", predicate:s=>(s.owned.helfer||0)>=1},
  {id:"machine", icon:"⚙️", title:"Volle Produktion", detail:"Erreiche 10 Kugeln pro Sekunde.", predicate:s=>getStats(s).perSecond>=10}
]);
export const FLAVORS = Object.freeze(["vanille","erdbeere","schokolade","pistazie"]);
export function newGame(now=Date.now()) {
  return {version:GAME_VERSION, balance:0, totalMade:0, totalClicks:0, owned:{}, flavor:"vanille", lastSaved:now};
}
export function sanitizeState(input, now=Date.now()) {
  if (!input || typeof input!=="object" || input.version!==GAME_VERSION) return newGame(now);
  const bounded=(v,max=1e15)=>typeof v==="number" && Number.isFinite(v) ? Math.max(0,Math.min(v,max)) : 0;
  const owned={};
  for (const u of UPGRADES) owned[u.id]=Math.floor(bounded(input.owned?.[u.id],1e4));
  return {
    version:GAME_VERSION, balance:bounded(input.balance),
    totalMade:bounded(input.totalMade), totalClicks:Math.floor(bounded(input.totalClicks)),
    owned,flavor:FLAVORS.includes(input.flavor)?input.flavor:"vanille",
    lastSaved:bounded(input.lastSaved,now)||now
  };
}
export function getStats(state) {
  let perClick=1,perSecond=0,totalOwned=0;
  for(const u of UPGRADES) {
    const count=state.owned[u.id]||0;
    totalOwned+=count;
    if(u.category==="click") perClick+=u.effect*count;
    else perSecond+=u.effect*count;
  }
  return {perClick,perSecond,totalOwned};
}
export function getCost(upgrade,ownedCount=0) {
  return Math.ceil(upgrade.baseCost*Math.pow(1.17,Math.max(0,Math.floor(ownedCount))));
}
export function clickScoop(state) {
  const n=getStats(state).perClick;
  return {...state,balance:state.balance+n,totalMade:state.totalMade+n,totalClicks:state.totalClicks+1};
}
export function buyUpgrade(state,id) {
  const upgrade=UPGRADES.find(u=>u.id===id);
  if(!upgrade) return {ok:false,state,cost:null};
  const cost=getCost(upgrade,state.owned[id]||0);
  if(state.balance+1e-9<cost) return {ok:false,state,cost};
  return {ok:true,cost,state:{
    ...state,balance:Math.max(0,state.balance-cost),
    owned:{...state.owned,[id]:(state.owned[id]||0)+1}
  }};
}
export function produce(state,seconds) {
  const safeSeconds=Math.max(0,Math.min(8*3600,Number.isFinite(seconds)?seconds:0));
  const gain=getStats(state).perSecond*safeSeconds;
  return {...state,balance:Math.min(1e15,state.balance+gain),totalMade:Math.min(1e15,state.totalMade+gain)};
}
export function getMilestone(totalMade) {
  let previous=0;
  for(const milestone of MILESTONES) {
    if(totalMade<milestone.at) return {...milestone,previous,progress:Math.min(1,Math.max(0,(totalMade-previous)/(milestone.at-previous)))};
    previous=milestone.at;
  }
  return {at:previous,name:"Du bist eine Eis-Legende!",previous,progress:1};
}
export function formatNumber(value) {
  if(!Number.isFinite(value)) return "0";
  if(value<1000) return new Intl.NumberFormat("de-DE",{maximumFractionDigits:value<10&&value%1!==0?1:0}).format(value);
  if(value<1000000) return new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(value);
  const units=[{div:1e12,label:"Bio."},{div:1e9,label:"Mrd."},{div:1e6,label:"Mio."}];
  for(const u of units) if(value>=u.div) return new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}).format(value/u.div)+" "+u.label;
  return String(Math.floor(value));
}
