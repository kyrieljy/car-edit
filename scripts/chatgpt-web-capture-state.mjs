import fs from "node:fs/promises";
import path from "node:path";

const outName = process.argv[2] || "chatgpt-state.png";
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
await send("Page.enable");

const state = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify({ bodyTail: document.body.innerText.slice(-3000), stopVisible: [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === '停止回答'), images: [...document.images].map((img, i) => ({ i, alt: img.alt || '', src: img.currentSrc || img.src, w: img.naturalWidth, h: img.naturalHeight, x: img.getBoundingClientRect().x, y: img.getBoundingClientRect().y, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height })).filter(img => img.width > 50 && img.height > 50).slice(-30), buttons: [...document.querySelectorAll('button')].slice(-25).map(b => ({ aria: b.getAttribute('aria-label'), text: (b.innerText || '').trim(), disabled: b.disabled })) })",
  returnByValue: true,
});

console.log(state.result.result.value);

const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
const outDir = path.resolve("docs/batch-results");
await fs.mkdir(outDir, { recursive: true });
const out = path.join(outDir, outName);
await fs.writeFile(out, Buffer.from(screenshot.result.data, "base64"));
console.log(out);
ws.close();
