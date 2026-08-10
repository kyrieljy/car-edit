import { NextRequest, NextResponse } from "next/server"
import { loginOrCreateWithWechat } from "@/lib/server/db"
import { attachSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const savedState = request.cookies.get("wx_oauth_state")?.value

  if (!code || !state || !savedState || state !== savedState) {
    return resultPage(false, "微信登录校验失败（state 不匹配或缺少 code），请重试。")
  }

  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_APPSECRET
  if (!appid || !secret) {
    return resultPage(
      false,
      "微信登录未配置：服务端缺少 WECHAT_APPID 或 WECHAT_APPSECRET，请在 .env.local 中填写后重启服务。",
    )
  }

  try {
    // 1) code 换 access_token
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`,
    )
    const token = await tokenRes.json()
    if (token.errcode) throw new Error(`微信换 token 失败：${token.errcode} ${token.errmsg}`)
    const { access_token, openid, unionid } = token

    // 2) 拉用户昵称/头像（可选，失败不影响登录）
    let nickname = ""
    let avatarUrl = ""
    try {
      const infoRes = await fetch(
        `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`,
      )
      const info = await infoRes.json()
      if (!info.errcode) {
        nickname = info.nickname || ""
        avatarUrl = info.headimgurl || ""
      }
    } catch {
      /* 忽略用户信息拉取失败 */
    }

    // 3) 查/建本地用户并种会话
    const user = loginOrCreateWithWechat({ openid, unionid, nickname, avatarUrl })
    const res = resultPage(true)
    attachSession(res, user.id) // 写入 car_mod_session cookie
    res.cookies.set("wx_oauth_state", "", { path: "/", maxAge: 0 })
    return res
  } catch (err) {
    return resultPage(false, err instanceof Error ? err.message : "微信登录失败。")
  }
}

// 返回极简 HTML：失败时弹窗提示并通知 opener，成功时通知 opener 并关闭弹窗
function resultPage(ok: boolean, message = "") {
  const script = `
    <script>
      (function () {
        try {
          if (window.opener) {
            window.opener.postMessage({ type: "wechat-login", ok: ${ok}, message: ${JSON.stringify(message)} }, "*");
          }
        } catch (e) {}
        try {
          if (!${ok}) window.alert(${JSON.stringify(message || "微信登录失败")});
        } catch (e) {}
        setTimeout(function () { window.close(); }, 400);
      })();
    </script>`
  const body = ok ? "<p>微信登录成功，正在关闭窗口…</p>" : `<p>微信登录失败：${message}</p>`
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>微信登录</title></head><body>${body}${script}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}
