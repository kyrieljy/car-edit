import fs from "node:fs/promises";
import path from "node:path";

const files = process.argv.slice(2).map((file) => path.resolve(file));
if (!files.length) {
  throw new Error("Usage: node scripts/chatgpt-web-upload-files.mjs <file...>");
}

for (const file of files) {
  await fs.access(file);
}

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

await send("DOM.enable");
const root = await send("DOM.getDocument", { depth: -1, pierce: true });
const selectors = [
  "#upload-photos",
  "#image-gen-action-modal-upload-photos",
  "#upload-files",
];

let nodeId = 0;
for (const selector of selectors) {
  const result = await send("DOM.querySelector", { nodeId: root.result.root.nodeId, selector });
  if (result.result.nodeId) {
    nodeId = result.result.nodeId;
    break;
  }
}

if (!nodeId) {
  throw new Error("Upload input not found.");
}

await send("DOM.setFileInputFiles", { nodeId, files });
await new Promise((resolve) => setTimeout(resolve, 5000));

const state = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify([...document.querySelectorAll('input[type=file]')].map(el => ({ id: el.id, files: el.files ? [...el.files].map(f => f.name) : [] })))",
  returnByValue: true,
});

console.log(state.result.result.value);
ws.close();
