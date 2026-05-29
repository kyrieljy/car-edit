import net from "node:net"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

const proxyPorts = [7897, 7890, 10809, 10808, 8080]
const cwd = process.cwd()
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next")

if (!existsSync(nextBin)) {
  console.error("Next.js binary not found. Run npm install first.")
  process.exit(1)
}

const env = { ...process.env }
const existingProxy = env.HTTPS_PROXY || env.HTTP_PROXY || env.ALL_PROXY
const localProxy = existingProxy ? "" : await detectLocalProxy()

if (localProxy) {
  env.HTTP_PROXY = localProxy
  env.HTTPS_PROXY = localProxy
  env.ALL_PROXY = localProxy
}

if (env.HTTPS_PROXY || env.HTTP_PROXY || env.ALL_PROXY) {
  env.NODE_USE_ENV_PROXY = env.NODE_USE_ENV_PROXY || "1"
  console.log(`Node proxy enabled: ${env.HTTPS_PROXY || env.HTTP_PROXY || env.ALL_PROXY}`)
}

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd,
  env,
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

async function detectLocalProxy() {
  for (const port of proxyPorts) {
    if (await canConnect("127.0.0.1", port)) return `http://127.0.0.1:${port}`
  }
  return ""
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.once("connect", () => finish(true))
    socket.once("error", () => finish(false))
    socket.setTimeout(300, () => finish(false))
  })
}
