import assert from 'node:assert/strict';
import {
  J12_NEXT_BEST_ACTION_CODES,
  J12_NEXT_BEST_ACTION_TARGETS,
  deriveJ12NextBestAction,
  j12NextBestActionManifest
} from '../src/web-factory/next-best-action-v1.js';
import {
  injectJ12OperatorNextBestAction,
  j12OperatorNextBestActionManifest
} from '../src/operator-next-best-action-v1.js';
import {
  executeWebFactoryTask,
  webFactoryProviderManifest
} from '../src/web-factory/index.js';
import {
  injectPremiumMasterdashboard,
  premiumMasterdashboardManifest
} from '../src/operator-premium-masterdashboard-v1.js';

const manifest=j12NextBestActionManifest();
assert.deepEqual(manifest.action_codes,J12_NEXT_BEST_ACTION_CODES);
assert.deepEqual(manifest.targets,J12_NEXT_BEST_ACTION_TARGETS);
assert.equal(manifest.exactly_one_primary_action,true);
assert.equal(manifest.button_wall_forbidden,true);
assert.equal(manifest.deterministic_priority,true);
assert.equal(manifest.automatic_execution,false);
assert.equal(manifest.production_deploy,false);

const scope='synthetic:j12';
const base={project:{scope_key:scope,name:'J12 Fixture'}};

function expectCode(input,code,target){
  const result=deriveJ12NextBestAction({...base,...input});
  assert.equal(result.status,'READY');
  assert.equal(result.project_scope,scope);
  assert.equal(result.primary_action.code,code);
  assert.equal(result.primary_action.target,target);
  assert.equal(result.exactly_one_primary_action,true);
  assert.equal(result.primary_button_count,1);
  assert.equal(result.button_wall_forbidden,true);
  assert.equal(result.automatic_execution,false);
  assert.equal(result.production_deploy,false);
  assert.equal(result.external_writes,false);
  assert.equal(result.trace.filter(x=>x.selected).length,1);
  return result;
}

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'IN_REVIEW',catch_net:{unresolved_count:3,counts:{source_conflicts:1}}},
      sections:{project_knowledge:[
        {fact_id:'phone',verification_status:'SOURCE_CONFLICT'},
        {fact_id:'hours',verification_status:'NEEDS_REVIEW'}
      ]}
    }
  }
},'REVIEW_PROJECT_KNOWLEDGE','knowledge');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'COLLECTING',catch_net:{unresolved_count:0}},
      sections:{project_knowledge:[]}
    },
    human_input_closure:{
      open_input_count:1,
      open_inputs:[{id:'CONTACT_DETAILS',question:'Kontaktdaten bestätigen'}]
    }
  }
},'CONFIRM_CONTACT_DETAILS','approvals');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'COLLECTING',catch_net:{unresolved_count:0}},
      sections:{project_knowledge:[]}
    },
    human_input_closure:{
      open_input_count:2,
      open_inputs:[
        {id:'TARGET_CUSTOMERS',question:'Zielgruppe bestätigen'},
        {id:'PRIMARY_CONVERSION',question:'Primäre Conversion bestätigen'}
      ]
    }
  }
},'REVIEW_PROJECT_KNOWLEDGE','approvals');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'STAGED',catch_net:{unresolved_count:0}},
      sections:{project_knowledge:[]}
    }
  }
},'APPROVE_PROJECT_KNOWLEDGE','knowledge');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  }
},'CREATE_REFERENCE','webfactory');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'CANDIDATE',version:'ref-1'}
},'APPROVE_REFERENCE','webfactory');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-1'}
},'BUILD_WEBSITE','webfactory');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-1'},
  build:{build_id:'b1',accepted:true},
  qa:{status:'PASS'}
},'CLOSE_VISUAL_DELTA','webfactory');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-1'},
  build:{build_id:'b1',accepted:true},
  qa:{status:'PASS'},
  visual:{status:'PASS',delta_count:0}
},'RUN_BROWSER_QUALITY','webfactory');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-1'},
  build:{build_id:'b1',accepted:true},
  qa:{status:'PASS'},
  visual:{status:'PASS',delta_count:0},
  j9:{
    browser:{status:'PASS'},
    performance:{status:'PASS'},
    accessibility:{state:'FULL_ACCEPTED'}
  }
},'CHECK_PREVIEW','preview');

expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-1'},
  build:{build_id:'b1',accepted:true},
  qa:{status:'PASS'},
  visual:{status:'PASS',delta_count:0},
  j9:{
    browser:{status:'PASS'},
    performance:{status:'PASS'},
    accessibility:{state:'FULL_ACCEPTED'}
  },
  preview:{available:true,review_status:'APPROVED',preview_url:'/private/p1'}
},'APPROVE_WEBSITE','approvals');

const deliveryReady=expectCode({
  source:{
    workspace:{
      knowledge_review:{status:'APPROVED',current_knowledge_revision:'k7'},
      sections:{project_knowledge:[]}
    }
  },
  reference:{status:'APPROVED',version:'ref-1'},
  build:{build_id:'b1',accepted:true},
  qa:{status:'PASS'},
  visual:{status:'PASS',delta_count:0},
  j9:{
    browser:{status:'PASS'},
    performance:{status:'PASS'},
    accessibility:{state:'FULL_ACCEPTED'}
  },
  preview:{available:true,review_status:'APPROVED',preview_url:'/private/p1'},
  website_approval:{status:'APPROVED'}
},'READY_FOR_DELIVERY_LIFECYCLE','webfactory');
assert.equal(deliveryReady.primary_action.priority,120);

const priority=deriveJ12NextBestAction({
  project:{scope_key:scope},
  source:{
    workspace:{
      knowledge_review:{status:'IN_REVIEW',catch_net:{unresolved_count:2}},
      sections:{project_knowledge:[]}
    },
    human_input_closure:{
      open_input_count:1,
      open_inputs:[{id:'CONTACT_DETAILS',question:'Kontaktdaten bestätigen'}]
    }
  }
});
assert.equal(priority.primary_action.code,'REVIEW_PROJECT_KNOWLEDGE');
assert.equal(priority.primary_action.priority,10);
assert.equal(priority.exactly_one_primary_action,true);

const noScope=deriveJ12NextBestAction({});
assert.equal(noScope.status,'BLOCKED');
assert.equal(noScope.primary_action,null);
assert.equal(noScope.reason,'PROJECT_SCOPE_REQUIRED');

const adapterManifest=executeWebFactoryTask({
  capability:'web.next-best-action.v1',
  operation:'manifest'
});
assert.equal(adapterManifest.ok,true);
assert.equal(adapterManifest.status,'J12_NEXT_BEST_ACTION_MANIFEST_READY');

const adapterDerive=executeWebFactoryTask({
  capability:'web.next-best-action.v1',
  operation:'derive',
  input:{
    project:{scope_key:scope},
    source:{workspace:{knowledge_review:{status:'APPROVED',current_knowledge_revision:'k1'},sections:{project_knowledge:[]}}}
  }
});
assert.equal(adapterDerive.ok,true);
assert.equal(adapterDerive.next_best_action.primary_action.code,'CREATE_REFERENCE');

const provider=webFactoryProviderManifest();
assert.ok(provider.capabilities.includes('web.next-best-action.v1'));
assert.equal(provider.production_deploy,false);

const ui=j12OperatorNextBestActionManifest();
assert.equal(ui.exactly_one_primary_action,true);
assert.equal(ui.primary_surface,'PROJECT_WORKSPACE_HEADER');
assert.equal(ui.secondary_webfactory_actions_collapsed_by_default,true);
assert.equal(ui.network_writes_on_primary_action,0);
assert.equal(ui.automatic_execution,false);

const baseHtml='<!doctype html><html><body><section id="projects"></section></body></html>';
const injected=injectJ12OperatorNextBestAction(baseHtml);
for(const marker of [
  'aurentara-j12-next-best-action-script',
  'NEXT BEST ACTION · J12',
  'Die einzige Primäraktion bleibt oben im Project Workspace.',
  'Weitere WebFactory Aktionen',
  'automatic_execution:false'
]) assert.ok(injected.includes(marker),marker);
assert.equal(injectJ12OperatorNextBestAction(injected),injected);

const premium=injectPremiumMasterdashboard(baseHtml);
assert.ok(premium.includes('aurentara-j12-next-best-action-script'));
assert.ok(premium.includes('aurentara-j11-webfactory-control-plane-script'));
const premiumManifest=premiumMasterdashboardManifest();
assert.equal(premiumManifest.j12_next_best_action,true);
assert.equal(premiumManifest.j11_webfactory_control_plane,true);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j12-next-best-action',
  action_codes:J12_NEXT_BEST_ACTION_CODES,
  stage_count:11,
  deterministic_priority:'PASS',
  exactly_one_primary_action:'PASS',
  button_wall_collapsed:'PASS',
  operator_ui_integration:'PASS',
  webfactory_capability:'PASS',
  automatic_execution:false,
  automatic_merge:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
