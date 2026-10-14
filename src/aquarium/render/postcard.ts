/** A real canvas export of our own same-origin artwork; no DOM screenshot or remote service. */
export type PostcardSprite = {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  flip?: boolean;
  opacity?: number;
  filter?: string;
  ornament?: "pearl" | "moon";
};

export type PostcardScene = {
  width: number;
  height: number;
  background: string;
  fallbackBackground: string;
  sprites: PostcardSprite[];
  lighting: "day" | "dawn" | "moon";
  reefStage: number;
  region: "sun" | "coral" | "pearl" | "star";
  minnows: { x: number; y: number; width: number; height: number }[];
  title: string;
};

const pictures = new Map<string, Promise<HTMLImageElement>>();
function picture(src: string): Promise<HTMLImageElement> {
  const cached = pictures.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      pictures.delete(src);
      reject(new Error("Billedet kunne ikke indlæses."));
    };
    image.src = src;
  });
  pictures.set(src, pending);
  return pending;
}

function cover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const iw = image.naturalWidth * scale,
    ih = image.naturalHeight * scale;
  ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function contain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
): void {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const iw = image.naturalWidth * scale,
    ih = image.naturalHeight * scale;
  ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
}

function pearl(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  const glass = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.05,
    x,
    y,
    radius,
  );
  glass.addColorStop(0, "#ffffff");
  glass.addColorStop(0.35, "#f7e0f0");
  glass.addColorStop(0.7, "#abc7f1");
  glass.addColorStop(1, "#7593bd");
  ctx.fillStyle = glass;
  ctx.shadowColor = "#e2e5ff";
  ctx.shadowBlur = radius * 1.4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

export async function renderPostcard(scene: PostcardScene): Promise<Blob> {
  const longest = Math.max(1, scene.width, scene.height);
  const scale = Math.min(3, 1600 / longest);
  const width = Math.max(1, Math.round(scene.width * scale));
  const height = Math.max(1, Math.round(scene.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Telefonen kunne ikke tegne postkortet.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const background = await picture(scene.background).catch(() =>
    picture(scene.fallbackBackground),
  );
  cover(ctx, background, width, height);

  // Sun shafts remain part of the aquarium picture, with no interface controls.
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const shaft = ctx.createLinearGradient(0, 0, 0, height * 0.82);
  shaft.addColorStop(0, scene.lighting === "dawn" ? "#ffe5a74d" : "#e5fcff39");
  shaft.addColorStop(1, "#e5fcff00");
  ctx.fillStyle = shaft;
  for (const [x, spread] of [
    [0.1, 0.15],
    [0.37, 0.22],
    [0.7, 0.1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(width * x, 0);
    ctx.lineTo(width * (x + spread), 0);
    ctx.lineTo(width * (x + spread + 0.21), height * 0.85);
    ctx.lineTo(width * (x + 0.13), height * 0.85);
    ctx.fill();
  }
  ctx.restore();

  const loaded = await Promise.all(
    scene.sprites.map((sprite) => picture(sprite.src).catch(() => null)),
  );
  scene.sprites.forEach((sprite, index) => {
    const image = loaded[index];
    if (!image) return;
    ctx.save();
    ctx.translate(sprite.x * width, sprite.y * height);
    if (sprite.flip) ctx.scale(-1, 1);
    ctx.globalAlpha = sprite.opacity ?? 1;
    if (sprite.filter) ctx.filter = sprite.filter;
    ctx.shadowColor = "#063b4c66";
    ctx.shadowBlur = 7 * scale;
    ctx.shadowOffsetY = 5 * scale;
    const w = sprite.width * width,
      h = sprite.height * height;
    contain(ctx, image, w, h);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.filter = "none";
    if (sprite.ornament === "pearl") {
      for (const [x, y] of [
        [0.33, 0.2],
        [0.62, 0.31],
        [0.24, 0.46],
        [0.53, 0.6],
        [0.42, 0.36],
      ])
        pearl(ctx, (x - 0.5) * w, (y - 0.5) * h, w * 0.07);
    } else if (sprite.ornament === "moon") {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.27);
      glow.addColorStop(0, "#cbeaff17");
      glow.addColorStop(0.75, "#c9c9ff47");
      glow.addColorStop(1, "#b4b7ff00");
      ctx.fillStyle = glow;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "#fff2c4";
      ctx.textAlign = "center";
      ctx.font = `${w * 0.28}px Georgia`;
      ctx.shadowColor = "#c2e7ff";
      ctx.shadowBlur = 9 * scale;
      ctx.fillText("☾", 0, -h * 0.25);
      ctx.font = `${w * 0.09}px Georgia`;
      ctx.fillText("✦", -w * 0.1, 0);
      ctx.fillText("✦", w * 0.1, h * 0.12);
    }
    ctx.restore();
  });

  if (scene.minnows.length) {
    ctx.save();
    for (const minnow of scene.minnows) {
      const x = width * minnow.x,
        y = height * minnow.y,
        size = width * minnow.width * 0.5;
      ctx.fillStyle = "#a8e7ec";
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x - size * 1.6, y - size * 0.4);
      ctx.lineTo(x - size * 1.6, y + size * 0.4);
      ctx.fill();
      ctx.fillStyle = "#82c7e1";
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.43, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1d4e6a";
      ctx.beginPath();
      ctx.arc(x + size * 0.55, y - size * 0.09, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (scene.lighting !== "day") {
    ctx.save();
    ctx.globalCompositeOperation =
      scene.lighting === "dawn" ? "soft-light" : "multiply";
    const light = ctx.createLinearGradient(0, 0, width, height);
    light.addColorStop(
      0,
      scene.lighting === "dawn" ? "#ffc98248" : "#222d7a47",
    );
    light.addColorStop(
      1,
      scene.lighting === "dawn" ? "#37568a18" : "#10294d35",
    );
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  // A quiet signature, never a progress score or account identifier.
  const veil = ctx.createLinearGradient(0, height * 0.83, 0, height);
  veil.addColorStop(0, "#062c4000");
  veil.addColorStop(1, "#062c40bd");
  ctx.fillStyle = veil;
  ctx.fillRect(0, height * 0.83, width, height * 0.17);
  const fontSize = Math.min(width * 0.064, height * 0.065);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff0cf";
  ctx.font = `600 ${fontSize}px Georgia, serif`;
  ctx.shadowColor = "#163c58";
  ctx.shadowBlur = 5 * scale;
  ctx.fillText(scene.title, width / 2, height * 0.955, width * 0.88);
  ctx.strokeStyle = "#f5d69eaa";
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(
    12 * scale,
    12 * scale,
    width - 24 * scale,
    height - 24 * scale,
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Postkortet kunne ikke gemmes.")),
      "image/png",
    ),
  );
}
