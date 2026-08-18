document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.querySelector(".hero__projection");
  const host = canvas?.parentElement;
  const context = canvas?.getContext("2d");

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  if (!canvas || !host || !context) return;

  const fishSeeds = [
    [0.17, 0.22, 0.16, 0.03, 18, 0.4, "ivory"],
    [0.44, 0.17, -0.12, 0.05, 14, 1.8, "amber"],
    [0.73, 0.31, 0.11, -0.02, 20, 3.1, "ivory"],
    [0.28, 0.52, -0.14, -0.03, 16, 4.5, "ivory"],
    [0.61, 0.57, 0.13, 0.04, 13, 5.2, "amber"],
    [0.83, 0.68, -0.1, 0.02, 17, 2.4, "ivory"],
  ];
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const pointer = { x: 0, y: 0, active: false };
  const ripples = [];
  let fish = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let lastRippleAt = 0;

  const resetFish = () => {
    fish = fishSeeds.map(([x, y, vx, vy, size, phase, tone]) => ({
      x: x * width,
      y: y * height,
      vx,
      vy,
      size,
      phase,
      tone,
    }));
  };

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    resetFish();
  };

  const drawFish = (item, time) => {
    const angle = Math.atan2(item.vy, item.vx);
    const sway = Math.sin(time * 0.0012 + item.phase) * item.size * 0.12;
    const bodyColor = item.tone === "amber" ? "#ef8a43" : "#f4ead5";

    context.save();
    context.translate(item.x, item.y + sway);
    context.rotate(angle);
    context.globalAlpha = item.tone === "amber" ? 0.5 : 0.36;
    context.shadowColor = bodyColor;
    context.shadowBlur = item.size * 1.15;
    context.fillStyle = bodyColor;

    context.beginPath();
    context.ellipse(
      0,
      0,
      item.size * 1.25,
      item.size * 0.38,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.beginPath();
    context.moveTo(-item.size * 1.08, 0);
    context.lineTo(-item.size * 1.72, -item.size * 0.52);
    context.lineTo(-item.size * 1.52, 0);
    context.lineTo(-item.size * 1.72, item.size * 0.52);
    context.closePath();
    context.fill();

    context.globalAlpha *= 0.48;
    context.fillStyle = "#171a19";
    context.beginPath();
    context.ellipse(
      item.size * 0.43,
      0,
      item.size * 0.22,
      item.size * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  };

  const drawRipples = () => {
    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index];
      ripple.age += 1;
      const radius = 12 + ripple.age * 1.8;
      const opacity = Math.max(0, 0.28 - ripple.age * 0.006);

      context.beginPath();
      context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(244, 234, 213, ${opacity})`;
      context.lineWidth = 1;
      context.stroke();

      if (ripple.age > 46) ripples.splice(index, 1);
    }
  };

  const render = (time) => {
    context.clearRect(0, 0, width, height);

    fish.forEach((item) => {
      if (!reducedMotion) {
        if (pointer.active) {
          const dx = item.x - pointer.x;
          const dy = item.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const range = Math.min(180, Math.max(120, width * 0.26));

          if (distance > 0 && distance < range) {
            const force = (1 - distance / range) * 0.055;
            item.vx += (dx / distance) * force;
            item.vy += (dy / distance) * force;
          }
        }

        const baseSpeed = item.tone === "amber" ? 0.17 : 0.14;
        const velocity = Math.hypot(item.vx, item.vy) || 1;
        item.vx += (item.vx / velocity) * baseSpeed * 0.008;
        item.vy += Math.sin(time * 0.0009 + item.phase) * 0.0015;
        item.vx *= 0.992;
        item.vy *= 0.992;
        item.x += item.vx;
        item.y += item.vy;

        const margin = item.size * 2.2;
        if (item.x < -margin) item.x = width + margin;
        if (item.x > width + margin) item.x = -margin;
        if (item.y < margin) item.vy = Math.abs(item.vy);
        if (item.y > height - margin) item.vy = -Math.abs(item.vy);
      }

      drawFish(item, time);
    });

    drawRipples();
    if (!reducedMotion) frame = window.requestAnimationFrame(render);
  };

  const handlePointerMove = (event) => {
    const rect = host.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;

    const now = performance.now();
    if (now - lastRippleAt > 170) {
      ripples.push({ x: pointer.x, y: pointer.y, age: 0 });
      lastRippleAt = now;
    }
  };

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  host.addEventListener("pointermove", handlePointerMove, { passive: true });
  host.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  resize();
  render(0);

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
  });
});
