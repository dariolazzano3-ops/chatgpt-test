import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveJarvisAutomaticProjectRouteV1 as route} from '../src/jarvis/project-route-v1.js';
const lukas={target_id:'LUKAS_PAFF',label:'Lukas Paff Premium Website',route_aliases:['LUKAS PAFF','LUKAS PAFF WEBSITE'],enabled:true};
test('name separator variants route to the same approved Lukas target',()=>{
  for(const name of ['Lukas-Paff','Lukas Paff','Lukas_Paff','LUKAS_PAFF','Lukas–Paff','Lukas—Paff']) {
    const result=route('JARVIS, öffne '+name+' und verbessere das mobile Design',{LUKAS_PAFF:lukas});
    assert.equal(result.target_id,'LUKAS_PAFF',name);
    assert.equal(result.matched,true,name);
  }
});
test('only complete server-configured names match',()=>{
  for(const name of ['LukasPaff','Lukas-Paffish','LukasPaf','Gelato Donatello']) {
    assert.equal(route('JARVIS, öffne '+name,{LUKAS_PAFF:lukas}).matched,false,name);
  }
});
test('multiple matched targets remain ambiguous and fail closed',()=>{
  const aurentara={target_id:'AURENTARA',label:'AURENTARA',route_aliases:[],enabled:true};
  const result=route('JARVIS, bearbeite Lukas-Paff und AURENTARA',{LUKAS_PAFF:lukas,AURENTARA:aurentara});
  assert.equal(result.matched,false);
  assert.equal(result.status,'AMBIGUOUS');
});
test('disabled projects cannot route',()=>{
  assert.equal(route('öffne Lukas-Paff',{LUKAS_PAFF:{...lukas,enabled:false}}).matched,false);
});
