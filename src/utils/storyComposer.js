// Builds a 1080x1920 story image for Text, Music, Layout and Voice statuses.
// The viewer only plays photos and videos, so each of these becomes an image
// (plus a song / voice clip where needed) and is posted like any other story.

const W = 1080;
const H = 1920;

export const TEXT_BACKGROUNDS = [
  ["#ff512f", "#dd2476"],
  ["#4776e6", "#8e54e9"],
  ["#11998e", "#38ef7d"],
  ["#f7971e", "#ffd200"],
  ["#232526", "#414345"],
  ["#ee0979", "#ff6a00"],
];

// Cells are fractions of the canvas: [x, y, w, h].
export const LAYOUTS = [
  { id: "2h", count: 2, cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: "2v", count: 2, cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: "3", count: 3, cells: [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  {
    id: "4",
    count: 4,
    cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  },
];

const makeCanvas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return [canvas, canvas.getContext("2d")];
};

const toFile = (canvas, name) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(new File([blob], name, { type: "image/jpeg" }))
          : reject(new Error("Couldn't create the story image.")),
      "image/jpeg",
      0.9
    );
  });

const paintGradient = (ctx, [from, to]) => {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

const wrapLines = (ctx, text, maxWidth) => {
  const lines = [];
  text.split("\n").forEach((paragraph) => {
    let line = "";
    paragraph.split(" ").forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    lines.push(line);
  });
  return lines;
};

// Draws centred text, shrinking the font until it fits.
const drawCentered = (ctx, text, { size = 96, centerY = H / 2, color = "#fff", maxHeight = H - 500 }) => {
  let fontSize = size;
  let lines;
  for (;;) {
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    lines = wrapLines(ctx, text, W - 200);
    if (lines.length * fontSize * 1.25 <= maxHeight || fontSize <= 36) break;
    fontSize -= 6;
  }
  const lineHeight = fontSize * 1.25;
  const top = centerY - ((lines.length - 1) * lineHeight) / 2;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, W / 2, top + i * lineHeight));
};

// Resolves null when the image can't be loaded (e.g. cover art without CORS).
const loadImage = (url, crossOrigin) =>
  new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

const drawCover = (ctx, img, x, y, w, h) => {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
};

export const renderTextStory = async (text, bgIndex) => {
  const [canvas, ctx] = makeCanvas();
  paintGradient(ctx, TEXT_BACKGROUNDS[bgIndex] || TEXT_BACKGROUNDS[0]);
  drawCentered(ctx, text, { size: 110 });
  return toFile(canvas, `text-${Date.now()}.jpg`);
};

export const renderMusicStory = async (song, bgIndex) => {
  const [canvas, ctx] = makeCanvas();
  paintGradient(ctx, TEXT_BACKGROUNDS[bgIndex] || TEXT_BACKGROUNDS[1]);

  const size = 640;
  const x = (W - size) / 2;
  const y = 430;
  const cover = song.cover ? await loadImage(song.cover, true) : null;
  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 48);
    ctx.clip();
    drawCover(ctx, cover, x, y, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 48);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "400 320px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♪", W / 2, y + size / 2);
  }

  drawCentered(ctx, song.title || "Music", { size: 84, centerY: 1250, maxHeight: 240 });
  if (song.artist) {
    ctx.font = "500 52px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";
    ctx.fillText(song.artist, W / 2, 1450);
  }
  return toFile(canvas, `music-${Date.now()}.jpg`);
};

export const renderLayoutStory = async (files, layout) => {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, H);
  const gap = 10;
  const images = await Promise.all(
    files.map((f) => {
      const url = URL.createObjectURL(f);
      return loadImage(url).then((img) => {
        URL.revokeObjectURL(url);
        return img;
      });
    })
  );
  layout.cells.forEach(([cx, cy, cw, ch], i) => {
    const img = images[i];
    if (img) drawCover(ctx, img, cx * W + gap / 2, cy * H + gap / 2, cw * W - gap, ch * H - gap);
  });
  return toFile(canvas, `layout-${Date.now()}.jpg`);
};

export const renderVoiceStory = async (seconds) => {
  const [canvas, ctx] = makeCanvas();
  paintGradient(ctx, ["#0f9b6c", "#1fd1a5"]);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(W / 2, 800, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "400 280px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎙️", W / 2, 810);
  drawCentered(ctx, "Voice message", { size: 88, centerY: 1250, maxHeight: 200 });
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  ctx.font = "500 56px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${mm}:${ss}`, W / 2, 1400);
  return toFile(canvas, `voice-${Date.now()}.jpg`);
};