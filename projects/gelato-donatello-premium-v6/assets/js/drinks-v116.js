/* V116 milkshake wheel: progressive enhancement, no external API or images. */
function initGelatoShakeWheel() {
  const section = document.querySelector('[data-shake-showcase]');
  if (!section) return;
  const controls = [...section.querySelectorAll('[data-shake-index]')];
  const frames = [...section.querySelectorAll('[data-shake-frame]')];
  const title = section.querySelector('[data-active-shake-name]');
  const names = ['Erdbeer-Shake','Schoko-Shake','Vanille-Shake'];
  if (controls.length !== 3 || frames.length !== 3 || !title) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, visible = false, manuallyChosen = false, timer = null;
  const pause = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };
  const show = (next, {manual = false} = {}) => {
    const to = (next + 3) % 3;
    index = to;
    controls.forEach((button,i) => {
      button.classList.toggle('is-active', i===to);
      button.setAttribute('aria-pressed',String(i===to));
    });
    frames.forEach((frame,i)=>{
      frame.classList.toggle('is-active',i===to);
      frame.setAttribute('aria-hidden',String(i!==to));
    });
    title.textContent=names[to];
    if(manual){manuallyChosen=true;pause();section.classList.remove('dr116-is-animating');}
  };
  const schedule = () => {
    pause();
    section.classList.toggle('dr116-is-animating',visible&&!motion.matches&&!manuallyChosen&&!document.hidden);
    if (!visible || motion.matches || manuallyChosen || document.hidden) return;
    timer=window.setTimeout(()=>{
      show(index+1);
      schedule();
    },5600);
  };
  controls.forEach(button=>{
    button.addEventListener('click',()=>show(Number(button.dataset.shakeIndex),{manual:true}));
  });
  show(0);
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver(entries=>{
      visible=entries.some(e=>e.isIntersecting);
      schedule();
    },{threshold:.18});
    observer.observe(section);
  }
  document.addEventListener('visibilitychange',schedule);
  motion.addEventListener?.('change',schedule);
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initGelatoShakeWheel,{once:true});
}else initGelatoShakeWheel();
