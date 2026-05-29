import fs from "node:fs/promises";
import path from "node:path";

const outName = process.argv[2] || "latest-generated.png";
const pages = await fetch("http://127.0.0.1:9222/json/list").then((response) => response.json());
const page =
  pages.find((item) => item.type === "page" && item.url.includes("chatgpt.com")) ??
  pages.find((item) => item.type === "page");

if (!page) {
  throw new Error("No ChatGPT page found on CDP port 9222.");
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let seq = 0;

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id).resolve(message);
    pending.delete(message.id);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 15000);
  });
}

await send("Runtime.enable");

const imageState = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify([...document.images].map((img, i) => ({ i, alt: img.alt || '', src: img.currentSrc || img.src, w: img.naturalWidth, h: img.naturalHeight, x: img.getBoundingClientRect().x, y: img.getBoundingClientRect().y, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height })).filter(img => img.src && img.w > 512 && img.h > 512 && img.alt.includes('生成')).slice(-1)[0] || null)",
  returnByValue: true,
});

const latest = JSON.parse(imageState.result.result.value);
if (!latest?.src) {
  throw new Error("No generated image found.");
}

const dataResult = await send("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `fetch(${JSON.stringify(latest.src)})
    .then((response) => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))`,
});

const dataUrl = dataResult.result.result.value;
if (!dataUrl?.startsWith("data:")) {
  throw new Error("Could not read image data from browser page.");
}

const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
const buffer = Buffer.from(base64, "base64");
const outDir = path.resolve("docs/batch-results");
await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, outName);
await fs.writeFile(out, buffer);
console.log(JSON.stringify({ out, latest, bytes: buffer.byteLength }, null, 2));
ws.close();
