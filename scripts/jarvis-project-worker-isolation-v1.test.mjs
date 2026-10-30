import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectJarvisProjectWorkerIsolationV1 as inspect } from
  '../src/jarvis/project-worker-isolation-v1.js';

const approved = {
  target_id:'LUKAS_PAFF',
  project_slug:'lukas-paff-premium-v1',
  support_mounts:[
    {source:'/home/jarvis/claude-worker/bridge/bridge.py',
     destination:'/opt/jarvis-bridge/bridge.py', read_only:true},
    {source:'/etc/jarvis/claude-lukas-paff-v1',
     destination:'/home/claude/.claude', read_only:false},
    {source:'/opt/jarvis/project-workspaces/LUKAS_PAFF/.git',
     destination:'/workspace/projects/lukas-paff-premium-v1/.git', read_only:true}
  ]
};
const workspace={Type:'bind',Source:'/opt/jarvis/project-workspaces/LUKAS_PAFF',
  Destination:'/workspace/projects/lukas-paff-premium-v1',RW:true};
const support={Type:'bind',Source:'/home/jarvis/claude-worker/bridge/bridge.py',
  Destination:'/opt/jarvis-bridge/bridge.py',RW:false};
const credentials={Type:'bind',Source:'/etc/jarvis/claude-lukas-paff-v1',
  Destination:'/home/claude/.claude',RW:true};
const gitMetadata={Type:'bind',Source:'/opt/jarvis/project-workspaces/LUKAS_PAFF/.git',
  Destination:'/workspace/projects/lukas-paff-premium-v1/.git',RW:false};
const container = () => ({
  Id:'a'.repeat(64),
  Config:{User:'11000'},
  State:{Status:'running',Running:true},
  HostConfig:{
    Privileged:false,CapAdd:null,PidMode:'',IpcMode:'',NetworkMode:'bridge',
    Devices:[],SecurityOpt:['no-new-privileges:true'],
    PortBindings:{'8788/tcp':[{HostIp:'127.0.0.1',HostPort:'18789'}]}
  },
  Mounts:[{...workspace},{...support},{...credentials},{...gitMetadata}]
});
const check=(mutate,reason,policy=approved)=>{
  const c=container();
  mutate(c);
  const r=inspect([c],policy);
  assert.equal(r.configuration_valid,false);
  assert.ok(r.failures.includes(reason),JSON.stringify(r.failures));
};
test('exact isolated project configuration is acceptable but NOT attested',()=>{
  const x=inspect([container()],approved);
  assert.equal(x.configuration_valid,true);
  assert.equal(x.isolation_verified,false);
  assert.equal(x.executable,false);
  assert.deepEqual(x.failures,[]);
});
test('rejects shared multi-project root mount',()=>{
  check(c=>c.Mounts.push({Type:'bind',Source:'/home/jarvis/claude-worker/workspace',
    Destination:'/workspace/projects',RW:true}),'UNAPPROVED_MOUNT');
});
test('rejects another project mount',()=>{
  check(c=>c.Mounts.push({Type:'bind',
    Source:'/opt/jarvis/project-workspaces/AURENTARA',
    Destination:'/workspace/projects/aurentara-real-lifecycle-v1',RW:true}),
    'UNAPPROVED_MOUNT');
});
test('rejects mounted docker socket',()=>{
  check(c=>c.Mounts.push({Type:'bind',Source:'/var/run/docker.sock',
    Destination:'/var/run/docker.sock',RW:true}),'UNAPPROVED_MOUNT');
});
test('rejects broad host mount or root directory',()=>{
  check(c=>c.Mounts.push({Type:'bind',Source:'/',
    Destination:'/host',RW:false}),'UNAPPROVED_MOUNT');
});
test('rejects unrelated shared credentials',()=>{
  check(c=>{c.Mounts[2].Source='/home/jarvis/claude-worker/config'},'UNAPPROVED_MOUNT');
});
test('rejects git metadata writes',()=>{
  check(c=>{c.Mounts[3].RW=true},'UNAPPROVED_MOUNT');
});
test('rejects project mount pointing to wrong checkout',()=>{
  check(c=>{c.Mounts[0].Source='/opt/jarvis/project-workspaces/OTHER'},'PROJECT_MOUNT_NOT_EXACTLY_ONCE');
});
test('rejects project mount not writable',()=>{
  check(c=>{c.Mounts[0].RW=false},'PROJECT_NOT_WRITABLE');
});
test('rejects public network exposure',()=>{
  check(c=>{c.HostConfig.PortBindings['8788/tcp'][0].HostIp='0.0.0.0'},'EXPOSED_PUBLIC_PORT');
});
test('rejects privileged or host namespace processes',()=>{
  check(c=>{c.HostConfig.Privileged=true},'PRIVILEGED_CONTAINER');
  check(c=>{c.HostConfig.PidMode='host'},'HOST_PID_NAMESPACE');
  check(c=>{c.HostConfig.NetworkMode='host'},'HOST_NETWORK');
  check(c=>{c.HostConfig.CapAdd=['SYS_ADMIN']},'ADDED_CAPABILITIES');
});
test('rejects missing no-new-privileges',()=>{
  check(c=>{c.HostConfig.SecurityOpt=[]},'NO_NEW_PRIVILEGES_MISSING');
});
test('rejects stopped container',()=>{
  check(c=>{c.State.Running=false;c.State.Status='exited'},'CONTAINER_NOT_RUNNING');
});
test('rejects unknown or anonymous mounts',()=>{
  check(c=>c.Mounts.push({Type:'volume',Source:'/var/lib/docker/volumes/random',
    Destination:'/workspace/projects/extra',RW:true}), 'UNKNOWN_OR_UNSAFE_MOUNT');
});
test('rejects bad support policy containing other project paths',()=>{
  check(()=>{},'SUPPORT_MOUNT_POLICY_INVALID',{
    ...approved,support_mounts:[...approved.support_mounts,
      {source:'/home/jarvis/claude-worker/workspace',destination:'/x',read_only:true}]
  });
});
test('rejects bad target ID and ambiguous docker inspect',()=>{
  assert.equal(inspect([container(),container()],approved).configuration_valid,false);
  assert.equal(inspect([container()],{...approved,target_id:'../../root'}).configuration_valid,false);
});
test('does not allow caller to approve arbitrary host support mounts',()=>{
  for (const source of ['/', '/home/jarvis', '/etc', '/var/run/docker.sock']) {
    check(()=>{},'SUPPORT_MOUNT_POLICY_INVALID',{
      ...approved,support_mounts:[...approved.support_mounts,
        {source,destination:'/app/unsafe',read_only:true}]
    });
  }
});
test('rejects root worker identity',()=>{
  check(c=>{c.Config.User='root'},'NON_ROOT_WORKER_IDENTITY_NOT_CONFIGURED');
});
