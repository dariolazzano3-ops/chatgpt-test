/* V111: four accessible hash-linked galleries. Without JS all 31 products remain visible. */
function initGelatoCupCategories() {
  const root = document.querySelector('.cups111');
  if (!root) return;
  const nav = root.querySelector('[data-cups-tabs]');
  const tabs = [...nav.querySelectorAll('[data-cups-category]')];
  const panels = [...root.querySelectorAll('[data-cups-panel]')];
  const status = root.querySelector('[data-cups-status]');
  const aliases = {'spaghetti-eis':'spaghetti-eisbecher','joghurt-eisbecher':'joghurtbecher','becher-fuer-jeden-geschmack':'eisbecher'};
  const ids = new Set(tabs.map(tab => tab.dataset.cupsCategory));
  const resolve = () => {
    let hash = '';
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { return 'eisbecher'; }
    const resolved = aliases[hash] || hash;
    return ids.has(resolved) ? resolved : 'eisbecher';
  };
  let active = '';
  const activate = (id, {focus = false, announce = true} = {}) => {
    if (!ids.has(id)) return;
    const changed = active !== id;
    active = id;
    for (const tab of tabs) {
      const selected = tab.dataset.cupsCategory === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({preventScroll:true});
    }
    for (const panel of panels) panel.hidden = panel.dataset.cupsPanel !== id;
    if (status && changed && announce) {
      const tab = tabs.find(x => x.dataset.cupsCategory === id);
      const panel = panels.find(x => x.dataset.cupsPanel === id);
      status.textContent = tab.querySelector('strong').textContent.trim() + ': ' +
        panel.querySelectorAll('.cups111-product').length + ' Kreationen sichtbar.';
    }
  };
  nav.setAttribute('role','tablist');
  nav.setAttribute('aria-label','Eisbecher-Kategorien');
  tabs.forEach(tab => {
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-selected','false');
    tab.tabIndex = -1;
    tab.addEventListener('click', event => {
      event.preventDefault();
      const id=tab.dataset.cupsCategory;
      if (location.hash !== '#' + id) history.pushState({cupsCategory:id}, '', '#' + id);
      activate(id);
    });
    tab.addEventListener('keydown', event => {
      const index=tabs.indexOf(tab);
      let next=index;
      if (event.key==='ArrowRight') next=(index+1)%tabs.length;
      else if (event.key==='ArrowLeft') next=(index-1+tabs.length)%tabs.length;
      else if (event.key==='Home') next=0;
      else if (event.key==='End') next=tabs.length-1;
      else return;
      event.preventDefault();
      const target=tabs[next],id=target.dataset.cupsCategory;
      if (location.hash !== '#' + id) history.pushState({cupsCategory:id}, '', '#' + id);
      activate(id,{focus:true});
    });
  });
  panels.forEach(panel=>panel.setAttribute('role','tabpanel'));
  activate(resolve(),{announce:false});
  root.setAttribute('data-cups-enhanced','');
  const onNavigation=()=>activate(resolve(),{announce:false});
  window.addEventListener('hashchange',onNavigation);
  window.addEventListener('popstate',onNavigation);
}
if (document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded',initGelatoCupCategories,{once:true});
} else initGelatoCupCategories();
