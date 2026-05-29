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

await send("Page.enable");
await send("Page.navigate", { url: "https://chatgpt.com/" });
await new Promise((resolve) => setTimeout(resolve, 5000));
const state = await send("Runtime.evaluate", {
  expression: "JSON.stringify({ url: location.href, tail: document.body.innerText.slice(-1000) })",
  returnByValue: true,
});

console.log(state.result.result.value);
ws.close();
