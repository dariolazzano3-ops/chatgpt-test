export const REFERENCE_DRIVEN_HQ_STYLE = String.raw`<style id="aurentara-reference-driven-hq-v1-style">
body.reference-hq-v1{--rf-bg:#071015;--rf-bg-2:#0a151b;--rf-panel:#0d1920;--rf-panel-2:#101e25;--rf-line:#22313a;--rf-line-soft:#18262e;--rf-text:#f3f6f4;--rf-muted:#8f9ca3;--rf-gold:#d5ae54;--rf-gold-2:#f0cf75;--rf-green:#4ed492;--rf-yellow:#f2c44f;--rf-red:#ff6a61;--rf-blue:#66aef0;--rf-shadow:0 18px 55px rgba(0,0,0,.28);background:var(--rf-bg);color:var(--rf-text);color-scheme:dark}
body.reference-hq-v1 .app{grid-template-columns:220px minmax(0,1fr);background:linear-gradient(145deg,#071015 0%,#09141a 48%,#071116 100%)}
body.reference-hq-v1 .side{position:relative;overflow:hidden;padding:22px 10px 18px;background:radial-gradient(circle at 35% 72%,rgba(35,60,69,.24),transparent 35%),linear-gradient(180deg,#071015 0%,#09141a 62%,#071015 100%);border-right:1px solid #1c2a32;box-shadow:18px 0 45px rgba(0,0,0,.12)}body.reference-hq-v1 .side:after{content:'';position:absolute;left:-22%;right:-16%;bottom:13%;height:31%;opacity:.35;background:linear-gradient(155deg,transparent 0 29%,#15242b 30% 44%,transparent 45%),linear-gradient(25deg,transparent 0 38%,#0f1d24 39% 55%,transparent 56%),linear-gradient(180deg,transparent,#09141a);clip-path:polygon(0 100%,0 68%,15% 55%,29% 73%,42% 36%,56% 64%,69% 42%,82% 67%,100% 49%,100% 100%);pointer-events:none}body.reference-hq-v1 .side>*{position:relative;z-index:1}
body.reference-hq-v1 .brand{margin:0 8px 20px;padding:1px 8px 18px;border-bottom:1px solid #1b2930;text-align:center}
body.reference-hq-v1 .brand strong{font-size:17px;letter-spacing:.23em;font-weight:620;color:#fff}
body.reference-hq-v1 .brand span{margin-top:5px;font-size:8.5px;letter-spacing:.34em;text-transform:uppercase;color:#89969d}
body.reference-hq-v1 .brand .brand-parent{display:none!important}
body.reference-hq-v1 .nav{display:none!important}
.rf-hq-nav{display:none}
body.reference-hq-v1 .rf-hq-nav{display:flex;flex-direction:column;min-height:0;flex:1}
.rf-hq-nav-main{display:grid;gap:5px}
.rf-hq-nav button{width:100%;display:flex;align-items:center;gap:11px;min-height:42px;padding:10px 12px;border:1px solid transparent;border-radius:10px;background:transparent;color:#aeb9bf;text-align:left;font-size:12.5px;font-weight:560}
.rf-hq-nav button:hover{background:#101d24;color:#fff;border-color:#1e2d35}
.rf-hq-nav button.active{background:linear-gradient(90deg,rgba(213,174,84,.20),rgba(213,174,84,.08));color:#fff;border-color:rgba(213,174,84,.18);box-shadow:inset 3px 0 0 var(--rf-gold)}
.rf-hq-nav-icon{width:20px;height:20px;display:grid;place-items:center;flex:0 0 20px;font-size:14px;color:#9fb0b9}
.rf-hq-nav button.active .rf-hq-nav-icon{color:var(--rf-gold-2)}
.rf-hq-system-toggle{margin-top:8px!important;border-top:1px solid #18262e!important;border-radius:0!important;color:#7f8d94!important;font-size:10.5px!important}.rf-hq-system{display:none;gap:3px;padding:6px 0 8px}.rf-hq-system.open{display:grid}.rf-hq-system button{min-height:34px;padding:7px 12px 7px 43px;font-size:10.5px;color:#839198}.rf-hq-nav-foot{margin-top:auto;padding:18px 16px 4px;border-top:1px solid #1a2830;color:#7d8a91}
.rf-hq-nav-foot strong{display:block;color:#d8dee1;font-size:10px;letter-spacing:.28em;line-height:1.7;font-weight:600}
.rf-hq-nav-foot span{display:block;margin-top:12px;font-size:8px;line-height:1.75;letter-spacing:.15em;text-transform:uppercase}
body.reference-hq-v1 .side-foot{display:none!important}body.reference-hq-v1 .deployment-identity-v1{display:none!important}
body.reference-hq-v1 .main{max-width:none;margin:0;padding:0 18px 26px;min-width:0;background:radial-gradient(circle at 58% -10%,rgba(52,88,102,.18),transparent 34%),linear-gradient(180deg,#081218,#071116)}
body.reference-hq-v1 .main>.top{display:none!important}
body.reference-hq-v1 #error{width:min(100%,1440px);margin:10px auto 0}
body.reference-hq-v1 #hq{width:min(100%,1440px);margin:0 auto}body.reference-hq-v1 #hq>.design-overview{display:none!important}
body.reference-hq-v1 .global-operator-ai-trigger{display:inline-flex!important;position:fixed!important;right:18px!important;bottom:18px!important;top:auto!important;z-index:70!important;min-height:34px!important;padding:8px 12px!important;border:1px solid rgba(213,174,84,.38)!important;border-radius:999px!important;background:rgba(9,20,26,.94)!important;color:#e7cb81!important;box-shadow:0 12px 30px rgba(0,0,0,.32)!important;font-size:9px!important;letter-spacing:.06em!important;backdrop-filter:blur(12px)}
.rf-hq-shell{display:grid;gap:12px;min-width:0}
.rf-toolbar{height:56px;margin:0 -18px;padding:0 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid var(--rf-line);background:rgba(7,16,21,.9);backdrop-filter:blur(16px);position:sticky;top:0;z-index:20}
.rf-search{width:min(340px,45vw);display:flex;align-items:center;gap:9px;padding:8px 12px;border:1px solid #273640;border-radius:9px;background:#0b171d;color:var(--rf-muted)}
.rf-search input{width:100%;border:0;outline:0;background:transparent;color:#eaf0ed;font-size:12px;min-height:0;padding:0}
.rf-search input::placeholder{color:#76858d}
.rf-toolbar-right{display:flex;align-items:center;gap:9px;min-width:0}
.rf-env,.rf-region,.rf-operator{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:6px 10px;border:1px solid #263740;border-radius:999px;background:#0a151b;color:#b7c2c7;font-size:10.5px;white-space:nowrap}
.rf-env:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--rf-green);box-shadow:0 0 0 3px rgba(78,212,146,.08)}
.rf-operator{border-radius:9px}.rf-operator b{color:#eef2ef;font-weight:650}
.rf-hero{position:relative;min-height:116px;padding:20px 15px 16px;overflow:hidden;border-bottom:1px solid rgba(34,49,58,.55)}
.rf-hero:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 78% 56%,rgba(213,174,84,.16),transparent 15%),radial-gradient(ellipse at 64% 62%,rgba(75,115,128,.12),transparent 28%),linear-gradient(180deg,rgba(7,16,21,.08),rgba(7,17,22,.9));opacity:.98;pointer-events:none}.rf-hero:after{content:'';position:absolute;left:35%;right:-2%;bottom:0;height:95%;opacity:.72;background:linear-gradient(168deg,transparent 0 46%,#17262d 47% 55%,transparent 56%),linear-gradient(18deg,transparent 0 54%,#0e1d24 55% 66%,transparent 67%),linear-gradient(180deg,transparent 12%,rgba(9,20,26,.8) 100%);clip-path:polygon(0 100%,0 70%,11% 61%,21% 69%,31% 42%,40% 58%,49% 30%,59% 63%,69% 51%,79% 67%,91% 48%,100% 58%,100% 100%);pointer-events:none}
.rf-hero>div{position:relative;z-index:1}.rf-kicker{font-size:10px;letter-spacing:.24em;color:#e4ca83;text-transform:uppercase}.rf-hero h1{margin:7px 0 3px;color:#fff;font-size:38px;line-height:1;font-weight:730;letter-spacing:-.045em}.rf-hero p{margin:0;color:#b6c0c4;font-size:13px}.rf-hero-motto{position:absolute!important;right:22px;top:28px;color:#9faab0;font-size:9px;letter-spacing:.31em;line-height:1.65;text-transform:uppercase}.rf-hero-motto:after{content:'';display:block;width:62px;height:1px;margin-top:10px;background:var(--rf-gold)}
.rf-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.rf-kpi{min-height:94px;padding:16px;border:1px solid var(--rf-line);border-radius:11px;background:linear-gradient(145deg,#0b171d,#0d1b22);box-shadow:var(--rf-shadow);display:flex;gap:13px;align-items:flex-start}
.rf-kpi-icon{width:43px;height:43px;border-radius:50%;display:grid;place-items:center;flex:0 0 43px;background:rgba(213,174,84,.09);color:var(--rf-gold-2);font-size:20px}.rf-kpi:nth-child(2) .rf-kpi-icon{background:rgba(78,212,146,.09);color:var(--rf-green)}.rf-kpi:nth-child(3) .rf-kpi-icon{background:rgba(255,106,97,.1);color:var(--rf-red)}.rf-kpi:nth-child(4) .rf-kpi-icon{background:rgba(102,174,240,.1);color:var(--rf-blue)}
.rf-kpi-label{font-size:11.5px;color:#cbd4d7}.rf-kpi-value{margin-top:3px;font-size:27px;line-height:1;font-weight:720;color:#fff;letter-spacing:-.02em}.rf-kpi-meta{margin-top:9px;font-size:9.5px;color:#73838b}
.rf-grid-mid{display:grid;grid-template-columns:1.05fr .95fr;gap:12px}.rf-grid-bottom{display:grid;grid-template-columns:.92fr 1.08fr;gap:12px}
.rf-panel{min-width:0;border:1px solid #263841;border-radius:11px;background:linear-gradient(145deg,rgba(13,27,34,.98),rgba(8,21,27,.98));box-shadow:0 16px 44px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.018);overflow:hidden}
.rf-panel-head{min-height:54px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--rf-line-soft)}
.rf-panel-title{display:flex;align-items:center;gap:9px;min-width:0}.rf-panel-title .ico{font-size:17px;color:var(--rf-gold-2)}.rf-panel-title h2{margin:0;color:#f4f7f5;font-size:14px;font-weight:680}.rf-panel-title p{margin:2px 0 0;color:#7f8c93;font-size:10px}.rf-link{border:0;background:transparent;color:#aeb9be;font-size:10px;padding:6px}.rf-link:hover{color:#fff}
.rf-attention-list,.rf-project-list{padding:0 14px}.rf-attention-row{min-height:42px;display:grid;grid-template-columns:10px 105px minmax(0,1fr) auto;gap:9px;align-items:center;border-top:1px solid var(--rf-line-soft);font-size:10.5px;color:#cdd5d8}.rf-attention-row:first-child{border-top:0}.rf-dot{width:6px;height:6px;border-radius:50%;background:var(--rf-yellow)}.rf-dot.blocked{background:var(--rf-red)}.rf-dot.info{background:var(--rf-blue)}
.rf-chip{display:inline-flex;width:max-content;max-width:100%;padding:4px 7px;border:1px solid rgba(242,196,79,.42);border-radius:4px;background:rgba(242,196,79,.09);color:#e6c65d;font-size:8.5px;font-weight:700;text-transform:uppercase}.rf-chip.blocked{border-color:rgba(255,106,97,.42);background:rgba(255,106,97,.08);color:#ff8179}.rf-chip.info{border-color:rgba(102,174,240,.4);background:rgba(102,174,240,.08);color:#75baf6}.rf-attention-time{color:#718088;font-size:9px;white-space:nowrap}
.rf-ai-body{padding:14px}.rf-ai-message{padding:13px;border:1px solid #263943;border-radius:9px;background:#09151b;color:#d7dfe2;font-size:10.5px;line-height:1.55}.rf-ai-message strong{display:block;margin-bottom:6px;color:#fff;font-size:12px}.rf-ai-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.rf-ai-action{border:1px solid #2a3a43;border-radius:6px;background:#101e25;color:#b9c5ca;padding:7px 9px;font-size:9px}.rf-ai-input{margin-top:9px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border:1px solid #263943;border-radius:8px;background:#08141a;color:#74838b;font-size:10px}.rf-ai-new{border:1px solid rgba(213,174,84,.25);border-radius:7px;background:rgba(213,174,84,.08);color:#e8cc82;padding:7px 10px;font-size:9.5px}.rf-new-project{border-color:#e0be66;background:linear-gradient(180deg,#f0d27d,#c99d42);color:#16120a;font-weight:760;box-shadow:0 5px 16px rgba(213,174,84,.18)}
.rf-portfolio-toolbar{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:9px 14px;border-bottom:1px solid var(--rf-line-soft)}.rf-portfolio-search{min-width:170px;display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #26343d;border-radius:6px;background:#09151b;color:#74828a}.rf-portfolio-search input{width:100%;min-height:0;border:0;outline:0;background:transparent;color:#dce4e6;padding:0;font-size:9px}.rf-project-arrow{color:#7f8d94;font-size:13px}.rf-tabs{display:flex;gap:6px;flex-wrap:wrap}.rf-filter{border:1px solid #26343d;border-radius:6px;background:#0b171d;color:#8e9ba2;padding:6px 9px;font-size:9px}.rf-filter.active{border-color:rgba(213,174,84,.52);color:#e4c979;background:rgba(213,174,84,.08)}
.rf-project-row{min-height:63px;display:grid;grid-template-columns:42px minmax(0,1fr) auto 14px;gap:10px;align-items:center;border-top:1px solid var(--rf-line-soft);padding:8px 0;cursor:pointer}.rf-project-row:first-child{border-top:0}.rf-project-row.selected{margin:4px -4px;padding-left:4px;padding-right:4px;border:1px solid rgba(213,174,84,.7);border-radius:8px;background:linear-gradient(90deg,rgba(213,174,84,.1),rgba(213,174,84,.025))}.rf-avatar{width:42px;height:42px;border-radius:8px;display:grid;place-items:center;background:radial-gradient(circle at 32% 24%,rgba(213,174,84,.18),transparent 32%),linear-gradient(145deg,#20323b,#31434c);color:#eef3ef;font-size:10px;font-weight:760;letter-spacing:.05em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}.rf-project-name{font-size:11px;font-weight:650;color:#f0f4f2}.rf-project-scope{margin-top:2px;color:#718088;font-size:8.6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rf-project-state{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.rf-state{padding:4px 6px;border-radius:4px;border:1px solid #2b3a42;color:#9eabb1;font-size:8px;text-transform:uppercase}.rf-state.ready{border-color:rgba(78,212,146,.4);color:#5bdda0;background:rgba(78,212,146,.07)}.rf-state.attention{border-color:rgba(242,196,79,.4);color:#efcb58;background:rgba(242,196,79,.07)}.rf-state.blocked{border-color:rgba(255,106,97,.4);color:#ff8077;background:rgba(255,106,97,.07)}
.rf-selected-head{padding:12px 15px;display:flex;align-items:center;justify-content:space-between;gap:12px}.rf-selected-actions{display:flex;align-items:center;gap:7px}.rf-selected-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid rgba(213,174,84,.48);border-radius:999px;background:rgba(213,174,84,.07);color:#e4c979;font-size:8.5px;font-weight:700;text-transform:uppercase}.rf-selected-more{width:29px;height:29px;border:1px solid #293a43;border-radius:7px;background:#101d24;color:#839198}.rf-selected-id{display:flex;gap:10px;align-items:center;min-width:0}.rf-selected-id .rf-avatar{width:44px;height:44px}.rf-selected-id h3{margin:0;color:#f4f7f5;font-size:15px}.rf-selected-id div:last-child{min-width:0}.rf-selected-tabs{display:flex;gap:4px;overflow:auto;padding:0 10px 7px;border-bottom:1px solid var(--rf-line-soft)}.rf-selected-tabs button{border:0;border-radius:6px;background:transparent;color:#91a0a7;padding:7px 10px;font-size:9px;white-space:nowrap}.rf-selected-tabs button.active{background:#17242b;color:#f4f7f5;box-shadow:inset 0 -2px 0 var(--rf-gold)}
.rf-selected-body{display:grid;grid-template-columns:1.18fr .82fr;gap:10px;padding:10px}.rf-selected-lower{grid-column:1/-1;display:grid;grid-template-columns:.75fr .8fr 1.25fr;gap:10px}.rf-subpanel{border:1px solid #22323b;border-radius:9px;background:#09151b;padding:12px;min-width:0}.rf-subpanel h4{margin:0 0 9px;color:#dce4e6;font-size:10px}.rf-status-line{display:flex;align-items:center;justify-content:space-between;gap:9px;font-size:9.5px;color:#91a0a7}.rf-progress{height:7px;margin:9px 0 6px;border-radius:99px;background:#17242b;overflow:hidden}.rf-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#40d68b,#8be9ba)}.rf-next-action{border-color:rgba(213,174,84,.24);background:linear-gradient(135deg,rgba(213,174,84,.12),rgba(213,174,84,.04))}.rf-next-action strong{display:block;color:#f0e0ad;font-size:11px}.rf-next-action p{margin:5px 0 0;color:#9d936f;font-size:9px}.rf-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}.rf-mini-grid .rf-subpanel{padding:10px}.rf-activity-panel{min-height:100%;padding:11px 12px}.rf-preview-button{margin-top:8px;width:100%;border:1px solid #31434d;border-radius:6px;background:#15242b;color:#e2e9e5;padding:8px 10px;font-size:9px;text-align:center}.rf-mini-value{font-size:10px;color:#e8eeeb}.rf-mini-label{font-size:8.5px;color:#718088;margin-bottom:4px}.rf-activity{display:grid;gap:7px}.rf-activity div{display:grid;grid-template-columns:9px minmax(0,1fr) auto;gap:7px;align-items:center;color:#9eabb1;font-size:8.7px}.rf-activity i{width:5px;height:5px;border-radius:50%;background:var(--rf-gold)}.rf-empty{padding:18px;color:#73838b;font-size:10px;text-align:center}
body.reference-hq-v1 .error{background:#251416;border-color:#5f2b2f;color:#ffd7d4}
@media(max-width:1180px){body.reference-hq-v1 .app{grid-template-columns:190px minmax(0,1fr)}.rf-kpis{grid-template-columns:repeat(2,1fr)}.rf-grid-bottom{grid-template-columns:1fr}.rf-selected-body{grid-template-columns:1fr}.rf-selected-lower{grid-template-columns:1fr 1fr 1.2fr}}
@media(max-width:760px){body.reference-hq-v1 .global-operator-ai-trigger{right:12px!important;bottom:12px!important;max-width:150px!important}body.reference-hq-v1 .app{display:block}body.reference-hq-v1 .rf-hq-nav{display:block!important;min-width:0;overflow:hidden}.rf-hq-nav-main{display:flex;gap:5px;overflow-x:auto;padding:2px 0 5px;scrollbar-width:none}.rf-hq-nav-main::-webkit-scrollbar{display:none}.rf-hq-nav-main button{width:auto;min-width:max-content;flex:0 0 auto;padding:8px 10px;min-height:36px}.rf-hq-system-toggle,.rf-hq-system,.rf-hq-nav-foot{display:none!important}body.reference-hq-v1 .side{position:static;height:auto;min-height:64px;padding:14px}.rf-toolbar{position:static;height:auto;min-height:54px;margin:0 -18px;padding:9px 12px;align-items:stretch}.rf-search{width:100%;max-width:none}.rf-toolbar-right{display:none}.rf-hero{padding:18px 2px 14px}.rf-hero h1{font-size:30px}.rf-hero-motto{display:none}.rf-kpis,.rf-grid-mid,.rf-grid-bottom{grid-template-columns:1fr}.rf-kpi{min-height:82px}.rf-attention-row{grid-template-columns:8px 92px minmax(0,1fr)}.rf-attention-time{display:none}.rf-project-row{grid-template-columns:34px minmax(0,1fr)}.rf-project-state{grid-column:2;justify-content:flex-start}.rf-selected-body{grid-template-columns:1fr}.rf-selected-lower{grid-template-columns:1fr}.rf-mini-grid{grid-template-columns:1fr}.rf-panel-head{align-items:flex-start}.rf-ai-actions{display:grid;grid-template-columns:1fr}.rf-ai-action{width:100%}}
</style>`;

export const REFERENCE_DRIVEN_HQ_SCRIPT = String.raw`<script id="aurentara-reference-driven-hq-v1-script">
(() => {
  if (window.__aurentaraReferenceDrivenHqV1) return;
  window.__aurentaraReferenceDrivenHqV1 = true;

  const U = (value) => String(value || '').toUpperCase();
  const N = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const safe = (value) => typeof esc === 'function' ? esc(value) : String(value ?? '');
  const money = (value) => typeof fmtMoney === 'function' ? fmtMoney(value) : String(value ?? '0');
  const time = (value) => typeof fmtDate === 'function' ? fmtDate(value) : String(value ?? '');
  const projects = () => Array.isArray(state?.data?.projects?.items) ? state.data.projects.items : [];
  const contexts = () => state.referenceHqContexts || (state.referenceHqContexts = {});
  const details = () => state.referenceHqDetails || (state.referenceHqDetails = {});

  function displayName(project={}){const name=String(project.name||project.project_id||'Projekt');if(/AURENTARA SYSTEMS Public Website V1/i.test(name))return 'AURENTARA Website';if(/Synthetic Service Studio/i.test(name))return 'Service Studio';return name}

  function initials(project = {}) {
    return displayName(project).split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  }

  function payloadContext(payload = {}) {
    const workspace = payload.workspace || {};
    const review = workspace.knowledge_review || {};
    const facts = workspace.sections?.project_knowledge || [];
    const sources = workspace.sections?.project_sources || [];
    const closure = payload.human_input_closure || {};
    const unresolved = N(review.catch_net?.unresolved_count);
    const conflicts = N(review.catch_net?.counts?.source_conflicts || workspace.conflict_count);
    const factAttention = facts.filter(f => ['UNVERIFIED','NEEDS_REVIEW','SOURCE_CONFLICT','AMBIGUOUS'].includes(U(f.verification_status))).length;
    return {
      source_count: sources.length,
      fact_count: facts.length,
      knowledge_status: U(review.status),
      knowledge_attention: Math.max(unresolved, conflicts, factAttention),
      conflict_count: conflicts,
      open_input_count: N(closure.open_input_count),
      human_approval_required: closure.readiness?.human_quality_approval?.status === 'APPROVAL_REQUIRED'
    };
  }

  function projectContext(project = {}) {
    return contexts()[project.scope_key] || {};
  }

  function lifecycle(project = {}, context = {}) {
    const raw = [project.state, project.mission_status, project.status].map(U).join(' ');
    const envRaw = U(project.environment || context.environment || 'DRAFT');
    const environment = envRaw.includes('PROD') ? 'PRODUCTION' : envRaw.includes('STAG') ? 'STAGING' : 'DRAFT';
    const blocked = N(project.blocker_count) + N(context.blocker_count) > 0 || raw.includes('BLOCKED') || raw.includes('FAILED');
    const attention = N(project.open_approval_count) + N(context.open_input_count) + N(context.knowledge_attention) > 0 || context.human_approval_required;
    const knowledgeStarted = context.source_count > 0 || context.fact_count > 0 || ['COLLECTING','IN_REVIEW','CHANGES_PENDING','STAGED'].includes(context.knowledge_status);
    let phase = 'INTAKE';
    if (environment === 'PRODUCTION' || raw.includes('LIVE')) phase = 'LIVE';
    else if (knowledgeStarted && context.knowledge_status !== 'APPROVED') phase = 'KNOWLEDGE';
    else if (raw.includes('QA') || raw.includes('QUALITY')) phase = 'QA';
    else if (raw.includes('APPROVAL') || N(project.open_approval_count) > 0 || context.human_approval_required) phase = 'APPROVAL';
    else if (context.knowledge_status === 'APPROVED') phase = 'BUILD';
    return { phase, health: blocked ? 'BLOCKED' : attention ? 'NEEDS_ATTENTION' : 'HEALTHY', environment };
  }

  function progress(project = {}, life = {}) {
    const exact = N(project.progress_percent);
    if (exact > 0 && exact <= 100) return Math.round(exact);
    return { INTAKE:12, KNOWLEDGE:34, BUILD:58, QA:76, APPROVAL:90, LIVE:100 }[life.phase] || 0;
  }

  function nextAction(project = {}, context = {}) {
    const preview = project.project_preview_access || {};
    if (N(project.blocker_count) > 0) return { label:'Blocker prüfen', tab:'overview' };
    if (N(context.knowledge_attention) > 0) return { label:N(context.knowledge_attention) + ' Angaben prüfen', tab:'knowledge' };
    if (N(context.open_input_count) > 0) return { label:N(context.open_input_count) + ' Kundenangaben beantworten', tab:'approvals' };
    if (context.knowledge_status === 'STAGED') return { label:'Projektwissen bereitstellen', tab:'knowledge' };
    if (N(project.open_approval_count) > 0 || context.human_approval_required) return { label:preview.available ? 'Preview abnehmen' : 'Freigaben prüfen', tab:'approvals' };
    if (preview.available) return { label:'Preview öffnen', tab:'preview' };
    return { label:'Projekt öffnen', tab:'overview' };
  }

  function selectedProject() {
    const list = projects();
    const exact = list.find(p => p.scope_key === state.selectedScope);
    if (exact) return exact;
    const gelato = list.find(p => p.scope_key === 'gelato-donatello:gelato-donatello-website-v1');
    const fallback = gelato || list.find(p => p.project_detail_openable === true) || list[0] || null;
    if (fallback?.scope_key) state.selectedScope = fallback.scope_key;
    return fallback;
  }

  function approvalCount() {
    const a = state?.data?.approvals || {};
    const core = N(a.core?.pending_count || a.core?.pending?.length);
    const plans = Array.isArray(a.mission_plans) ? a.mission_plans.filter(x => U(x.status) !== 'DEFERRED').length : 0;
    return core + plans;
  }

  function attentionRows(list = []) {
    const rows = [];
    for (const p of list) {
      const c = projectContext(p);
      if (N(p.blocker_count) > 0 || ['BLOCKED','FAILED'].includes(U(p.state || p.mission_status))) rows.push({tone:'blocked',chip:'Blockiert',project:p,text:'Blocker im Projekt prüfen',tab:'overview'});
      if (N(c.knowledge_attention) > 0) rows.push({tone:'attention',chip:'Prüfung offen',project:p,text:N(c.knowledge_attention)+' Wissensangaben benötigen Prüfung',tab:'knowledge'});
      if (N(c.open_input_count) > 0) rows.push({tone:'attention',chip:'Input benötigt',project:p,text:N(c.open_input_count)+' Kundenangaben offen',tab:'approvals'});
      if (N(p.open_approval_count) > 0 || c.human_approval_required) rows.push({tone:'attention',chip:'Freigabe offen',project:p,text:'Menschliche Freigabe erforderlich',tab:'approvals'});
    }
    return rows.slice(0,4);
  }

  function statusClass(health) {
    return health === 'BLOCKED' ? 'blocked' : health === 'NEEDS_ATTENTION' ? 'attention' : 'ready';
  }

  function projectRow(p, selected) {
    const c = projectContext(p), life = lifecycle(p,c), preview = p.project_preview_access || {}, stateLabel = life.phase === 'BUILD' ? 'In Umsetzung' : life.phase === 'KNOWLEDGE' ? 'Projektwissen' : life.phase === 'APPROVAL' ? 'Freigabe' : life.phase;
    return '<div class="rf-project-row '+(selected?'selected':'')+'" data-rf-project="'+safe(p.scope_key||'')+'"><div class="rf-avatar">'+safe(initials(p))+'</div><div><div class="rf-project-name">'+safe(displayName(p))+'</div><div class="rf-project-scope">'+safe(p.scope_key||'')+'</div></div><div class="rf-project-state"><span class="rf-state '+statusClass(life.health)+'">'+safe(stateLabel)+'</span>'+(preview.available?'<span class="rf-state ready">Preview verfügbar</span>':'')+(life.health==='NEEDS_ATTENTION'?'<span class="rf-state attention">Attention</span>':'')+'</div><span class="rf-project-arrow">›</span></div>';
  }

  function activityMarkup(project, detail) {
    const local = Array.isArray(detail?.timeline) ? detail.timeline : [];
    const global = Array.isArray(state?.data?.audit?.items) ? state.data.audit.items.filter(x => !project?.scope_key || x.scope_key === project.scope_key).slice(0,4) : [];
    const rows = (local.length ? local.slice(-4).reverse() : global.slice(0,4));
    if (!rows.length) return '<div class="rf-empty">Noch keine projektbezogene Aktivität.</div>';
    return '<div class="rf-activity">'+rows.map(x => '<div><i></i><span>'+safe((typeof humanEvent==='function'?humanEvent(x.event||x.type||'Activity').label:(x.event||x.type||'Aktivität')))+'</span><span>'+safe(time(x.at))+'</span></div>').join('')+'</div>';
  }

  function renderSelected(project) {
    if (!project) return '<div class="rf-panel"><div class="rf-empty">Kein Projekt ausgewählt.</div></div>';
    const c = projectContext(project), life = lifecycle(project,c), pct = progress(project,life), action = nextAction(project,c), detail = details()[project.scope_key] || null, preview = project.project_preview_access || detail?.project_preview_access || {}, currentCost = detail?.project?.current_cost_eur ?? project.current_cost_eur ?? project.budget_cost_units ?? 0;
    const healthLabel=life.health==='NEEDS_ATTENTION'?'Benötigt Aufmerksamkeit':life.health;
    return '<div class="rf-panel rf-selected"><div class="rf-selected-head"><div class="rf-selected-id"><div class="rf-avatar">'+safe(initials(project))+'</div><div><h3>'+safe(displayName(project))+'</h3><div class="rf-project-scope">'+safe(project.scope_key||'')+'</div></div></div><div class="rf-selected-actions"><span class="rf-selected-badge">Ausgewähltes Projekt</span><button class="rf-selected-more" type="button" aria-label="Projektoptionen">•••</button></div></div><div class="rf-selected-tabs">'+[['overview','Übersicht'],['sources','Quellen'],['knowledge','Projektwissen'],['implementation','Umsetzung'],['preview','Preview'],['approvals','Prüfungen'],['activity','Aktivität']].map(([id,label],i)=>'<button class="'+(i===0?'active':'')+'" data-rf-tab="'+id+'">'+label+'</button>').join('')+'</div><div class="rf-selected-body"><div class="rf-subpanel"><h4>Projektstatus</h4><div class="rf-status-line"><span class="rf-state '+statusClass(life.health)+'">'+safe(life.phase==='BUILD'?'In Umsetzung':life.phase)+'</span><strong>'+pct+' %</strong></div><div class="rf-progress"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div><div class="rf-project-scope">'+safe(life.environment)+' · '+safe(healthLabel)+'</div></div><div class="rf-subpanel rf-next-action"><h4>Nächste Aktion</h4><strong>'+safe(action.label)+'</strong><p>Deterministisch aus bestehender Ferrari Project Truth.</p><button class="rf-link" data-rf-tab="'+safe(action.tab)+'">Jetzt öffnen →</button></div><div class="rf-selected-lower"><div class="rf-subpanel"><h4>Cost & Safety</h4><div class="rf-mini-label">Aktuelle Kosten</div><div class="rf-mini-value">'+safe(money(currentCost))+'</div><div class="rf-project-scope">Production locked · External Writes locked</div></div><div class="rf-subpanel"><h4>Preview Access</h4><div class="rf-mini-value">'+safe(preview.available?'Preview verfügbar':'Noch keine Preview')+'</div>'+(preview.available?'<button class="rf-preview-button" data-rf-tab="preview">Preview öffnen ↗</button>':'<div class="rf-project-scope" style="margin-top:8px">Wird nach erfolgreichem Build verfügbar.</div>')+'</div><div class="rf-subpanel rf-activity-panel"><div class="rf-status-line" style="margin-bottom:8px"><h4 style="margin:0">Letzte Aktivitäten</h4><button class="rf-link" data-rf-tab="activity">Alle anzeigen →</button></div>'+activityMarkup(project,detail)+'</div></div></div></div>';
  }
  function renderAttention(rows) {
    if (!rows.length) return '<div class="rf-empty">Aktuell keine offenen projektbezogenen Attention-Punkte.</div>';
    return '<div class="rf-attention-list">'+rows.map((r,i)=>'<button class="rf-attention-row" data-rf-attention="'+i+'" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;color:inherit;text-align:left"><span class="rf-dot '+(r.tone==='blocked'?'blocked':'')+'"></span><span class="rf-chip '+(r.tone==='blocked'?'blocked':'')+'">'+safe(r.chip)+'</span><span>'+safe((r.project.name||r.project.project_id)+' · '+r.text)+'</span><span class="rf-attention-time">Jetzt prüfen</span></button>').join('')+'</div>';
  }

  function renderReferenceSidebar() {
    const side = document.querySelector('.side');
    if (!side || side.querySelector('.rf-hq-nav')) return;
    const nav = document.createElement('div');
    nav.className = 'rf-hq-nav';
    const items = [
      ['hq','⌂','HQ','hq'],['projects','▦','Portfolio','projects'],['project-overview','▤','Project Overview','overview'],['sources','▣','Sources','sources'],['knowledge','▥','Knowledge','knowledge'],['preview','▱','Preview','preview'],['approvals','✓','Approvals','approvals'],['activity','⌁','Activity','audit'],['operator-ai','✦','Operator AI','ai'],['settings','⚙','Settings','settings']
    ];
    const systemItems=[['mission','Mission Studio'],['factories','Factories'],['capabilities','Fähigkeiten'],['providers','Provider'],['costs','Kosten'],['deliveries','Deliveries'],['health','Systemstatus']];nav.innerHTML='<div class="rf-hq-nav-main">'+items.map(([id,ico,label,target])=>'<button type="button" data-rf-nav="'+id+'" data-rf-target="'+target+'"'+(id==='projects'?' data-goto="projects"':'')+' class="'+(id==='hq'?'active':'')+'"><span class="rf-hq-nav-icon">'+ico+'</span><span>'+label+'</span></button>').join('')+'<button type="button" class="rf-hq-system-toggle" data-rf-system-toggle><span class="rf-hq-nav-icon">⌄</span><span>Operator Controls</span></button><div class="rf-hq-system">'+systemItems.map(([target,label])=>'<button type="button" data-rf-system-target="'+target+'">'+label+'</button>').join('')+'</div></div><div class="rf-hq-nav-foot"><strong>IDEAS<br>INTO IMPACT</strong><span>People<br>Projects<br>Progress<br>A brighter tomorrow</span></div>';
    side.insertBefore(nav, side.querySelector('.nav'));
    nav.addEventListener('click', async (event) => {
      const toggle=event.target.closest('[data-rf-system-toggle]');
      if(toggle){event.stopPropagation();nav.querySelector('.rf-hq-system')?.classList.toggle('open');return}
      const systemButton=event.target.closest('[data-rf-system-target]');
      if(systemButton){event.stopPropagation();if(typeof go==='function')go(systemButton.dataset.rfSystemTarget);return}
      const button = event.target.closest('[data-rf-nav]');
      if (!button) return;
      event.stopPropagation();
      const target = button.dataset.rfTarget;
      if (target === 'ai') return openAi();
      if (['overview','sources','knowledge','preview'].includes(target)) return openSelectedWorkspace(target);
      if (target === 'approvals' && selectedProject()?.project_detail_openable === true) return openSelectedWorkspace('approvals');
      if (typeof go === 'function') go(target);
    });
  }

  function openAi(prompt = '') {
    if (typeof window.aurentaraOpenGlobalOperatorAiV1 === 'function') window.aurentaraOpenGlobalOperatorAiV1();
    else document.getElementById('global-operator-ai-trigger')?.click();
    if (prompt) setTimeout(() => { const input=document.getElementById('global-operator-ai-input'); if (input) { input.value=prompt; input.dispatchEvent(new Event('input',{bubbles:true})); } }, 0);
  }

  async function ensureDetail(project) {
    if (!project?.scope_key || project.project_detail_openable !== true) return null;
    if (details()[project.scope_key]) return details()[project.scope_key];
    try { details()[project.scope_key] = await api('/project-detail/'+encodeURIComponent(project.scope_key)); } catch (error) { if (typeof setError==='function') setError(error); return null; }
    return details()[project.scope_key];
  }

  async function openSelectedWorkspace(tab = 'overview') {
    const project = selectedProject();
    if (!project) return;
    if (project.project_detail_openable !== true) {
      if (project.workspace_enabled === true && project.project_workspace_route) location.href = project.project_workspace_route;
      return;
    }
    const detail = await ensureDetail(project);
    if (!detail) return;
    state.selectedScope = project.scope_key;
    state.detail = detail;
    state.premiumTab = tab;
    if (typeof go === 'function') go('projects');
  }

  async function hydrateReferenceHq() {
    if (state.referenceHqHydrating) return state.referenceHqHydrating;
    const list = projects();
    state.referenceHqHydrating = (async () => {
      for (const p of list) {
        if (p.project_detail_openable !== true || !p.scope_key || contexts()[p.scope_key]) continue;
        try { contexts()[p.scope_key] = payloadContext(await api('/project-source-intake?scope_key='+encodeURIComponent(p.scope_key))); } catch { contexts()[p.scope_key] = {}; }
      }
      const selected = selectedProject();
      if (selected?.project_detail_openable === true) await ensureDetail(selected);
      state.referenceHqHydrated = true;
      window.__aurentaraReferenceHqReadyV1 = true;
      if (state.section === 'hq') renderReferenceHq();
    })().finally(() => { state.referenceHqHydrating = null; });
    return state.referenceHqHydrating;
  }

  function renderReferenceHq() {
    document.body.classList.add('reference-hq-v1');
    renderReferenceSidebar();
    const root = document.getElementById('hq');
    if (!root) return;
    const list = projects();
    const selected = selectedProject();
    const projectNeedle=String(state.referenceHqProjectQuery||state.referenceHqQuery||'').toLowerCase();const filtered = list.filter(p => !projectNeedle || [p.name,p.project_id,p.customer_id,p.scope_key].some(v => String(v||'').toLowerCase().includes(projectNeedle))).slice(0,5);
    const openInputs = list.reduce((sum,p)=>sum+N(projectContext(p).open_input_count),0);
    const previews = list.filter(p => p.project_preview_access?.available === true).length;
    const attention = attentionRows(list);
    root.innerHTML='<div class="rf-hq-shell" data-hydrated="'+(state.referenceHqHydrated?'true':'false')+'"><div class="rf-toolbar"><label class="rf-search"><span>⌕</span><input id="rf-universal-search" placeholder="Universelle Suche ..." value="'+(state.referenceHqQuery?safe(state.referenceHqQuery):'')+'"></label><div class="rf-toolbar-right"><span class="rf-env">STAGING</span><span class="rf-region">Private Operator</span><span class="rf-operator"><b>OP</b> AURENTARA</span></div></div><div class="rf-hero"><div><div class="rf-kicker">PROJECT FERRARI · PREMIUM MASTERDASHBOARD V1</div><h1>Masterdashboard</h1><p>Steuern Sie alle Kunden- und internen Projekte. Transparent. Effizient. Erfolgsorientiert.</p></div><div class="rf-hero-motto">EXCELLENCE<br>BUILDS<br>TOMORROW</div></div><div class="rf-kpis">'+[
      ['▢','Aktive Projekte',list.length,'Reale Portfolio-Truth'],['▤','Offene Inputs',openInputs,'Kundenangaben und Wissensprüfung'],['◷','Ausstehende Freigaben',approvalCount(),'Bestehender Approval Contract'],['▣','Preview bereit',previews,'Project Preview Access']
    ].map(x=>'<div class="rf-kpi"><div class="rf-kpi-icon">'+x[0]+'</div><div><div class="rf-kpi-label">'+x[1]+'</div><div class="rf-kpi-value">'+safe(x[2])+'</div><div class="rf-kpi-meta">'+x[3]+'</div></div></div>').join('')+'</div><div class="rf-grid-mid"><div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">⚠</span><div><h2>Attention Center</h2><p>Diese Elemente benötigen Ihre Aufmerksamkeit.</p></div></div><button class="rf-link" data-rf-all-attention>Alle anzeigen →</button></div>'+renderAttention(attention)+'</div><div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico" style="color:var(--rf-blue)">✦</span><div><h2>Operator AI</h2><p>Ihr intelligenter Projektassistent, immer verfügbar.</p></div></div><button class="rf-ai-new" data-rf-ai-open>Neuer Chat →</button></div><div class="rf-ai-body"><div class="rf-ai-message"><strong>Hallo! Ich bin Ihr Operator AI.</strong>Ich unterstütze Sie bei der Analyse, Planung und Umsetzung Ihrer Projekte. Der bestehende Operator-AI-Backbone bleibt autoritativ.</div><div class="rf-ai-actions"><button class="rf-ai-action" data-rf-ai-prompt="Fasse den aktuellen Projektstatus zusammen.">Projektstatus zusammenfassen</button><button class="rf-ai-action" data-rf-ai-prompt="Analysiere die aktuell wichtigsten Risiken und Blocker.">Risiken analysieren</button><button class="rf-ai-action" data-rf-ai-prompt="Empfiehl die nächsten sinnvollen Schritte.">Nächste Schritte empfehlen</button></div><button class="rf-ai-input" data-rf-ai-open><span>Fragen Sie mich etwas ...</span><span>▷</span></button></div></div></div><div class="rf-grid-bottom"><div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">▢</span><div><h2>Projekt Portfolio</h2><p>Alle Kunden- und internen Projekte auf einen Blick.</p></div></div><div style="display:flex;gap:7px"><button class="rf-ai-new rf-new-project" data-rf-new-project>Neues Projekt</button><button class="rf-link" data-rf-portfolio-open>Alle öffnen →</button></div></div><div class="rf-portfolio-toolbar"><div class="rf-tabs"><button class="rf-filter active">Alle ('+list.length+')</button><button class="rf-filter">Kundenprojekte</button><button class="rf-filter">Interne Projekte</button></div><label class="rf-portfolio-search"><span>⌕</span><input id="rf-project-search" placeholder="Projekte suchen ..." value="'+safe(state.referenceHqProjectQuery||'')+'"></label></div><div class="rf-project-list">'+(filtered.length?filtered.map(p=>projectRow(p,p.scope_key===selected?.scope_key)).join(''):'<div class="rf-empty">Keine Projekte passen zur Suche.</div>')+'</div></div>'+renderSelected(selected)+'</div></div>';

    root.querySelector('#rf-universal-search')?.addEventListener('input', e => { state.referenceHqQuery = e.target.value; renderReferenceHq(); e.target.focus(); });
    root.querySelectorAll('[data-rf-project]').forEach(row => row.addEventListener('click', async () => { state.selectedScope=row.dataset.rfProject; await ensureDetail(selectedProject()); renderReferenceHq(); }));
    root.querySelectorAll('[data-rf-tab]').forEach(button => button.addEventListener('click', () => openSelectedWorkspace(button.dataset.rfTab)));
    root.querySelector('[data-rf-open-project]')?.addEventListener('click', () => openSelectedWorkspace('overview'));
    root.querySelector('[data-rf-portfolio-open]')?.addEventListener('click', () => { if (typeof go==='function') go('projects'); });root.querySelector('[data-rf-new-project]')?.addEventListener('click', () => { if(typeof go==='function')go('projects');setTimeout(()=>document.getElementById('pm-new-project')?.click(),0); });const projectSearch=root.querySelector('#rf-project-search');if(projectSearch){projectSearch.value=String(state.referenceHqProjectQuery||'');projectSearch.addEventListener('input',e=>{state.referenceHqProjectQuery=e.target.value;renderReferenceHq();document.getElementById('rf-project-search')?.focus()});setTimeout(()=>{const live=document.getElementById('rf-project-search');if(live&&!state.referenceHqProjectQuery)live.value=''},0)};
    root.querySelector('[data-rf-all-attention]')?.addEventListener('click', () => { if (typeof go==='function') go('approvals'); });
    root.querySelectorAll('[data-rf-attention]').forEach((button,i) => button.addEventListener('click', () => { const row=attention[i]; if (!row) return; state.selectedScope=row.project.scope_key; openSelectedWorkspace(row.tab); }));
    root.querySelectorAll('[data-rf-ai-open]').forEach(button => button.addEventListener('click', () => openAi()));
    root.querySelectorAll('[data-rf-ai-prompt]').forEach(button => button.addEventListener('click', () => openAi(button.dataset.rfAiPrompt)));
    if (!state.referenceHqHydrated) void hydrateReferenceHq();
  }

  const priorRenderHq = typeof renderHQ === 'function' ? renderHQ : null;
  renderHQ = renderReferenceHq;
  window.renderHQ = renderReferenceHq;

  if (typeof go === 'function') {
    const priorGo = go;
    go = function(id) {
      document.body.classList.toggle('reference-hq-v1', id === 'hq');
      return priorGo(id);
    };
    window.go = go;
  }

  if (state?.section === 'hq') renderReferenceHq();
})();
</script>`;

export function referenceDrivenHqManifest(){return{schema:'aurentara.project-ferrari.reference-driven-hq.v1',reference:'REFERENCE_01_MASTERDASHBOARD_HQ',presentation_only:true,existing_project_runtime_reused:true,existing_project_source_intake_reused:true,existing_approvals_reused:true,existing_preview_access_reused:true,existing_operator_ai_backbone_reused:true,canonical_scope_keys_preserved:true,production_deploy:false,external_writes:false,fake_business_truth:false}}
