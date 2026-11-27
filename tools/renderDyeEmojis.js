// Renders every Skyblock dye (a player head) as a small isometric 3D head PNG, like inventory icons.
// Usage: node render.js <outDir>   (needs the "canvas" package; run with the bridge's node_modules)
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require(process.env.CANVAS_PATH || "canvas");

const OUT = process.argv[2];
const SIZE = 128;
const NEU = "https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items/";
const TREE = "https://api.github.com/repos/NotEnoughUpdates/NotEnoughUpdates-REPO/git/trees/master?recursive=1";

async function json(url) {
  const res = await fetch(url, { headers: { "User-Agent": "dye-icons" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Skin URL from the item's SkullOwner texture (base64 JSON inside the NBT string). */
function skinUrl(item) {
  const value = item.nbttag.match(/Value:\\?"([A-Za-z0-9+/=]+)\\?"/)?.[1];
  if (!value) return null;
  const decoded = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  return decoded.textures?.SKIN?.url?.replace("http://", "https://") ?? null;
}

/** One 8x8 head face with the hat layer drawn over it. */
function face(skin, x, y) {
  const c = createCanvas(8, 8);
  const g = c.getContext("2d");
  g.drawImage(skin, x, y, 8, 8, 0, 0, 8, 8);
  g.drawImage(skin, x + 32, y, 8, 8, 0, 0, 8, 8);
  return c;
}

/** Darkens a face for shading. */
function shade(src, amount) {
  const c = createCanvas(8, 8);
  const g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = `rgba(0,0,0,${amount})`;
  g.fillRect(0, 0, 8, 8);
  return c;
}

function render(skin) {
  const canvas = createCanvas(SIZE, SIZE);
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  // Isometric projection: s = screen pixels per skin pixel along the vertical edge.
  const s = 7.4;
  const cx = s * Math.cos(Math.PI / 6);
  const cy = s * Math.sin(Math.PI / 6);
  // Screen point of head-space (x, y, z), 0..8 each; y is up. Centered in the canvas.
  const ox = SIZE / 2;
  const oy = (SIZE - 16 * s) / 2 + 8 * cy * 0 + 0;
  const P = (x, y, z) => [ox + (x - z) * cx, oy + (x + z) * cy + (8 - y) * s];

  const draw = (img, origin, u, v) => {
    // Slightly enlarged so neighbouring faces don't leave a hairline gap.
    const k = 1.01;
    g.setTransform(u[0] * k, u[1] * k, v[0] * k, v[1] * k, origin[0], origin[1]);
    g.drawImage(img, 0, 0, 8, 8);
  };

  const top = face(skin, 8, 0);
  const front = shade(face(skin, 8, 8), 0.12);
  const side = shade(face(skin, 16, 8), 0.32);

  // Top (y = 8): u along +x, v along +z.
  draw(top, P(0, 8, 0), [cx, cy], [-cx, cy]);
  // Front (z = 8, facing lower left): u along +x, v down.
  draw(front, P(0, 8, 8), [cx, cy], [0, s]);
  // Side (x = 8, facing lower right): u along -z, v down.
  draw(side, P(8, 8, 8), [cx, -cy], [0, s]);

  g.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tree = await json(TREE);
  const ids = tree.tree.filter((e) => /^items\/DYE_[A-Z0-9_]+\.json$/.test(e.path)).map((e) => e.path.slice(6, -5));

  const done = [];
  for (const id of ids) {
    try {
      const item = await json(`${NEU}${id}.json`);
      const url = skinUrl(item);
      if (!url) throw new Error("no skin");
      const skin = await loadImage(Buffer.from(await (await fetch(url)).arrayBuffer()));
      fs.writeFileSync(path.join(OUT, `${id}.png`), render(skin).toBuffer("image/png"));
      done.push({ id, name: item.displayname.replace(/§./g, "") });
    } catch (error) {
      console.log(`skip ${id}: ${error.message}`);
    }
  }

  fs.writeFileSync(path.join(OUT, "dyes.json"), JSON.stringify(done, null, 2));
  console.log(`rendered ${done.length}/${ids.length}`);
})();
