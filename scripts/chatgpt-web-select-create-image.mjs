const CREATE_IMAGE = "\u521b\u5efa\u56fe\u7247";

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

async function clickCenter(expression) {
  const rectResult = await send("Runtime.evaluate", {
    expression: `JSON.stringify((() => { const el = ${expression}; if (!el) return null; const r = el.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height }; })())`,
    returnByValue: true,
  });
  const rect = JSON.parse(rectResult.result.result.value);
  if (!rect) return false;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.cx, y: rect.cy, button: "none" });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.cx, y: rect.cy, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.cx, y: rect.cy, button: "left", clickCount: 1 });
  return true;
}

await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await new Promise((resolve) => setTimeout(resolve, 300));

await clickCenter("document.querySelector('#composer-plus-btn')");
await new Promise((resolve) => setTimeout(resolve, 1000));

const clicked = await clickCenter(
  `[...document.querySelectorAll('*')].filter(el => ((el.innerText || el.textContent || '').trim() === ${JSON.stringify(CREATE_IMAGE)})).sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0]`
);

if (!clicked) {
  throw new Error("Could not find create-image menu item.");
}

await new Promise((resolve) => setTimeout(resolve, 1500));
const state = await send("Runtime.evaluate", {
  expression:
    "JSON.stringify({ tail: document.body.innerText.slice(-1500), buttons: [...document.querySelectorAll('button')].slice(-20).map(b => ({ aria: b.getAttribute('aria-label'), text: (b.innerText || '').trim(), id: b.id })) })",
  returnByValue: true,
});

console.log(state.result.result.value);
ws.close();
