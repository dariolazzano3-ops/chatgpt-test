import fs from 'node:fs';
import { aggregateMissionDelivery } from '../src/mission-delivery-aggregator.js';

const flag = (name, fallback = null) => { const index = process.argv.indexOf(`--${name}`); return index >= 0 ? process.argv[index + 1] : fallback; };
const missionFile = flag('mission');
const activationFile = flag('activation');
if (!missionFile || !/^factory-state\/missions\/[a-zA-Z0-9._-]+\.json$/.test(missionFile)) throw new Error('SAFE_MISSION_PATH_REQUIRED');
if (!fs.existsSync(missionFile)) throw new Error(`MISSION_FILE_NOT_FOUND:${missionFile}`);
if (activationFile && !/^factory-state\/mission-activation\/[a-zA-Z0-9._-]+\.json$/.test(activationFile)) throw new Error('UNSAFE_ACTIVATION_PATH');

const mission = JSON.parse(fs.readFileSync(missionFile, 'utf8'));
const activation = activationFile && fs.existsSync(activationFile) ? JSON.parse(fs.readFileSync(activationFile, 'utf8')) : null;
const report = aggregateMissionDelivery(mission, { activation });
if (!report.ok) throw new Error(report.error || 'MISSION_DELIVERY_AGGREGATION_FAILED');
console.log(JSON.stringify(report, null, 2));
