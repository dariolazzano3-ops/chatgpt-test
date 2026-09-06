import crypto from 'node:crypto';

export const REFERENCE_STATUSES = Object.freeze(['CANDIDATE','APPROVED','SUPERSEDED','REVOKED']);
export const REFERENCE_SOURCE_TYPES = Object.freeze(['UPLOAD','INTAKE','DASHBOARD','REPOSITORY','GENERATED_CANDIDATE']);

const clone = (v) => structuredClone(v);
const clean = (v, max=500) => String(v ?? '').trim().slice(0,max);

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stableJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function requireString(value, code, max=500) {
  const v=clean(value,max);
  if (!v) throw new Error(code);
  return v;
}

function normalizeViewport(viewport={}) {
  const width=Number(viewport.width);
  const height=Number(viewport.height);
  const dpr=Number(viewport.device_pixel_ratio ?? 1);
  if (!Number.isInteger(width) || width < 320 || width > 4096) throw new Error('REFERENCE_VIEWPORT_WIDTH_INVALID');
  if (!Number.isInteger(height) || height < 320 || height > 4096) throw new Error('REFERENCE_VIEWPORT_HEIGHT_INVALID');
  if (!Number.isFinite(dpr) || dpr < 1 || dpr > 4) throw new Error('REFERENCE_DPR_INVALID');
  return {width,height,device_pixel_ratio:dpr};
}

export function createReferenceRecord(input={}, options={}) {
  const now=clean(options.now || new Date().toISOString(),80);
  const status=clean(input.status || 'CANDIDATE',40).toUpperCase();
  if (!REFERENCE_STATUSES.includes(status)) throw new Error('REFERENCE_STATUS_INVALID');
  if (status !== 'CANDIDATE') throw new Error('REFERENCE_CREATION_MUST_START_CANDIDATE');

  const sourceType=clean(input.source_type || 'UPLOAD',60).toUpperCase();
  if (!REFERENCE_SOURCE_TYPES.includes(sourceType)) throw new Error('REFERENCE_SOURCE_TYPE_INVALID');
  const sourcePath=clean(input.source_path || input.asset_reference,1000);
  if (!sourcePath) throw new Error('REFERENCE_SOURCE_REQUIRED');

  const record={
    schema:'riosystems.reference-record.v1',
    reference_id:requireString(input.reference_id,'REFERENCE_ID_REQUIRED',160),
    project_id:requireString(input.project_id,'PROJECT_ID_REQUIRED',160),
    name:requireString(input.name,'REFERENCE_NAME_REQUIRED',240),
    version:requireString(input.version,'REFERENCE_VERSION_REQUIRED',80),
    status:'CANDIDATE',
    source_type:sourceType,
    source_path:sourcePath,
    viewport:normalizeViewport(input.viewport),
    device_pixel_ratio:Number(input.device_pixel_ratio ?? input.viewport?.device_pixel_ratio ?? 1),
    hash:requireString(input.hash,'REFERENCE_HASH_REQUIRED',160),
    created_at:now,
    approved_at:null,
    approved_by:null,
    superseded_by:null,
    notes:clean(input.notes,2000),
    locked:false
  };
  if (record.device_pixel_ratio !== record.viewport.device_pixel_ratio) throw new Error('REFERENCE_DPR_MISMATCH');
  return record;
}

export function validateReferenceRecord(record={}) {
  const issues=[];
  try {
    if (record.schema !== 'riosystems.reference-record.v1') issues.push('REFERENCE_SCHEMA_INVALID');
    requireString(record.reference_id,'REFERENCE_ID_REQUIRED',160);
    requireString(record.project_id,'PROJECT_ID_REQUIRED',160);
    requireString(record.name,'REFERENCE_NAME_REQUIRED',240);
    requireString(record.version,'REFERENCE_VERSION_REQUIRED',80);
    if (!REFERENCE_STATUSES.includes(String(record.status))) issues.push('REFERENCE_STATUS_INVALID');
    normalizeViewport(record.viewport);
    requireString(record.hash,'REFERENCE_HASH_REQUIRED',160);
    if (record.status === 'APPROVED' && (!record.approved_at || !record.approved_by || record.locked !== true)) issues.push('APPROVED_REFERENCE_LOCK_INCOMPLETE');
    if (record.status === 'SUPERSEDED' && !record.superseded_by) issues.push('SUPERSEDED_REFERENCE_TARGET_REQUIRED');
  } catch (error) {
    issues.push(String(error.message || error));
  }
  return {ok:issues.length===0,issues:[...new Set(issues)]};
}

export function approveReference(record={}, input={}) {
  if (record.status !== 'CANDIDATE') throw new Error('REFERENCE_APPROVAL_REQUIRES_CANDIDATE');
  const approvedBy=requireString(input.approved_by,'REFERENCE_APPROVER_REQUIRED',240);
  const approvedAt=clean(input.approved_at || new Date().toISOString(),80);
  return {...clone(record),status:'APPROVED',approved_at:approvedAt,approved_by:approvedBy,locked:true};
}

export function assertReferenceSourceOfTruth(record={}) {
  const validation=validateReferenceRecord(record);
  if (!validation.ok) throw new Error('REFERENCE_RECORD_INVALID:'+validation.issues.join(','));
  if (record.status !== 'APPROVED') throw new Error('REFERENCE_NOT_APPROVED_SOURCE_OF_TRUTH');
  return true;
}

export function createReferenceChangeRequest(record={}, input={}, options={}) {
  assertReferenceSourceOfTruth(record);
  const requestedBy=requireString(input.requested_by,'REFERENCE_CHANGE_REQUESTER_REQUIRED',240);
  const reason=requireString(input.reason,'REFERENCE_CHANGE_REASON_REQUIRED',1200);
  return {
    schema:'riosystems.reference-change-request.v1',
    change_request_id:clean(input.change_request_id || 'rcr-'+crypto.randomUUID(),180),
    reference_id:record.reference_id,
    reference_version:record.version,
    status:'OPEN',
    requested_by:requestedBy,
    reason,
    requested_changes:clone(input.requested_changes || {}),
    created_at:clean(options.now || new Date().toISOString(),80)
  };
}

export function updateReferenceRecord(record={}, patch={}, options={}) {
  if (record.locked === true || record.status === 'APPROVED') {
    const request=options.change_request;
    if (!request || request.schema !== 'riosystems.reference-change-request.v1' || request.status !== 'OPEN' || request.reference_id !== record.reference_id) {
      throw new Error('REFERENCE_LOCKED_CHANGE_REQUEST_REQUIRED');
    }
    throw new Error('APPROVED_REFERENCE_IMMUTABLE_CREATE_NEW_VERSION');
  }
  const forbidden=new Set(['reference_id','project_id','created_at','approved_at','approved_by','superseded_by','locked','status']);
  for (const key of Object.keys(patch)) if (forbidden.has(key)) throw new Error('REFERENCE_PROTECTED_FIELD:'+key);
  const next={...clone(record),...clone(patch)};
  if (patch.viewport) next.viewport=normalizeViewport(patch.viewport);
  if (patch.device_pixel_ratio != null && Number(patch.device_pixel_ratio)!==next.viewport.device_pixel_ratio) throw new Error('REFERENCE_DPR_MISMATCH');
  const validation=validateReferenceRecord(next);
  if (!validation.ok) throw new Error('REFERENCE_RECORD_INVALID:'+validation.issues.join(','));
  return next;
}

export function supersedeReference(oldRecord={}, newRecord={}) {
  assertReferenceSourceOfTruth(oldRecord);
  assertReferenceSourceOfTruth(newRecord);
  if (oldRecord.project_id !== newRecord.project_id) throw new Error('REFERENCE_SUPERSEDE_PROJECT_MISMATCH');
  if (oldRecord.reference_id === newRecord.reference_id) throw new Error('REFERENCE_SUPERSEDE_SELF');
  return {...clone(oldRecord),status:'SUPERSEDED',superseded_by:newRecord.reference_id,locked:true};
}

export function revokeReference(record={}, input={}) {
  assertReferenceSourceOfTruth(record);
  return {
    ...clone(record),
    status:'REVOKED',
    locked:true,
    notes:[record.notes, clean(input.reason,1200)].filter(Boolean).join('\n')
  };
}

export function createReferenceRegistry(records=[]) {
  const byId=new Map();
  for (const record of records) {
    const validation=validateReferenceRecord(record);
    if (!validation.ok) throw new Error('REFERENCE_RECORD_INVALID:'+validation.issues.join(','));
    if (byId.has(record.reference_id)) throw new Error('REFERENCE_ID_DUPLICATE');
    byId.set(record.reference_id,clone(record));
  }
  return {
    schema:'riosystems.reference-registry.v1',
    records:[...byId.values()].sort((a,b)=>a.project_id.localeCompare(b.project_id)||a.name.localeCompare(b.name)||a.version.localeCompare(b.version)),
    registry_hash:crypto.createHash('sha256').update(stableJson([...byId.values()])).digest('hex')
  };
}

export function resolveApprovedReference(registry={}, input={}) {
  const records=Array.isArray(registry.records)?registry.records:[];
  const matches=records.filter(r=>r.project_id===input.project_id && r.status==='APPROVED' && (!input.reference_id || r.reference_id===input.reference_id) && (!input.viewport || (r.viewport.width===input.viewport.width && r.viewport.height===input.viewport.height)));
  if (matches.length===0) throw new Error('APPROVED_REFERENCE_NOT_FOUND');
  if (matches.length>1) throw new Error('APPROVED_REFERENCE_AMBIGUOUS');
  assertReferenceSourceOfTruth(matches[0]);
  return clone(matches[0]);
}
