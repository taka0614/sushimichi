/**
 * 鮨道・生け簀
 *
 * 動作ルール
 * 1. 鯉はゆっくり自律移動する
 * 2. カーソルを止めると、少しずつ近寄る
 * 3. クリック／タップで波紋が生まれ、近くの鯉だけが逃げる
 */

const POND_CONFIG = {
  escapeRadius: 300,
  escapeStrength: 7.6,
  attractionDelayMs: 650,
  attractionForce: 0.0012,
  calmSpeed: 0.72,
  burstSpeed: 6.8,
  burstDecay: 0.955,
  rippleDurationMs: 900,
  pixelRatioLimit: 2,
};

const KOI_VARIANTS = [
  { src: "images/koi/kohaku-anime.png", size: 176, startX: 0.22, startY: 0.32 },
  { src: "images/koi/shiro-utsuri-anime.png", size: 158, startX: 0.66, startY: 0.6 },
  { src: "images/koi/benigoi-anime.png", size: 148, startX: 0.48, startY: 0.22 },
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
      velocityX: index % 2 === 0 ? 0.36 : -0.34,
      velocityY: index === 1 ? -0.16 : 0.12,
      directionPhase: index * 2.1,
      burst: 0,
    };
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
    // ここでは逃走処理をしない。逃げるのは pointerdown のときだけ。
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
      fish.burst = 1;
    }
  }

  updateFish(fish, time, frameScale) {
    const idleFor = time - this.pointer.lastMovedAt;
    const canApproachPointer = this.pointer.isInside && idleFor > this.config.attractionDelayMs;

    if (canApproachPointer) {
      const offsetX = this.pointer.x - fish.x;
      const offsetY = this.pointer.y - fish.y;
      const distance = Math.hypot(offsetX, offsetY) || 1;

      if (distance > 85) {
        fish.velocityX += offsetX * this.config.attractionForce * frameScale;
        fish.velocityY += offsetY * this.config.attractionForce * frameScale;
      }
    }

    // 完全な直線運動に見えない程度の、ごく小さな方向変化。
    fish.velocityX += Math.cos(time * 0.00028 + fish.directionPhase) * 0.0007 * frameScale;
    fish.velocityY += Math.sin(time * 0.00031 + fish.directionPhase) * 0.0007 * frameScale;

    fish.burst *= Math.pow(this.config.burstDecay, frameScale);
    const speedLimit = this.config.calmSpeed + fish.burst * (this.config.burstSpeed - this.config.calmSpeed);
    this.limitSpeed(fish, speedLimit);

    fish.x += fish.velocityX * frameScale * 2.4;
    fish.y += fish.velocityY * frameScale * 2.4;
    this.keepFishInPond(fish);
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

  drawFish(fish, time) {
    if (!fish.image.complete || fish.image.naturalWidth === 0) return;

    const angle = Math.atan2(fish.velocityY, fish.velocityX);
    const aspectRatio = fish.image.naturalHeight / fish.image.naturalWidth;
    const drawWidth = fish.size;
    const drawHeight = drawWidth * aspectRatio;
    const glide = Math.sin(time * 0.002 + fish.directionPhase) * 1.2;

    this.context.save();
    this.context.translate(fish.x, fish.y + glide);
    this.context.rotate(angle);
    this.context.shadowColor = "rgba(0, 0, 0, 0.34)";
    this.context.shadowBlur = 18;
    this.context.globalAlpha = 0.92;
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
    gradient.addColorStop(0, "rgba(191, 231, 218, 0.11)");
    gradient.addColorStop(1, "rgba(191, 231, 218, 0)");

    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(this.pointer.x, this.pointer.y, 90, 0, Math.PI * 2);
    this.context.fill();
  }

  drawRipples(time) {
    this.ripples = this.ripples.filter((ripple) => time - ripple.startedAt < this.config.rippleDurationMs);

    for (const ripple of this.ripples) {
      const progress = (time - ripple.startedAt) / this.config.rippleDurationMs;
      const opacity = (1 - progress) * 0.58;

      for (const ring of [0, 1]) {
        const delayedProgress = Math.max(0, progress - ring * 0.12);
        const radius = 16 + delayedProgress * 150;

        this.context.beginPath();
        this.context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        this.context.strokeStyle = `rgba(216, 242, 233, ${opacity * (1 - ring * 0.28)})`;
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
    this.drawPointerGlow();

    for (const fish of this.fish) {
      this.updateFish(fish, time, frameScale);
      this.drawFish(fish, time);
    }

    this.drawRipples(time);
    this.animationId = requestAnimationFrame(this.animate);
  }
}

window.KoiPond = KoiPond;
