import { NextResponse } from "next/server"
import { randomBytes } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const appid = process.env.WECHAT_APPID
  const redirectUri = process.env.WECHAT_REDIRECT_URI
  if (!appid || !redirectUri) {
    // 未配置：直接在弹窗内弹窗提示（满足“未配置直接弹窗提示”要求）
    return configMissingPage(
      "微信登录未配置：服务端缺少 WECHAT_APPID 或 WECHAT_REDIRECT_URI，请在 .env.local 中填写后重启服务。",
    )
  }
  const state = randomBytes(16).toString("hex")
  const url = new URL("https://open.weixin.qq.com/connect/qrconnect")
  url.searchParams.set("appid", appid)
  url.searchParams.set("redirect_uri", redirectUri) // 后端做 encode，符合微信要求
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "snsapi_login")
  url.searchParams.set("state", state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set("wx_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 分钟，足够完成扫码
  })
  return res
}

function configMissingPage(message: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>微信登录</title></head><body><script>(function(){try{window.alert(${JSON.stringify(
    message,
  )});}catch(e){}try{if(window.opener)window.opener.postMessage({type:"wechat-login",ok:false,message:${JSON.stringify(
    message,
  )}}, "*");}catch(e){}setTimeout(function(){window.close();},500);})();</script></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
