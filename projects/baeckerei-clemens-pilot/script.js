if (window.gsap && window.ScrollTrigger && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.registerPlugin(ScrollTrigger);

  gsap.from(".hero h1 span", {
    yPercent: 110,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: "power4.out"
  });

  gsap.from(".hero-media", {
    clipPath: "inset(100% 0 0 0)",
    duration: 1.15,
    delay: 0.15,
    ease: "power4.inOut"
  });

  gsap.to(".hero-media img", {
    yPercent: 12,
    scale: 1,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: true
    }
  });

  gsap.to(".craft-shot img", {
    yPercent: 14,
    ease: "none",
    scrollTrigger: {
      trigger: ".craft-shot",
      start: "top bottom",
      end: "bottom top",
      scrub: true
    }
  });

  gsap.utils.toArray(".story-steps article, .product-grid article").forEach((el) => {
    gsap.from(el, {
      y: 42,
      opacity: 0,
      duration: 0.75,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 84%"
      }
    });
  });
}