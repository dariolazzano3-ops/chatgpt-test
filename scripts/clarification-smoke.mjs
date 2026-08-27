import { analyzeEditIntent } from '../src/edit-clarifier.js';
import { planNaturalEdit } from '../src/edit-planner.js';

const vague = analyzeEditIntent('Mach das größer');
if (!vague.needs_clarification || vague.safe_to_execute) throw new Error('vague reference was not gated');
if (vague.question !== 'Welches Element oder welcher Bereich soll geändert werden?') throw new Error('missing target clarification question');

const conflict = planNaturalEdit('Mach die Karten runder und eckiger');
if (!conflict.clarification?.needs_clarification) throw new Error('conflicting card direction was not gated');
if (!conflict.clarification.conflicts.includes('RADIUS_CONFLICT')) throw new Error('radius conflict not reported');
if (conflict.operations.length !== 0) throw new Error('conflicting edit must not produce executable operations');

const safe = planNaturalEdit('Mach die Karten im Leistungsbereich runder');
if (safe.clarification?.needs_clarification) throw new Error('clear scoped edit was incorrectly gated');
if (safe.operations.length !== 1) throw new Error('clear scoped edit did not remain executable');

console.log('Clarification smoke: ambiguity and conflict gating passed');
