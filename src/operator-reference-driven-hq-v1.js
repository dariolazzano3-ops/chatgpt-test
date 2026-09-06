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
body.reference-hq-v1 .global-operator-ai-trigger{display:inline-flex;position:fixed!important;right:18px!important;bottom:18px!important;top:auto!important;z-index:70!important;min-height:34px!important;padding:8px 12px!important;border:1px solid rgba(213,174,84,.38)!important;border-radius:999px!important;background:rgba(9,20,26,.94)!important;color:#e7cb81!important;box-shadow:0 12px 30px rgba(0,0,0,.32)!important;font-size:9px!important;letter-spacing:.06em!important;backdrop-filter:blur(12px)}
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

/* AURENTARA-HQ-CONTROL-CENTER-REFERENCE-V1.0 · approved reference alignment */
body.reference-hq-v1{
  --rf-accent:#168cff;
  --rf-accent-2:#52b8ff;
  --rf-accent-soft:rgba(22,140,255,.13);
  --rf-bg:#06101b;
  --rf-bg-2:#081523;
  --rf-panel:#0a1826;
  --rf-panel-2:#0d1d2d;
  --rf-line:#173650;
  --rf-line-soft:#112a3f;
  --rf-text:#f4f8fc;
  --rf-muted:#8299ad;
  --rf-green:#18dda2;
  --rf-yellow:#f4c83d;
  --rf-red:#ff5c6c;
  --rf-blue:#45aaff;
  --rf-gold:var(--rf-accent);
  --rf-gold-2:var(--rf-accent-2);
  --rf-shadow:0 20px 55px rgba(0,0,0,.26);
  background:var(--rf-bg);
}
body.reference-hq-v1 .app{grid-template-columns:216px minmax(0,1fr);background:linear-gradient(145deg,#06101b,#071321 48%,#06101b)}
body.reference-hq-v1 .side{
  padding:18px 14px 16px;
  background:linear-gradient(180deg,#06111d 0%,#071522 72%,#06101a 100%);
  border-right:1px solid #17344c;
  box-shadow:12px 0 38px rgba(0,0,0,.16);
}
body.reference-hq-v1 .side:after{
  opacity:.22;
  background:radial-gradient(circle at 35% 80%,rgba(20,125,226,.28),transparent 31%),linear-gradient(180deg,transparent,#06101a);
  clip-path:none;
}
body.reference-hq-v1 .brand{margin:0 2px 16px;padding:2px 8px 16px;text-align:left;border-bottom:1px solid #17344c}
body.reference-hq-v1 .brand strong{font-size:17px;letter-spacing:.25em;font-weight:650;line-height:1.12}
body.reference-hq-v1 .brand span{font-size:8px;letter-spacing:.25em;color:#718ba2}
body.reference-hq-v1 .rf-hq-nav{gap:0}
.rf-hq-nav-main{display:grid!important;gap:0!important;overflow:visible!important}
.rf-nav-group{padding:10px 0 8px;border-top:1px solid rgba(23,52,76,.72)}
.rf-nav-group:first-child{border-top:0;padding-top:0}
.rf-nav-group-title{padding:0 10px 6px;color:#6f91ad;font-size:8px;font-weight:750;letter-spacing:.24em;text-transform:uppercase}
.rf-nav-group-items{display:grid;gap:3px}
.rf-hq-nav button{min-height:36px;padding:8px 10px;border-radius:7px;color:#b7c8d6;font-size:10.5px;font-weight:560}
.rf-hq-nav button:hover,.rf-hq-nav button:focus-visible{background:#0b2032;color:#fff;border-color:#1c4f75;outline:2px solid rgba(82,184,255,.28);outline-offset:1px}
.rf-hq-nav button.active{background:linear-gradient(90deg,rgba(18,125,244,.36),rgba(13,73,138,.16));border-color:#1768ba;box-shadow:inset 3px 0 0 #3eb2ff,0 0 22px rgba(19,125,244,.10)}
.rf-hq-nav button.active .rf-hq-nav-icon{color:#7bcaff}
.rf-hq-nav-icon{color:#80a8c8}
.rf-hq-system-toggle,.rf-hq-system{display:none!important}
.rf-hq-nav-foot{margin-top:auto;padding:16px 10px 2px;border-top:1px solid #17344c}
.rf-hq-nav-foot strong{color:#eaf5ff;font-size:9px;letter-spacing:.28em}
.rf-hq-nav-foot span{margin-top:10px;color:#66849d;font-size:7.5px}
body.reference-hq-v1 .main{padding:0 16px 22px;background:radial-gradient(circle at 68% 0%,rgba(18,110,190,.12),transparent 30%),linear-gradient(180deg,#07131f,#06101b)}
body.reference-hq-v1 #hq{width:min(100%,1540px)}
.rf-hq-shell{gap:10px}
.rf-toolbar{height:56px;margin:0 -16px;padding:0 16px;border-color:#17344c;background:rgba(5,15,25,.93)}
.rf-search{width:min(365px,45vw);border-color:#214863;background:#071624;border-radius:8px}
.rf-search:focus-within{border-color:#248ee5;box-shadow:0 0 0 3px rgba(36,142,229,.10)}
.rf-env,.rf-region,.rf-operator,.rf-notify{min-height:32px;border-color:#1a405e;background:#071523;color:#b8cbd9}
.rf-env{color:#33e7ad}
.rf-env:before{background:#22e0a8;box-shadow:0 0 0 3px rgba(34,224,168,.10)}
.rf-notify{position:relative;border-radius:8px;cursor:pointer}
.rf-notify b{display:inline-grid;place-items:center;min-width:16px;height:16px;border-radius:999px;background:#ff5163;color:#fff;font-size:8px}
.rf-hero{min-height:116px;padding:16px 10px 14px;border-color:rgba(23,52,76,.75)}
.rf-hero:before{
  left:42%;right:-2%;top:0;bottom:0;inset:auto -2% 0 42%;
  background:
    radial-gradient(ellipse at 70% 115%,rgba(61,172,255,.75) 0 1%,rgba(13,83,153,.65) 14%,rgba(5,28,51,.88) 31%,transparent 32%),
    repeating-radial-gradient(ellipse at 70% 115%,rgba(83,174,240,.13) 0 1px,transparent 2px 19px),
    radial-gradient(ellipse at 62% 92%,rgba(30,129,222,.18),transparent 48%);
  opacity:.82;
}
.rf-hero:after{
  left:49%;right:0;top:0;bottom:0;height:auto;opacity:.28;clip-path:none;
  background:linear-gradient(12deg,transparent 0 46%,rgba(67,151,224,.34) 47% 48%,transparent 49%),
             linear-gradient(168deg,transparent 0 54%,rgba(67,151,224,.18) 55% 56%,transparent 57%);
}
.rf-kicker{color:#b9d6ec;font-size:9px;letter-spacing:.30em}
.rf-hero h1{margin:6px 0 4px;font-size:37px;font-weight:760;letter-spacing:.02em;text-transform:uppercase}
.rf-hero p{font-size:12px;color:#bac9d5}
.rf-hero-motto{right:18px;top:24px;color:#a8bfd1;font-size:8px;letter-spacing:.27em}
.rf-hero-motto:after{background:#1592ff}
.rf-kpis{gap:10px}
.rf-kpi{appearance:none;width:100%;min-height:92px;padding:14px;border-color:#1d4f75;border-radius:8px;background:linear-gradient(145deg,#0a1a2a,#0a1724);box-shadow:inset 0 0 0 1px rgba(35,134,215,.04),0 14px 38px rgba(0,0,0,.18);text-align:left;color:inherit}
.rf-kpi:hover,.rf-kpi:focus-visible{border-color:#298fdf;box-shadow:0 0 0 2px rgba(35,143,226,.10),0 14px 38px rgba(0,0,0,.22);outline:none}
.rf-kpi-icon{width:42px;height:42px;flex-basis:42px;border-radius:12px;background:rgba(31,136,236,.14)!important;color:#6bc3ff!important;box-shadow:inset 0 0 0 1px rgba(75,171,246,.18)}
.rf-kpi:nth-child(2) .rf-kpi-icon{color:#31e0b1!important;background:rgba(24,221,162,.12)!important}
.rf-kpi:nth-child(3) .rf-kpi-icon{color:#ff6b79!important;background:rgba(255,92,108,.12)!important}
.rf-kpi-label{color:#d8e5ee}
.rf-kpi-value{font-size:26px}
.rf-kpi-meta{color:#6d8aa0}
.rf-grid-mid{grid-template-columns:1.02fr .98fr;gap:10px}
.rf-panel{border-color:#1a4566;border-radius:8px;background:linear-gradient(145deg,rgba(9,25,39,.99),rgba(6,19,31,.99));box-shadow:0 14px 40px rgba(0,0,0,.20)}
.rf-panel-head{min-height:50px;padding:11px 13px;border-color:#12344f}
.rf-panel-title .ico{color:#5db8ff}
.rf-panel-title h2{font-size:13px}
.rf-panel-title p{font-size:9px}
.rf-link{color:#66bfff}
.rf-link:hover{color:#b7e2ff}
.rf-attention-table-wrap,.rf-portfolio-table-wrap{overflow:auto;scrollbar-width:thin}
.rf-attention-table,.rf-portfolio-table{width:100%;border-collapse:collapse;table-layout:fixed}
.rf-attention-table th,.rf-portfolio-table th{padding:8px 9px;color:#7595ad;font-size:8px;font-weight:650;text-transform:none;text-align:left;border-bottom:1px solid #17344c}
.rf-attention-table td,.rf-portfolio-table td{padding:9px;border-bottom:1px solid #112d45;color:#c9d8e3;font-size:9px;vertical-align:middle;overflow-wrap:anywhere}
.rf-attention-table tr:last-child td,.rf-portfolio-table tr:last-child td{border-bottom:0}
.rf-attention-priority{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.rf-attention-priority .rf-dot{width:7px;height:7px}
.rf-attention-action,.rf-open-project{min-height:28px;padding:5px 10px;border:1px solid #2b6795;border-radius:6px;background:#0b2133;color:#d8efff;font-size:8.5px;white-space:nowrap}
.rf-attention-action:hover,.rf-open-project:hover{border-color:#3aa8ff;background:#0e2b43}
.rf-ai-message{border-color:#1a4566;background:#071724}
.rf-ai-action{border-color:#215271;background:#0b1d2d;color:#c4d8e5}
.rf-ai-action:hover{border-color:#278ddd;color:#fff}
.rf-ai-new{border-color:#287ec0;background:rgba(22,140,255,.13);color:#8fd0ff}
.rf-new-project{border-color:#168cff;background:linear-gradient(180deg,#208ff8,#086ccf);color:#fff;box-shadow:0 7px 22px rgba(13,121,229,.24)}
.rf-ai-input{border-color:#1c4b6c;background:#071724}
.rf-ops-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(420px,.95fr);gap:10px}
.rf-side-zone{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:10px;min-width:0}
.rf-side-stack{display:grid;grid-template-rows:auto auto;gap:10px;align-content:start;min-width:0}
.rf-portfolio-toolbar{padding:8px 12px;border-color:#12344f}
.rf-portfolio-search{min-width:210px;border-color:#1d4561;background:#071724}
.rf-portfolio-summary{display:inline-flex;align-items:center;gap:6px;color:#87a2b6;font-size:8.5px}
.rf-portfolio-summary b{color:#ddebF5}
.rf-portfolio-table th:nth-child(1){width:25%}.rf-portfolio-table th:nth-child(2){width:9%}.rf-portfolio-table th:nth-child(3){width:12%}.rf-portfolio-table th:nth-child(4){width:11%}.rf-portfolio-table th:nth-child(5){width:15%}.rf-portfolio-table th:nth-child(6){width:18%}.rf-portfolio-table th:nth-child(7){width:10%}
.rf-project-table-row{cursor:default}
.rf-project-table-row:hover{background:rgba(18,107,181,.06)}
.rf-project-cell{display:flex;align-items:center;gap:9px;min-width:0}
.rf-project-cell .rf-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:7px;background:linear-gradient(145deg,#14314a,#1a496d);font-size:8px}
.rf-project-name{font-size:9.5px}
.rf-project-scope{font-size:7.5px;color:#67849a}
.rf-state{padding:4px 6px;border-color:#264b64;color:#9db4c4;font-size:7.5px}
.rf-state.ready{border-color:rgba(24,221,162,.42);color:#31e0ae;background:rgba(24,221,162,.08)}
.rf-state.attention{border-color:rgba(244,200,61,.45);color:#f3ca42;background:rgba(244,200,61,.08)}
.rf-state.blocked{border-color:rgba(255,92,108,.46);color:#ff7080;background:rgba(255,92,108,.08)}
.rf-state.phase{border-color:#2575aa;color:#76c2f7;background:rgba(37,117,170,.10)}
.rf-state.env{border-color:#42627a;color:#bdd0dd;background:rgba(107,139,164,.07)}
.rf-table-progress{display:grid;grid-template-columns:35px 1fr;gap:7px;align-items:center;min-width:84px}
.rf-table-progress b{font-size:8px;color:#d4e3ed}
.rf-progress{height:6px;margin:0;background:#143047}
.rf-progress span{background:linear-gradient(90deg,#18dda2,#2ae5b0)}
.rf-next-table{font-size:8px;color:#a9bfce}
.rf-status-list{padding:4px 12px 10px}
.rf-status-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:31px;border-top:1px solid #112d45;font-size:8.5px}
.rf-status-row:first-child{border-top:0}
.rf-status-row i{width:7px;height:7px;border-radius:50%;background:#6f8799}
.rf-status-row i.ready{background:#18dda2}.rf-status-row i.attention{background:#f4c83d}.rf-status-row i.blocked{background:#ff5c6c}.rf-status-row i.neutral{background:#6f8799}
.rf-status-row span{color:#b7cbd9}.rf-status-row b{color:#8fd0ff;font-weight:600;text-align:right}
.rf-cost-body{padding:10px 12px}
.rf-cost-line{display:flex;justify-content:space-between;gap:10px;padding:5px 0;color:#8ba3b5;font-size:8.5px}
.rf-cost-line b{color:#e4eef5;font-weight:650}
.rf-cost-state{margin-top:8px;padding-top:8px;border-top:1px solid #112d45;color:#7292a9;font-size:7.5px;line-height:1.45}
.rf-activity-card{min-height:100%}
.rf-activity-list{padding:4px 12px 8px}
.rf-activity-row{display:grid;grid-template-columns:10px minmax(0,1fr);gap:8px;padding:8px 0;border-top:1px solid #112d45}
.rf-activity-row:first-child{border-top:0}
.rf-activity-icon{color:#53baff;font-size:9px}
.rf-activity-main strong{display:block;color:#d8e5ee;font-size:8.5px;font-weight:600}
.rf-activity-main span{display:block;margin-top:2px;color:#69879d;font-size:7.5px}
.rf-bottom-strip{display:grid;grid-template-columns:1.05fr .8fr .6fr;gap:10px}
.rf-bottom-card{min-height:64px;padding:10px 12px;border:1px solid #173f5e;border-radius:8px;background:#081827;display:flex;align-items:center;gap:10px}
.rf-bottom-icon{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border:1px solid #1d5f8e;border-radius:8px;background:rgba(22,140,255,.10);color:#72c6ff;font-size:16px}
.rf-bottom-main{min-width:0;flex:1}.rf-bottom-main strong{display:block;color:#e8f2f8;font-size:9px}.rf-bottom-main span{display:block;margin-top:2px;color:#7895aa;font-size:7.5px}
.rf-bottom-progress{width:120px;max-width:30%;height:6px;border-radius:99px;background:#153149;overflow:hidden}.rf-bottom-progress span{display:block;height:100%;background:#18dda2}
.rf-bottom-card.actionable{cursor:pointer}.rf-bottom-card.actionable:hover{border-color:#278ddd}
.rf-quote{justify-content:center;text-align:center;color:#8da5b7;font-size:8px;line-height:1.5}
.rf-quote b{display:block;margin-top:4px;color:#6fbef7;font-size:7px;letter-spacing:.12em}
body.reference-hq-v1 .global-operator-ai-trigger{border-color:#2b77aa!important;background:rgba(6,22,35,.95)!important;color:#9ad6ff!important}
@media(max-width:1260px){
  .rf-ops-grid{grid-template-columns:1fr}
  .rf-side-zone{grid-template-columns:1fr 1fr}
  .rf-side-stack{grid-template-rows:none}
  .rf-bottom-strip{grid-template-columns:1fr 1fr}.rf-quote{grid-column:1/-1}
}
@media(max-width:900px){
  body.reference-hq-v1 .app{grid-template-columns:188px minmax(0,1fr)}
  .rf-side-zone{grid-template-columns:1fr}
}
@media(max-width:760px){
  body.reference-hq-v1 .side{padding:12px 10px}
  body.reference-hq-v1 .brand{margin:0;padding:0 4px 10px}
  body.reference-hq-v1 .brand strong{font-size:14px}
  body.reference-hq-v1 .rf-hq-nav{display:block!important}
  .rf-hq-nav-main{display:flex!important;gap:5px!important;overflow-x:auto!important;padding:5px 0!important}
  .rf-nav-group{display:contents}
  .rf-nav-group-title{display:none}
  .rf-nav-group-items{display:flex;gap:5px}
  .rf-hq-nav-main button{width:auto;min-width:max-content;min-height:36px;padding:8px 10px}
  .rf-toolbar{padding:8px 10px}
  .rf-hero{min-height:104px;padding:14px 0}
  .rf-hero:before{left:40%;opacity:.45}
  .rf-hero h1{font-size:27px;line-height:1.04}
  .rf-hero p{max-width:78%;font-size:10px}
  .rf-kpis,.rf-grid-mid,.rf-ops-grid,.rf-side-zone,.rf-bottom-strip{grid-template-columns:1fr}
  .rf-kpi{min-height:80px}
  .rf-attention-table,.rf-portfolio-table{min-width:760px}
  .rf-attention-table-wrap,.rf-portfolio-table-wrap{margin:0}
  .rf-portfolio-toolbar{align-items:stretch;flex-direction:column}
  .rf-portfolio-search{width:100%}
  .rf-bottom-card{min-height:58px}
  .rf-bottom-progress{max-width:34%}
  .rf-quote{grid-column:auto}
}
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
    const c = projectContext(p);
    const life = lifecycle(p,c);
    const pct = progress(p,life);
    const action = nextAction(p,c);
    return '<tr class="rf-project-table-row" data-rf-project-row="'+safe(p.scope_key||'')+'"><td><div class="rf-project-cell"><div class="rf-avatar">'+safe(initials(p))+'</div><div><div class="rf-project-name">'+safe(displayName(p))+'</div><div class="rf-project-scope">'+safe(p.scope_key||'')+'</div></div></div></td><td><span class="rf-state phase">'+safe(life.phase)+'</span></td><td><span class="rf-state '+statusClass(life.health)+'">'+safe(life.health)+'</span></td><td><span class="rf-state env">'+safe(life.environment)+'</span></td><td><div class="rf-table-progress"><b>'+pct+' %</b><div class="rf-progress"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div></div></td><td><span class="rf-next-table">'+safe(action.label)+'</span></td><td><button type="button" class="rf-open-project" data-rf-project-open="'+safe(p.scope_key||'')+'" data-rf-project-tab="'+safe(action.tab||'overview')+'">Öffnen</button></td></tr>';
  }

  function activityMarkup  function activityMarkup(project, detail) {
    const local = Array.isArray(detail?.timeline) ? detail.timeline : [];
    const global = Array.isArray(state?.data?.audit?.items) ? state.data.audit.items.filter(x => !project?.scope_key || x.scope_key === project.scope_key).slice(0,4) : [];
    const rows = (local.length ? local.slice(-4).reverse() : global.slice(0,4));
    if (!rows.length) return '<div class="rf-empty">Noch keine projektbezogene Aktivität.</div>';
    return '<div class="rf-activity">'+rows.map(x => '<div><i></i><span>'+safe((typeof humanEvent==='function'?humanEvent(x.event||x.type||'Activity').label:(x.event||x.type||'Aktivität')))+'</span><span>'+safe(time(x.at))+'</span></div>').join('')+'</div>';
  }

  function rawTone(raw='') {
    const value=U(raw);
    if (value.includes('BLOCK') || value.includes('FAIL') || value.includes('ERROR')) return 'blocked';
    if (value.includes('DEGRADED') || value.includes('STALE') || value.includes('ATTENTION') || value.includes('PENDING') || value.includes('NOT_VERIFIED')) return 'attention';
    if (value.includes('HEALTHY') || value.includes('VERIFIED') || value.includes('READY') || value.includes('ONLINE') || value.includes('CONNECTED') || value.includes('AVAILABLE')) return 'ready';
    return 'neutral';
  }

  function systemStatusMarkup() {
    const h=state?.data?.health||{};
    const factories=Array.isArray(state?.data?.factories?.items)?state.data.factories.items:[];
    const providers=Array.isArray(state?.data?.providers?.active_runtime_providers)?state.data.providers.active_runtime_providers:[];
    const healthyFactories=factories.filter(x=>rawTone(x.status)==='ready').length;
    const rows=[
      ['Factories',factories.length?healthyFactories+'/'+factories.length+' verifiziert':'Keine Runtime-Daten',factories.length&&healthyFactories===factories.length?'ready':factories.length?'attention':'neutral'],
      ['Providers',providers.length?providers.length+' Runtime-Routen':'Keine Runtime-Route',providers.length?'ready':'neutral'],
      ['Control Plane',h.control_plane?.label||h.control_plane?.raw||'Nicht verifiziert',rawTone(h.control_plane?.raw)],
      ['CI',h.ci?.label||h.ci?.raw||'Nicht verifiziert',rawTone(h.ci?.raw)],
      ['Production',h.production?.label||h.production?.raw||'Gesperrt',rawTone(h.production?.raw)]
    ];
    return '<div class="rf-status-list">'+rows.map(([label,value,tone])=>'<div class="rf-status-row"><i class="'+tone+'"></i><span>'+safe(label)+'</span><b>'+safe(value)+'</b></div>').join('')+'</div>';
  }

  function hasRealNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }

  function moneyOrUnavailable(value) {
    return hasRealNumber(value) ? money(Number(value)) : 'Nicht verfügbar';
  }

  function costMarkup() {
    const c=state?.data?.costs||{};
    const rows=[
      ['Ausgegeben',moneyOrUnavailable(c.spent_eur)],
      ['Prognose',moneyOrUnavailable(c.estimated_eur)],
      ['Reserviert',moneyOrUnavailable(c.reserved_eur)],
      ['Verbleibendes Budget',moneyOrUnavailable(c.remaining_development_budget_eur)]
    ];
    return '<div class="rf-cost-body">'+rows.map(([label,value])=>'<div class="rf-cost-line"><span>'+safe(label)+'</span><b>'+safe(value)+'</b></div>').join('')+'<div class="rf-cost-state">'+safe(c.variable_cost_state||'Kostenstatus nicht verifiziert')+' · Keine Budgetwerte werden aus der Referenz übernommen.</div></div>';
  }

  function recentActivityMarkup() {
    const items=Array.isArray(state?.data?.audit?.items)?state.data.audit.items.slice(0,5):[];
    if(!items.length) return '<div class="rf-empty">Noch keine autoritative Aktivität.</div>';
    return '<div class="rf-activity-list">'+items.map(x=>{const evt=(typeof humanEvent==='function'?humanEvent(x.event||x.type||'Activity').label:(x.event||x.type||'Aktivität'));const scope=x.scope_key||x.mission_id||x.actor||x.source||'System';return '<div class="rf-activity-row"><span class="rf-activity-icon">◈</span><div class="rf-activity-main"><strong>'+safe(evt)+'</strong><span>'+safe(scope)+' · '+safe(time(x.at))+'</span></div></div>'}).join('')+'</div>';
  }

  function decisionCount() {
    const openInputs=projects().reduce((sum,p)=>sum+N(projectContext(p).open_input_count),0);
    return openInputs+approvalCount();
  }

  function milestoneMarkup() {
    const p=selectedProject();
    if(!p) return '<div class="rf-bottom-card"><div class="rf-bottom-icon">⚑</div><div class="rf-bottom-main"><strong>Nächster Meilenstein</strong><span>Kein Projekt ausgewählt.</span></div></div>';
    const c=projectContext(p),life=lifecycle(p,c),pct=progress(p,life),action=nextAction(p,c);
    return '<button type="button" class="rf-bottom-card actionable" data-rf-milestone><div class="rf-bottom-icon">⚑</div><div class="rf-bottom-main"><strong>Nächster Meilenstein</strong><span>'+safe(displayName(p))+' · '+safe(action.label)+'</span></div><div class="rf-bottom-progress" aria-label="Fortschritt '+pct+' Prozent"><span style="width:'+Math.max(0,Math.min(100,pct))+'%"></span></div><b style="font-size:9px;color:#dceaf4">'+pct+' %</b></button>';
  }

  function renderAttention  function renderAttention(rows) {
    const body=rows.length?rows.map((r,i)=>{
      const priority=r.tone==='blocked'?'Hoch':'Mittel';
      const impact=r.tone==='blocked'?'Umsetzung blockiert':r.tab==='knowledge'?'Qualität / Richtigkeit offen':r.tab==='approvals'?'Entscheidung erforderlich':'Projektfortschritt wartet';
      return '<tr><td><span class="rf-attention-priority"><span class="rf-dot '+(r.tone==='blocked'?'blocked':'')+'"></span>'+safe(priority)+'</span></td><td>'+safe(displayName(r.project))+'</td><td>'+safe(r.text)+'</td><td>'+safe(impact)+'</td><td>—</td><td><button type="button" class="rf-attention-action" data-rf-attention="'+i+'">Prüfen</button></td></tr>';
    }).join(''):'<tr><td colspan="6" class="rf-empty">Aktuell keine offenen projektbezogenen Attention-Punkte.</td></tr>';
    return '<div class="rf-attention-table-wrap"><table class="rf-attention-table"><thead><tr><th>Priorität</th><th>Projekt</th><th>Thema</th><th>Auswirkung</th><th>Fällig</th><th>Aktion</th></tr></thead><tbody>'+body+'</tbody></table></div>';
  }

  function renderReferenceSidebar  function renderReferenceSidebar() {
    const side = document.querySelector('.side');
    if (!side || side.querySelector('.rf-hq-nav')) return;
    const nav = document.createElement('div');
    nav.className = 'rf-hq-nav';
    const groups=[
      ['CONTROL CENTER',[
        ['hq','⌂','Dashboard','hq'],
        ['projects','▦','Portfolio','projects'],
        ['attention','⚠','Aufmerksamkeit','attention'],
        ['approvals','✓','Freigaben','approvals'],
        ['costs','◉','Kosten','costs']
      ]],
      ['PROJEKTE',[
        ['project-overview','▤','Projektübersicht','overview'],
        ['sources','◎','Quellen','sources'],
        ['knowledge','▥','Projektwissen','knowledge'],
        ['implementation','◇','Umsetzung','implementation'],
        ['preview','▱','Vorschau','preview'],
        ['project-approvals','◉','Prüfungen','approvals-workspace'],
        ['project-activity','⌁','Aktivität','activity']
      ]],
      ['SYSTEM',[
        ['factories','⌘','Factories','factories'],
        ['providers','◌','Providers','providers'],
        ['health','♡','System Health','health'],
        ['audit','▧','Audit Log','audit'],
        ['settings','⚙','Einstellungen','settings']
      ]],
      ['KI',[
        ['operator-ai','✦','Operator KI','ai']
      ]]
    ];
    nav.innerHTML='<div class="rf-hq-nav-main">'+groups.map(([title,items])=>'<div class="rf-nav-group"><div class="rf-nav-group-title">'+title+'</div><div class="rf-nav-group-items">'+items.map(([id,ico,label,target])=>'<button type="button" data-rf-nav="'+id+'" data-rf-target="'+target+'" class="'+(id==='hq'?'active':'')+'"><span class="rf-hq-nav-icon">'+ico+'</span><span>'+label+'</span></button>').join('')+'</div></div>').join('')+'</div><div class="rf-hq-nav-foot"><strong>IDEEN<br>IN WIRKUNG<br>BRINGEN</strong><span>AURENTARA SYSTEMS<br>powered by RIOSYSTEMS</span></div>';
    side.insertBefore(nav, side.querySelector('.nav'));
    nav.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-rf-nav]');
      if (!button) return;
      event.stopPropagation();
      const target = button.dataset.rfTarget;
      if (target === 'ai') return openAi();
      if (target === 'attention') {
        if(typeof go==='function') go('hq');
        setTimeout(()=>document.querySelector('.rf-attention-anchor')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
        return;
      }
      if (['overview','sources','knowledge','implementation','preview','activity'].includes(target)) return openSelectedWorkspace(target);
      if (target === 'approvals-workspace') return openSelectedWorkspace('approvals');
      if (typeof go === 'function') go(target);
    });
  }

  function openAi  function openAi(prompt = '') {
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
    const projectNeedle=String(state.referenceHqProjectQuery||state.referenceHqQuery||'').toLowerCase();
    const filtered = list.filter(p => !projectNeedle || [p.name,p.project_id,p.customer_id,p.scope_key].some(v => String(v||'').toLowerCase().includes(projectNeedle))).slice(0,8);
    const openInputs = list.reduce((sum,p)=>sum+N(projectContext(p).open_input_count),0);
    const previews = list.filter(p => p.project_preview_access?.available === true).length;
    const attention = attentionRows(list);
    const decisions=decisionCount();
    root.innerHTML='<div class="rf-hq-shell" data-hydrated="'+(state.referenceHqHydrated?'true':'false')+'">'+
      '<div class="rf-toolbar"><label class="rf-search"><span>⌕</span><input id="rf-universal-search" aria-label="Universelle Suche" placeholder="Universelle Suche ..." value="'+(state.referenceHqQuery?safe(state.referenceHqQuery):'')+'"></label><div class="rf-toolbar-right"><span class="rf-env">STAGING</span><span class="rf-region">Private Operator</span>'+(decisions?'<button type="button" class="rf-notify" data-rf-decisions aria-label="'+decisions+' offene Entscheidungen">♢ <b>'+decisions+'</b></button>':'')+'<span class="rf-operator"><b>OP</b> AURENTARA</span></div></div>'+
      '<div class="rf-hero"><div><div class="rf-kicker">AURENTARA CONTROL CENTER</div><h1>RIOSYSTEMS DASHBOARD</h1><p>Alle Projekte. Alle Prozesse. Alle wichtigen Entscheidungen. An einem Ort.</p></div><div class="rf-hero-motto">EIN SYSTEM.<br>ALLE MÖGLICHKEITEN.<br>SKALIERBAR.<br>POWERED BY RIOSYSTEMS.</div></div>'+
      '<div class="rf-kpis">'+[
        ['▢','Aktive Projekte',list.length,'Reale Portfolio-Truth','projects'],
        ['▤','Offene Eingaben',openInputs,'Kundenangaben und Wissensprüfung','inputs'],
        ['◷','Ausstehende Freigaben',approvalCount(),'Bestehender Approval Contract','approvals'],
        ['▣','Bereit für Preview',previews,'Project Preview Access','previews']
      ].map(x=>'<button type="button" class="rf-kpi" data-rf-kpi="'+x[4]+'"><div class="rf-kpi-icon">'+x[0]+'</div><div><div class="rf-kpi-label">'+x[1]+'</div><div class="rf-kpi-value">'+safe(x[2])+'</div><div class="rf-kpi-meta">'+x[3]+'</div></div></button>').join('')+'</div>'+
      '<div class="rf-grid-mid"><div class="rf-panel rf-attention-anchor"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico" style="color:var(--rf-red)">⚠</span><div><h2>Needs Attention</h2><p>Projekte und Aufgaben, die Ihre Aufmerksamkeit benötigen.</p></div></div><button class="rf-link" data-rf-all-attention>Alle anzeigen →</button></div>'+renderAttention(attention)+'</div>'+
      '<div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">✦</span><div><h2>Operator KI</h2><p>Ihr intelligenter Projektassistent, powered by RIOSYSTEMS.</p></div></div><button class="rf-ai-new" data-rf-ai-open>Neuer Chat +</button></div><div class="rf-ai-body"><div class="rf-ai-message"><strong>Hallo! Ich bin Ihr AURENTARA Operator.</strong>Ich unterstütze Sie bei Analyse, Planung und Umsetzung. Die bestehende Operator AI bleibt der einzige autoritative AI-Backbone.</div><div class="rf-ai-actions"><button class="rf-ai-action" data-rf-ai-prompt="Fasse den aktuellen Projektstatus zusammen.">Projektstatus zusammenfassen</button><button class="rf-ai-action" data-rf-ai-prompt="Analysiere die aktuell wichtigsten Risiken und Blocker.">Risiken analysieren</button><button class="rf-ai-action" data-rf-ai-prompt="Empfiehl die nächsten sinnvollen Schritte.">Nächste Schritte empfehlen</button><button class="rf-ai-action" data-rf-ai-prompt="Analysiere die aktuellen Kosten und Kostenschätzungen.">Kosten analysieren</button></div><button class="rf-ai-input" data-rf-ai-open><span>Stellen Sie mir eine Frage ...</span><span>▷</span></button></div></div></div>'+
      '<div class="rf-ops-grid"><div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">▢</span><div><h2>Projektportfolio</h2><p>Alle Kunden- und internen Projekte auf einen Blick.</p></div></div><div style="display:flex;gap:7px"><button class="rf-ai-new rf-new-project" data-rf-new-project>+ Neues Projekt</button><button class="rf-link" data-rf-portfolio-open>Alle öffnen →</button></div></div><div class="rf-portfolio-toolbar"><span class="rf-portfolio-summary">Alle <b>'+list.length+'</b></span><label class="rf-portfolio-search"><span>⌕</span><input id="rf-project-search" aria-label="Projekte durchsuchen" placeholder="Projekte durchsuchen ..." value="'+safe(state.referenceHqProjectQuery||'')+'"></label></div><div class="rf-portfolio-table-wrap"><table class="rf-portfolio-table"><thead><tr><th>Projekt</th><th>Phase</th><th>Health</th><th>Umgebung</th><th>Fortschritt</th><th>Nächste Aktion</th><th>Aktionen</th></tr></thead><tbody>'+(filtered.length?filtered.map(p=>projectRow(p,false)).join(''):'<tr><td colspan="7" class="rf-empty">Keine Projekte passen zur Suche.</td></tr>')+'</tbody></table></div></div>'+
      '<div class="rf-side-zone"><div class="rf-side-stack"><div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">⌁</span><div><h2>System Status</h2></div></div><button class="rf-link" data-rf-section="health">Alle Systeme →</button></div>'+systemStatusMarkup()+'</div><div class="rf-panel"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">◉</span><div><h2>Kosten / Prognose</h2></div></div><button class="rf-link" data-rf-section="costs">Details →</button></div>'+costMarkup()+'</div></div>'+
      '<div class="rf-panel rf-activity-card"><div class="rf-panel-head"><div class="rf-panel-title"><span class="ico">▧</span><div><h2>Letzte Aktivitäten</h2></div></div><button class="rf-link" data-rf-section="audit">Alle anzeigen →</button></div>'+recentActivityMarkup()+'</div></div></div>'+
      '<div class="rf-bottom-strip">'+milestoneMarkup()+'<button type="button" class="rf-bottom-card actionable" data-rf-decisions><div class="rf-bottom-icon">✓</div><div class="rf-bottom-main"><strong>Offene Entscheidungen</strong><span>'+decisions+' offene Eingaben / Freigaben</span></div><span style="color:#69c3ff">→</span></button><div class="rf-bottom-card rf-quote">Technologie wird dann wertvoll, wenn sie Menschen wirklich weiterbringt.<b>AURENTARA SYSTEMS</b></div></div>'+
      '</div>';

    root.querySelector('#rf-universal-search')?.addEventListener('input', e => { state.referenceHqQuery = e.target.value; state.referenceHqProjectQuery=e.target.value; renderReferenceHq(); document.getElementById('rf-universal-search')?.focus(); });
    root.querySelectorAll('[data-rf-project-open]').forEach(button=>button.addEventListener('click',async e=>{e.stopPropagation();state.selectedScope=button.dataset.rfProjectOpen;await ensureDetail(selectedProject());openSelectedWorkspace(button.dataset.rfProjectTab||'overview')}));
    root.querySelector('[data-rf-portfolio-open]')?.addEventListener('click', () => { if (typeof go==='function') go('projects'); });
    root.querySelector('[data-rf-new-project]')?.addEventListener('click', () => { if(typeof go==='function')go('projects');setTimeout(()=>document.getElementById('pm-new-project')?.click(),0); });
    const projectSearch=root.querySelector('#rf-project-search');
    if(projectSearch){projectSearch.addEventListener('input',e=>{state.referenceHqProjectQuery=e.target.value;renderReferenceHq();document.getElementById('rf-project-search')?.focus()})}
    root.querySelector('[data-rf-all-attention]')?.addEventListener('click', () => { if(attention.length){state.selectedScope=attention[0].project.scope_key;openSelectedWorkspace(attention[0].tab)}else if(typeof go==='function')go('approvals') });
    root.querySelectorAll('[data-rf-attention]').forEach((button,i) => button.addEventListener('click', () => { const row=attention[i]; if (!row) return; state.selectedScope=row.project.scope_key; openSelectedWorkspace(row.tab); }));
    root.querySelectorAll('[data-rf-ai-open]').forEach(button => button.addEventListener('click', () => openAi()));
    root.querySelectorAll('[data-rf-ai-prompt]').forEach(button => button.addEventListener('click', () => openAi(button.dataset.rfAiPrompt)));
    root.querySelectorAll('[data-rf-section]').forEach(button=>button.addEventListener('click',()=>{if(typeof go==='function')go(button.dataset.rfSection)}));
    root.querySelectorAll('[data-rf-decisions]').forEach(button=>button.addEventListener('click',()=>{if(typeof go==='function')go('approvals')}));
    root.querySelector('[data-rf-milestone]')?.addEventListener('click',()=>openSelectedWorkspace(nextAction(selectedProject()||{},projectContext(selectedProject()||{})).tab||'overview'));
    root.querySelectorAll('[data-rf-kpi]').forEach(button=>button.addEventListener('click',()=>{
      const target=button.dataset.rfKpi;
      if(target==='projects'&&typeof go==='function')return go('projects');
      if(target==='approvals'&&typeof go==='function')return go('approvals');
      if(target==='inputs'){const row=attention.find(x=>x.tab==='approvals'||x.tab==='knowledge');if(row){state.selectedScope=row.project.scope_key;return openSelectedWorkspace(row.tab)}if(typeof go==='function')return go('projects')}
      if(target==='previews'){const p=list.find(x=>x.project_preview_access?.available===true);if(p){state.selectedScope=p.scope_key;return openSelectedWorkspace('preview')}if(typeof go==='function')return go('projects')}
    }));
    if (!state.referenceHqHydrated) void hydrateReferenceHq();
  }

  const priorRenderHq  const priorRenderHq = typeof renderHQ === 'function' ? renderHQ : null;
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

export function referenceDrivenHqManifest(){return{schema:'aurentara.project-ferrari.reference-driven-hq.v1',reference:'AURENTARA-HQ-CONTROL-CENTER-REFERENCE-V1.0',reference_status:'APPROVED_REFERENCE',presentation_only:true,existing_project_runtime_reused:true,existing_project_source_intake_reused:true,existing_approvals_reused:true,existing_preview_access_reused:true,existing_operator_ai_backbone_reused:true,canonical_scope_keys_preserved:true,production_deploy:false,external_writes:false,fake_business_truth:false}}
