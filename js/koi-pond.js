/**
 * 鮨道・生け簀（透過背景・近い順寄せ・控えめなゆらゆらモーション）
 */

const POND_CONFIG = {
  escapeRadius: 300,
  escapeStrength: 7.6,
  attractionDelayMs: 650,
  attractionForce: 0.0018,
  calmSpeed: 0.72,
  burstSpeed: 6.8,
  burstDecay: 0.955,
  rippleDurationMs: 900,
  pixelRatioLimit: 2,
};

const KOI_VARIANTS = [
  { src: "images/koi/kohaku-anime.png", size: 176, startX: 0.22, startY: 0.32, startZ: 0.2 },
  { src: "images/koi/shiro-utsuri-anime.png", size: 158, startX: 0.66, startY: 0.6, startZ: 0.5 },
  { src: "images/koi/benigoi-anime.png", size: 148, startX: 0.48, startY: 0.22, startZ: 0.8 },
];

class KoiPond {
  constructor(container, config = {}) {
    if (!container) {
      throw new Error("KoiPond: container が見つかりません。");
    }

    this.container = container;
    this.canvas = container.querySelector("canvas");
    this.context = this.canvas?.getContext("2d");
    this.config = { ...POND_CONFIG, ...config };

    if (!this.canvas || !this.context) {
      throw new Error("KoiPond: container 内に canvas が必要です。");
    }

    this.width = 0;
    this.height = 0;
    this.animationId = 0;
    this.lastFrameTime = performance.now();

    this.pointer = {
      x: 0,
      y: 0,
      isInside: false,
      lastMovedAt: 0,
    };

    this.ripples = [];
    this.fish = KOI_VARIANTS.map((variant, index) => this.createFish(variant, index));
    this.bottomWeeds = [];

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerLeave = this.handlePointerLeave.bind(this);
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.animate = this.animate.bind(this);
  }

  createFish(variant, index) {
    const image = new Image();
    image.src = variant.src;

    return {
      ...variant,
      image,
      x: 0,
      y: 0,
      z: variant.startZ ?? 0.5,
      velocityX: index % 2 === 0 ? 0.36 : -0.34,
      velocityY: index === 1 ? -0.16 : 0.12,
      velocityZ: 0,
      directionPhase: index * 2.1,
      burst: 0,
      wigglePhase: index * 1.5,
    };
  }

  initAtmosphere() {
    this.bottomWeeds = [];

    const bottomWeedCount = 15;
    for (let i = 0; i < bottomWeedCount; i++) {
      this.bottomWeeds.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        color: `hsla(${Math.random() * 25 + 125}, ${Math.random() * 20 + 55}%, ${Math.random() * 15 + 40}%, 0.35)`,
        radius: Math.random() * 15 + 10,
        yPhase: Math.random() * Math.PI * 2,
        xPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  start() {
    this.resizeObserver.observe(this.container);
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerleave", this.onPointerLeave);
    this.container.addEventListener("pointerdown", this.onPointerDown);
    this.resize();
    this.animationId = requestAnimationFrame(this.animate);
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerleave", this.onPointerLeave);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
  }

  resize() {
    const bounds = this.container.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.config.pixelRatioLimit);
    const firstLayout = this.width === 0 || this.height === 0;

    this.width = bounds.width;
    this.height = bounds.height;
    this.canvas.width = Math.round(this.width * pixelRatio);
    this.canvas.height = Math.round(this.height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (firstLayout) {
      for (const fish of this.fish) {
        fish.x = fish.startX * this.width;
        fish.y = fish.startY * this.height;
      }
    }

    this.initAtmosphere();
  }

  pointerPosition(event) {
    const bounds = this.container.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  handlePointerMove(event) {
    const position = this.pointerPosition(event);
    this.pointer = {
      ...position,
      isInside: true,
      lastMovedAt: performance.now(),
    };
  }

  handlePointerLeave() {
    this.pointer.isInside = false;
  }

  handlePointerDown(event) {
    const position = this.pointerPosition(event);
    const now = performance.now();

    this.pointer = { ...position, isInside: true, lastMovedAt: now };
    this.ripples.push({ ...position, startedAt: now });
    this.scareNearbyFish(position);
  }

  scareNearbyFish(origin) {
    for (const fish of this.fish) {
      const offsetX = fish.x - origin.x;
      const offsetY = fish.y - origin.y;
      const distance = Math.hypot(offsetX, offsetY) || 1;

      if (distance > this.config.escapeRadius) continue;

      const proximity = 1 - distance / this.config.escapeRadius;
      const impulse = this.config.escapeStrength * (0.42 + proximity * 0.58);

      fish.velocityX += (offsetX / distance) * impulse;
      fish.velocityY += (offsetY / distance) * impulse;
      fish.velocityZ += 0.02 * impulse;
      fish.burst = 1;
    }
  }

  updateFish(time, frameScale) {
    const idleFor = time - this.pointer.lastMovedAt;
    const canApproachPointer = this.pointer.isInside && idleFor > this.config.attractionDelayMs;

    let closestFish = null;
    let minDistance = Infinity;

    if (canApproachPointer) {
      for (const fish of this.fish) {
        const dist = Math.hypot(this.pointer.x - fish.x, this.pointer.y - fish.y);
        if (dist < minDistance) {
          minDistance = dist;
          closestFish = fish;
        }
      }
    }

    for (const fish of this.fish) {
      const isTarget = fish === closestFish;
      if (isTarget && minDistance > 12) {
        const offsetX = this.pointer.x - fish.x;
        const offsetY = this.pointer.y - fish.y;

        fish.velocityX += offsetX * this.config.attractionForce * frameScale;
        fish.velocityY += offsetY * this.config.attractionForce * frameScale;
        fish.velocityZ -= 0.00015 * frameScale;
      }

      fish.velocityX += Math.cos(time * 0.00028 + fish.directionPhase) * 0.0007 * frameScale;
      fish.velocityY += Math.sin(time * 0.00031 + fish.directionPhase) * 0.0007 * frameScale;
      fish.velocityZ += Math.sin(time * 0.0002 + fish.directionPhase) * 0.0001 * frameScale;

      fish.velocityZ *= 0.96;
      fish.z += fish.velocityZ * frameScale;

      if (fish.z < 0) {
        fish.z = 0;
        fish.velocityZ *= -0.5;
      } else if (fish.z > 1) {
        fish.z = 1;
        fish.velocityZ *= -0.5;
      }

      fish.burst *= Math.pow(this.config.burstDecay, frameScale);
      const speedLimit = this.config.calmSpeed + fish.burst * (this.config.burstSpeed - this.config.calmSpeed);
      this.limitSpeed(fish, speedLimit);

      fish.x += fish.velocityX * frameScale * 2.4;
      fish.y += fish.velocityY * frameScale * 2.4;
      this.keepFishInPond(fish);
    }
  }

  limitSpeed(fish, speedLimit) {
    const speed = Math.hypot(fish.velocityX, fish.velocityY);
    if (speed <= speedLimit) return;

    fish.velocityX = (fish.velocityX / speed) * speedLimit;
    fish.velocityY = (fish.velocityY / speed) * speedLimit;
  }

  keepFishInPond(fish) {
    const marginX = this.width * 0.04;
    const marginY = this.height * 0.08;

    if (fish.x < marginX || fish.x > this.width - marginX) {
      fish.velocityX *= -0.86;
      fish.x = Math.max(marginX, Math.min(this.width - marginX, fish.x));
    }

    if (fish.y < marginY || fish.y > this.height - marginY) {
      fish.velocityY *= -0.86;
      fish.y = Math.max(marginY, Math.min(this.height - marginY, fish.y));
    }
  }

  drawBottomAtmosphere(time) {
    this.context.save();
    for (const weed of this.bottomWeeds) {
      const floatY = Math.sin(time * 0.001 + weed.yPhase) * 12;
      const floatX = Math.cos(time * 0.0008 + weed.xPhase) * 10;
      const x = weed.x + floatX;
      const y = weed.y + floatY;

      this.context.beginPath();
      const gradient = this.context.createRadialGradient(x, y, 0, x, y, weed.radius);
      gradient.addColorStop(0, weed.color);
      gradient.addColorStop(1, "transparent");
      this.context.fillStyle = gradient;
      this.context.arc(x, y, weed.radius, 0, Math.PI * 2);
      this.context.fill();
    }
    this.context.restore();
  }

  drawFish(fish, time) {
    if (!fish.image.complete || fish.image.naturalWidth === 0) return;

    const currentSpeed = Math.hypot(fish.velocityX, fish.velocityY);
    const baseAngle = Math.atan2(fish.velocityY, fish.velocityX);
    
    // 揺れの上限を抑える調整（速度に応じた振幅を最大約5.7度までに抑制）
    const wiggleSpeed = 0.004 + currentSpeed * 0.0015;
    const wiggleAmount = 0.02 + Math.min(currentSpeed * 0.02, 0.02); // ラジアン（約2.8〜5.7度）
    const swimWiggle = Math.sin(time * wiggleSpeed + fish.wigglePhase) * wiggleAmount;

    const angle = baseAngle + swimWiggle;

    const aspectRatio = fish.image.naturalHeight / fish.image.naturalWidth;
    const depthScale = 1 - fish.z * 0.38;
    const drawWidth = fish.size * depthScale;
    const drawHeight = drawWidth * aspectRatio;

    this.context.save();
    this.context.translate(fish.x, fish.y);
    this.context.rotate(angle);

    const shadowOffset = 18 * (1 + fish.z * 1.2);
    this.context.shadowOffsetX = shadowOffset;
    this.context.shadowOffsetY = shadowOffset;
    this.context.shadowColor = `rgba(0, 0, 0, ${0.3 * depthScale})`;
    this.context.shadowBlur = 20 * depthScale;

    this.context.globalAlpha = Math.max(0.2, 0.95 * depthScale);

    this.context.drawImage(fish.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    this.context.restore();
  }

  drawPointerGlow() {
    if (!this.pointer.isInside) return;

    const gradient = this.context.createRadialGradient(
      this.pointer.x,
      this.pointer.y,
      0,
      this.pointer.x,
      this.pointer.y,
      90,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(this.pointer.x, this.pointer.y, 90, 0, Math.PI * 2);
    this.context.fill();
  }

  drawRipples(time) {
    this.ripples = this.ripples.filter((ripple) => time - ripple.startedAt < this.config.rippleDurationMs);

    for (const ripple of this.ripples) {
      const progress = (time - ripple.startedAt) / this.config.rippleDurationMs;
      const opacity = (1 - progress) * 0.5;

      for (const ring of [0, 1]) {
        const delayedProgress = Math.max(0, progress - ring * 0.12);
        const radius = 16 + delayedProgress * 150;

        this.context.beginPath();
        this.context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        this.context.strokeStyle = `rgba(255, 255, 255, ${opacity * (1 - ring * 0.3)})`;
        this.context.lineWidth = 1.2;
        this.context.stroke();
      }
    }
  }

  animate(time) {
    const elapsed = Math.min(time - this.lastFrameTime, 34);
    const frameScale = elapsed / (1000 / 60);
    this.lastFrameTime = time;

    this.context.clearRect(0, 0, this.width, this.height);

    this.drawBottomAtmosphere(time);
    this.drawPointerGlow();

    this.updateFish(time, frameScale);

    this.fish.sort((a, b) => b.z - a.z);
    for (const fish of this.fish) {
      this.drawFish(fish, time);
    }

    this.drawRipples(time);

    this.animationId = requestAnimationFrame(this.animate);
  }
}

window.KoiPond = KoiPond;