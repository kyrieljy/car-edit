"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, Eye, EyeOff, MessageCircle, Smartphone, UserPlus, X } from "lucide-react"
import type { AuthUser, EntitlementStatus } from "@/lib/types"

type Language = "en" | "zh"
type MobileTheme = "dark" | "light"
type AuthTransitionDirection = "forward" | "back" | "switch"

const authMobilePageTransition = { type: "spring", stiffness: 310, damping: 34 } as const
const authMobilePageVariants = {
  enter: (direction: AuthTransitionDirection) => ({
    opacity: 0,
    x: direction === "back" ? -34 : 34,
    scale: direction === "switch" ? 0.985 : 1,
    filter: "blur(8px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (direction: AuthTransitionDirection) => ({
    opacity: 0,
    x: direction === "back" ? 34 : -34,
    scale: direction === "switch" ? 0.985 : 1,
    filter: "blur(6px)",
  }),
}

const authDesktopPageVariants = {
  enter: {
    opacity: 0,
    y: 12,
    scale: 0.985,
    filter: "blur(6px)",
  },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.985,
    filter: "blur(6px)",
  },
}

type AuthModalProps = {
  open: boolean
  language: Language
  mobileTheme?: MobileTheme
  onClose: () => void
  onAuthed: (payload: { user: AuthUser; billing: EntitlementStatus | null }) => void
}

const authCopy: Record<
  Language,
  {
    close: string
    loginTitle: string
    signupTitle: string
    loginSubtitle: string
    signupSubtitle: string
    username: string
    usernamePlaceholder: string
    usernamePhone: string
    phone: string
    phonePlaceholder: string
    password: string
    passwordPlaceholder: string
    confirmPassword: string
    confirmPasswordPlaceholder: string
    smsCode: string
    codePlaceholder: string
    adminCode: string
    adminCodePlaceholder: string
    send: string
    wait: string
    login: string
    create: string
    bindWechat: string
    smsLogin: string
    passwordLogin: string
    wechatLogin: string
    goSignup: string
    goLogin: string
    togglePassword: string
    passwordMismatch: string
    adminCodeRequired: string
    loginFailed: string
    codeFailed: string
    codeSent: (code: string) => string
    wechatFailed: string
    wechatBinding: string
  }
> = {
  en: {
    close: "Close",
    loginTitle: "LOGIN",
    signupTitle: "SIGNUP",
    loginSubtitle: "Access your account",
    signupSubtitle: "Create new account",
    username: "USERNAME",
    usernamePlaceholder: "Enter username",
    usernamePhone: "USERNAME / PHONE",
    phone: "PHONE",
    phonePlaceholder: "Enter phone",
    password: "PASSWORD",
    passwordPlaceholder: "Enter password",
    confirmPassword: "CONFIRM PASSWORD",
    confirmPasswordPlaceholder: "Confirm password",
    smsCode: "SMS CODE",
    codePlaceholder: "Enter code",
    adminCode: "ADMIN CODE",
    adminCodePlaceholder: "Enter admin code",
    send: "SEND",
    wait: "PLEASE WAIT",
    login: "LOGIN",
    create: "CREATE ACCOUNT",
    bindWechat: "CREATE & BIND WECHAT",
    smsLogin: "Login with SMS code",
    passwordLogin: "Login with password",
    wechatLogin: "WeChat Login",
    goSignup: "Don't have an account? SIGNUP",
    goLogin: "Already have an account? LOGIN",
    togglePassword: "Toggle password",
    passwordMismatch: "Passwords do not match.",
    adminCodeRequired: "Admin login requires the phone verification code.",
    loginFailed: "Login failed.",
    codeFailed: "Code sending failed.",
    codeSent: (code) => `Verification code sent. Dev code: ${code}`,
    wechatFailed: "Mock WeChat login failed.",
    wechatBinding: "First WeChat login needs a phone-bound account. Create one here, then it will bind automatically.",
  },
  zh: {
    close: "关闭",
    loginTitle: "登录",
    signupTitle: "注册",
    loginSubtitle: "访问你的账号",
    signupSubtitle: "创建新账号",
    username: "用户名",
    usernamePlaceholder: "请输入用户名",
    usernamePhone: "用户名 / 手机号",
    phone: "手机号",
    phonePlaceholder: "请输入手机号",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    confirmPassword: "确认密码",
    confirmPasswordPlaceholder: "请再次输入密码",
    smsCode: "验证码",
    codePlaceholder: "请输入验证码",
    adminCode: "管理员验证码",
    adminCodePlaceholder: "请输入管理员验证码",
    send: "发送",
    wait: "请稍候",
    login: "登录",
    create: "创建账号",
    bindWechat: "创建并绑定微信",
    smsLogin: "使用验证码登录",
    passwordLogin: "使用密码登录",
    wechatLogin: "微信登录",
    goSignup: "还没有账号？注册",
    goLogin: "已有账号？登录",
    togglePassword: "显示或隐藏密码",
    passwordMismatch: "两次输入的密码不一致。",
    adminCodeRequired: "管理员登录需要输入手机验证码。",
    loginFailed: "登录失败。",
    codeFailed: "验证码发送失败。",
    codeSent: (code) => `验证码已发送，开发模式验证码：${code}`,
    wechatFailed: "微信登录失败。",
    wechatBinding: "首次微信登录需要绑定手机号。请在这里创建账号，完成后会自动绑定微信。",
  },
}

export function AuthModal({ open, language, mobileTheme = "dark", onClose, onAuthed }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [loginMode, setLoginMode] = useState<"password" | "code">("password")
  const [mobileView, setMobileView] = useState<"methods" | "form">("methods")
  const [authTransitionDirection, setAuthTransitionDirection] = useState<AuthTransitionDirection>("forward")
  const [showPassword, setShowPassword] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const [username, setUsername] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [code, setCode] = useState("")
  const [adminCode, setAdminCode] = useState("")
  const [needsAdminCode, setNeedsAdminCode] = useState(false)
  const [wechatBinding, setWechatBinding] = useState(false)
  const [wechatOpenId, setWechatOpenId] = useState("mock-wechat")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const t = authCopy[language]

  useEffect(() => {
    if (!open) return
    setIsLogin(true)
    setLoginMode("password")
    setMobileView("methods")
    setAuthTransitionDirection("forward")
    setShowPassword(false)
    setIdentifier("")
    setUsername("")
    setPhone("")
    setPassword("")
    setConfirmPassword("")
    setCode("")
    setAdminCode("")
    setNeedsAdminCode(false)
    setWechatBinding(false)
    setWechatOpenId("mock-wechat")
    setNotice("")
    setLoading(false)
  }, [open])

  const sendCode = async (purpose?: string) => {
    const targetPhone = purpose === "admin" ? "+8618928268686" : isLogin ? identifier || phone : phone
    const response = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: targetPhone, purpose: purpose || (isLogin ? "login" : "register") }),
    })
    const body = await response.json()
    setNotice(response.ok ? t.codeSent(String(body.mockCode || "")) : body.error || t.codeFailed)
  }

  const refreshMe = async () => {
    const response = await fetch("/api/auth/me")
    const body = await response.json()
    if (body.user) onAuthed({ user: body.user, billing: body.billing })
  }

  const submit = async () => {
    setLoading(true)
    setNotice("")
    try {
      if (!isLogin && password !== confirmPassword) {
        setNotice(t.passwordMismatch)
        return
      }
      const endpoint = wechatBinding ? "/api/auth/wechat/mock" : isLogin ? "/api/auth/login" : "/api/auth/register"
      const payload = wechatBinding
        ? { openId: wechatOpenId, register: true, username, phone, password, code }
        : !isLogin
          ? { username, phone, password, code }
          : loginMode === "code"
            ? { mode: "code", phone: identifier || phone, code }
            : { mode: "password", identifier, password, adminCode }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) {
        if (body.requireAdminCode) {
          setNeedsAdminCode(true)
          setNotice(t.adminCodeRequired)
        } else {
          setNotice(body.error || t.loginFailed)
        }
        return
      }
      await refreshMe()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const mockWechat = async () => {
    setLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/auth/wechat/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId: wechatOpenId, phone, code }),
      })
      const body = await response.json()
      if (!response.ok) {
        setNotice(body.error || t.wechatFailed)
      } else if (body.requiresBinding) {
        setWechatOpenId(body.openId || "mock-wechat")
        setAuthTransitionDirection("forward")
        setWechatBinding(true)
        setIsLogin(false)
        setMobileView("form")
        setNotice(t.wechatBinding)
      } else {
        await refreshMe()
        onClose()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.wechatFailed)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setAuthTransitionDirection("switch")
    setIsLogin((value) => !value)
    setLoginMode("password")
    setMobileView("form")
    setNeedsAdminCode(false)
    setWechatBinding(false)
    setNotice("")
  }

  const openMobileForm = (nextIsLogin: boolean, mode: "password" | "code" = "password") => {
    setAuthTransitionDirection("forward")
    setIsLogin(nextIsLogin)
    setLoginMode(mode)
    setNeedsAdminCode(false)
    setWechatBinding(false)
    setNotice("")
    setMobileView("form")
  }

  const closeMobileForm = () => {
    setAuthTransitionDirection("back")
    setIsLogin(true)
    setLoginMode("password")
    setNeedsAdminCode(false)
    setWechatBinding(false)
    setNotice("")
    setMobileView("methods")
  }

  const toggleLoginMode = () => {
    setAuthTransitionDirection("switch")
    setLoginMode((value) => (value === "password" ? "code" : "password"))
    setNeedsAdminCode(false)
    setNotice("")
  }

  if (!open) return null

  const mobileAuthViewKey =
    mobileView === "methods"
      ? "methods"
      : `form-${isLogin ? "login" : "signup"}-${loginMode}-${wechatBinding ? "wechat" : "standard"}-${needsAdminCode ? "admin" : "normal"}`
  const desktopAuthViewKey = `${isLogin ? "login" : "signup"}-${loginMode}-${wechatBinding ? "wechat" : "standard"}-${needsAdminCode ? "admin" : "normal"}`

  const overlay = (
    <div className="modal-backdrop auth-backdrop">
      <section className="auth-mobile-screen" data-mobile-theme={mobileTheme} data-view={mobileView}>
        <AnimatePresence mode="wait" initial={false} custom={authTransitionDirection}>
        {mobileView === "methods" ? (
          <motion.div
            key={mobileAuthViewKey}
            className="auth-mobile-method-panel"
            custom={authTransitionDirection}
            variants={authMobilePageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={authMobilePageTransition}
          >
            <button className="auth-mobile-close" onClick={onClose} aria-label={t.close}>
              <X size={20} />
            </button>
            <header>
              <span>{language === "zh" ? "\u8d26\u53f7" : "Account"}</span>
              <h2>{language === "zh" ? "\u767b\u5f55\u540e\u89e3\u9501\u66f4\u591a\u529f\u80fd" : "Sign in to unlock more tools"}</h2>
              <p>{isLogin ? t.loginSubtitle : t.signupSubtitle}</p>
            </header>
            <div className="auth-mobile-methods">
              <button className="auth-mobile-wechat" onClick={() => void mockWechat()} disabled={loading}>
                <MessageCircle size={19} />
                <span>{t.wechatLogin}</span>
              </button>
              <button onClick={() => openMobileForm(true, "password")}>
                <Smartphone size={19} />
                <span>{language === "zh" ? "\u624b\u673a\u53f7 / \u5bc6\u7801\u767b\u5f55" : "Phone / password login"}</span>
              </button>
              <button onClick={() => openMobileForm(false)}>
                <UserPlus size={19} />
                <span>{language === "zh" ? "\u6ce8\u518c\u65b0\u8d26\u53f7" : "Create account"}</span>
              </button>
            </div>
            <p className="auth-mobile-terms">
              {language === "zh" ? "\u7ee7\u7eed\u8868\u793a\u5df2\u9605\u8bfb\u5e76\u540c\u610f\u670d\u52a1\u534f\u8bae\u548c\u9690\u79c1\u653f\u7b56" : "Continuing means you agree to the service terms and privacy policy."}
            </p>
            {notice && <p className="auth-notice template-notice">{notice}</p>}
          </motion.div>
        ) : (
          <motion.div
            key={mobileAuthViewKey}
            className="auth-mobile-route"
            custom={authTransitionDirection}
            variants={authMobilePageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={authMobilePageTransition}
          >
            <div className="auth-mobile-route-topbar">
              <button onClick={closeMobileForm} aria-label="Back">
                <ChevronLeft size={25} />
              </button>
              <button onClick={onClose} aria-label={t.close}>
                <X size={20} />
              </button>
            </div>
            <header className="auth-mobile-route-head">
              <h2>{isLogin ? t.loginTitle : t.signupTitle}</h2>
              <p>{wechatBinding ? t.wechatBinding : isLogin ? t.loginSubtitle : t.signupSubtitle}</p>
            </header>
            <form
              className="auth-template-form auth-mobile-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {!isLogin && (
                <label>
                  <span>{t.username}</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.usernamePlaceholder} />
                </label>
              )}

              <label>
                <span>{isLogin && loginMode === "password" ? t.usernamePhone : t.phone}</span>
                <input value={isLogin ? identifier : phone} onChange={(event) => (isLogin ? setIdentifier(event.target.value) : setPhone(event.target.value))} placeholder={isLogin && loginMode === "password" ? t.usernamePhone : t.phonePlaceholder} />
              </label>

              {(!isLogin || (isLogin && loginMode === "code")) && (
                <label>
                  <span>{t.smsCode}</span>
                  <div className="auth-template-code">
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t.codePlaceholder} />
                    <button type="button" onClick={() => void sendCode()} disabled={loading}>
                      {t.send}
                    </button>
                  </div>
                </label>
              )}

              {isLogin && loginMode === "code" ? null : (
                <label>
                  <span>{t.password}</span>
                  <div className="auth-template-password">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t.passwordPlaceholder} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={t.togglePassword}>
                      {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                    </button>
                  </div>
                </label>
              )}

              {!isLogin && (
                <label>
                  <span>{t.confirmPassword}</span>
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t.confirmPasswordPlaceholder} />
                </label>
              )}

              {needsAdminCode && isLogin && (
                <label>
                  <span>{t.adminCode}</span>
                  <div className="auth-template-code">
                    <input value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder={t.adminCodePlaceholder} />
                    <button type="button" onClick={() => void sendCode("admin")} disabled={loading}>
                      {t.send}
                    </button>
                  </div>
                </label>
              )}

              <button className="auth-template-submit" type="submit" disabled={loading}>
                {loading ? t.wait : wechatBinding ? t.bindWechat : isLogin ? t.login : t.create}
              </button>
            </form>

            {isLogin && (
              <button className="auth-template-alt" onClick={toggleLoginMode}>
                {loginMode === "password" ? t.smsLogin : t.passwordLogin}
              </button>
            )}

            {!wechatBinding && (
              <button className="auth-template-wechat auth-mobile-inline-wechat" onClick={() => void mockWechat()} disabled={loading}>
                <MessageCircle size={17} />
                {t.wechatLogin}
              </button>
            )}

            <button className="auth-template-switch" onClick={switchMode}>
              {isLogin ? t.goSignup : t.goLogin}
            </button>

            {notice && <p className="auth-notice template-notice">{notice}</p>}
          </motion.div>
        )}
        </AnimatePresence>
      </section>

      <section className={isLogin ? "auth-modal login-template-card" : "auth-modal login-template-card signup"} data-lang={language}>
        <button className="modal-close auth-close" onClick={onClose} aria-label={t.close}>
          <X size={18} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={desktopAuthViewKey}
            className="auth-template-content"
            variants={authDesktopPageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <header className="auth-template-head">
              <h2>{isLogin ? t.loginTitle : t.signupTitle}</h2>
              <p>{isLogin ? t.loginSubtitle : t.signupSubtitle}</p>
            </header>

            <form
              className="auth-template-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {!isLogin && (
                <label>
                  <span>{t.username}</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.usernamePlaceholder} />
                </label>
              )}

              <label>
                <span>{isLogin && loginMode === "password" ? t.usernamePhone : t.phone}</span>
                <input value={isLogin ? identifier : phone} onChange={(event) => (isLogin ? setIdentifier(event.target.value) : setPhone(event.target.value))} placeholder={isLogin && loginMode === "password" ? t.usernamePhone : t.phonePlaceholder} />
              </label>

              {!isLogin && (
                <label>
                  <span>{t.smsCode}</span>
                  <div className="auth-template-code">
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t.codePlaceholder} />
                    <button type="button" onClick={() => void sendCode()} disabled={loading}>
                      {t.send}
                    </button>
                  </div>
                </label>
              )}

              {isLogin && loginMode === "code" ? (
                <label>
                  <span>{t.smsCode}</span>
                  <div className="auth-template-code">
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t.codePlaceholder} />
                    <button type="button" onClick={() => void sendCode()} disabled={loading}>
                      {t.send}
                    </button>
                  </div>
                </label>
              ) : (
                <label>
                  <span>{t.password}</span>
                  <div className="auth-template-password">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t.passwordPlaceholder} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={t.togglePassword}>
                      {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                    </button>
                  </div>
                </label>
              )}

              {!isLogin && (
                <label>
                  <span>{t.confirmPassword}</span>
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t.confirmPasswordPlaceholder} />
                </label>
              )}

              {needsAdminCode && isLogin && (
                <label>
                  <span>{t.adminCode}</span>
                  <div className="auth-template-code">
                    <input value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder={t.adminCodePlaceholder} />
                    <button type="button" onClick={() => void sendCode("admin")} disabled={loading}>
                      {t.send}
                    </button>
                  </div>
                </label>
              )}

              <button className="auth-template-submit" type="submit" disabled={loading}>
                {loading ? t.wait : wechatBinding ? t.bindWechat : isLogin ? t.login : t.create}
              </button>
            </form>

            {isLogin && (
              <button className="auth-template-alt" onClick={toggleLoginMode}>
                {loginMode === "password" ? t.smsLogin : t.passwordLogin}
              </button>
            )}

            {!wechatBinding && (
              <button className="auth-template-wechat" onClick={() => void mockWechat()} disabled={loading}>
                <MessageCircle size={17} />
                {t.wechatLogin}
              </button>
            )}

            <button className="auth-template-switch" onClick={switchMode}>
              {isLogin ? t.goSignup : t.goLogin}
            </button>

            {notice && <p className="auth-notice template-notice">{notice}</p>}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  )

  return createPortal(overlay, document.body)
}
