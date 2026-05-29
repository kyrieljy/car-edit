import fs from "node:fs/promises";
import path from "node:path";

const promptPath = process.argv[2];
if (!promptPath) {
  throw new Error("Usage: node scripts/chatgpt-web-send-prompt.mjs <prompt-file>");
}

const prompt = await fs.readFile(path.resolve(promptPath), "utf8");
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

await send("Runtime.evaluate", {
  expression:
    "(() => { const el = document.querySelector('#prompt-textarea'); if (!el) return false; el.focus(); return true; })()",
  returnByValue: true,
});

await send("Input.insertText", { text: prompt });
await new Promise((resolve) => setTimeout(resolve, 800));

const beforeSend = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify({ editorLength: document.querySelector('#prompt-textarea')?.innerText?.length || 0, editorHead: document.querySelector('#prompt-textarea')?.innerText?.slice(0, 80) || '', fileInputs: [...document.querySelectorAll('input[type=file]')].map(el => ({ id: el.id, files: el.files ? el.files.length : 0 })) })",
  returnByValue: true,
});

console.log(beforeSend.result.result.value);

const clicked = await send("Runtime.evaluate", {
  expression:
    "(() => { const btn = document.querySelector('#composer-submit-button') || [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === '发送提示'); if (!btn) return { clicked: false, reason: 'missing submit button' }; btn.click(); return { clicked: true, disabled: btn.disabled, aria: btn.getAttribute('aria-label') }; })()",
  returnByValue: true,
});

console.log(JSON.stringify(clicked.result.result.value));
await new Promise((resolve) => setTimeout(resolve, 3000));

const afterSend = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify({ url: location.href, bodyTail: document.body.innerText.slice(-2000), busyButtons: [...document.querySelectorAll('button')].slice(-20).map(b => ({ aria: b.getAttribute('aria-label'), text: (b.innerText || '').trim(), disabled: b.disabled })) })",
  returnByValue: true,
});

console.log(afterSend.result.result.value);
ws.close();
