"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, Eye, EyeOff, KeyRound, MessageCircle, Smartphone, UserPlus, X } from "lucide-react"
import type { AuthUser, EntitlementStatus } from "@/lib/types"

type Language = "en" | "zh"
type MobileTheme = "dark" | "light"
type AuthTransitionDirection = "forward" | "back" | "switch"
type MobileStep = "oneTap" | "sms" | "registerChoice" | "phoneRegister" | "password" | "forgot"
type DesktopStep = "sms" | "bind" | "password" | "forgot"
type CodePurpose = "login" | "register" | "admin" | "reset_password"
type AliyunPhoneServer = {
  checkLoginAvailable: (opts: {
    accessToken: string
    jwtToken: string
    timeout?: number
    success: (res: OneTapSdkResponse) => void
    error: (res: OneTapSdkResponse) => void
  }) => void
  getLoginToken: (opts: {
    timeout?: number
    authPageOption: Record<string, unknown>
    success: (res: OneTapSdkResponse) => void
    error: (res: OneTapSdkResponse) => void
    watch?: (status: number, netType: string, data?: unknown) => void
  }) => void
  setLoggerEnable?: (enabled: boolean) => void
  setUploadEnable?: (enabled: boolean) => void
}
type AliyunPhoneServerConstructor = new () => AliyunPhoneServer
type OneTapSdkResponse = {
  code?: number | string
  msg?: string
  spToken?: string
  requestId?: string
  [key: string]: unknown
}
type OneTapTokenPayload = {
  provider?: "mock" | "aliyun_h5"
  accessToken?: string
  jwtToken?: string
  requestId?: string
  error?: string
}

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.startsWith("86") && digits.length > 11 ? digits.slice(2, 13) : digits.slice(0, 11)
}

function isMainlandMobile(value: string) {
  return /^1[3-9]\d{9}$/.test(phoneDigits(value))
}

const authMobilePageTransition = { type: "spring", stiffness: 310, damping: 34 } as const
const authMobilePageVariants = {
  enter: (direction: AuthTransitionDirection) => ({
    opacity: 0,
    x: direction === "back" ? -34 : 34,
    scale: direction === "switch" ? 0.985 : 1,
    filter: "blur(8px)",
  }),
  center: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" },
  exit: (direction: AuthTransitionDirection) => ({
    opacity: 0,
    x: direction === "back" ? 34 : -34,
    scale: direction === "switch" ? 0.985 : 1,
    filter: "blur(6px)",
  }),
}

const authDesktopPageVariants = {
  enter: { opacity: 0, y: 12, scale: 0.985, filter: "blur(6px)" },
  center: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, scale: 0.985, filter: "blur(6px)" },
}

type AuthModalProps = {
  open: boolean
  language: Language
  mobileTheme?: MobileTheme
  onClose: () => void
  onAuthed: (payload: { user: AuthUser; billing: EntitlementStatus | null }) => void
}

const authCopy = {
  en: {
    close: "Close",
    back: "Back",
    account: "Account",
    oneTapTitle: "Phone one-tap login",
    oneTapSubtitle: "Your carrier provides phone number verification.",
    oneTapCta: "One-tap login / register",
    moreMethods: "More login methods",
    smsTitle: "SMS code login",
    pcSmsTitle: "Phone code login / register",
    pcSmsSubtitle: "",
    autoCreateAgreementSuffix: ", unregistered phone numbers will automatically create an account",
    registerTitle: "Phone quick register",
    phoneRegisterTitle: "Register with another phone",
    passwordTitle: "Password login",
    bindTitle: "Bind account",
    bindSubtitle: "Set a username and password for this phone number.",
    forgotTitle: "Reset password",
    forgotSubtitle: "Verify your phone number, then set a new password.",
    username: "Username",
    usernamePlaceholder: "Enter username",
    usernamePhone: "Username / phone",
    identifierPlaceholder: "Enter username or phone",
    phone: "Phone",
    phonePlaceholder: "Enter phone number",
    password: "Password",
    passwordPlaceholder: "Enter password",
    newPasswordPlaceholder: "Enter new password",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Confirm password",
    smsCode: "SMS code",
    codePlaceholder: "Enter code",
    adminCode: "Admin code",
    adminCodePlaceholder: "Enter admin code",
    send: "Send",
    wait: "Please wait",
    login: "Login",
    continue: "Continue",
    create: "Create account",
    bindAndLogin: "Bind and login",
    resetPassword: "Reset password",
    resetDone: "Password has been reset. Please login with the new password.",
    smsLogin: "SMS code login",
    passwordLogin: "Password login",
    goSignup: "New user register",
    goLogin: "Back to login",
    forgotPassword: "Forgot password",
    oneTapRegister: "One-tap phone register",
    otherPhoneRegister: "Register with another phone",
    otherMethods: "Other login methods",
    togglePassword: "Toggle password",
    agreementPrefix: "I have read and agree to",
    privacy: "Privacy Policy",
    terms: "User Agreement",
    needAgreement: "Please read and agree to the service terms first.",
    invalidPhone: "Please enter a valid mainland China mobile number.",
    passwordMismatch: "Passwords do not match.",
    adminCodeRequired: "Admin login requires a phone verification code.",
    passwordNotSet: "This phone account has not set a password yet. Please use SMS code login, or use Forgot password to set a login password.",
    loginFailed: "Login failed.",
    codeFailed: "Code sending failed.",
    codeSent: "Verification code sent.",
    codeSentDev: (code: string) => `Verification code sent. Dev code: ${code}`,
    registerFailed: "Registration failed.",
    resetFailed: "Password reset failed.",
    usernameExists: "Username already exists. Please enter a different username.",
    oneTapFailed: "One-tap login failed.",
    oneTapFallback: "One-tap login failed. You may not be using mobile data, or your carrier may be temporarily unavailable. Please use SMS code login.",
    socialSoon: (name: string) => `${name} login is not available in this test build yet.`,
    duplicatePhone: (username: string) => `This phone number is already registered and bound to user ${username}.`,
    maskedPhone: "Carrier auth",
  },
  zh: {
    close: "关闭",
    back: "返回",
    account: "账号",
    oneTapTitle: "本机号码一键登录",
    oneTapSubtitle: "运营商将为当前设备提供号码认证服务。",
    oneTapCta: "本机号码一键登录/注册",
    moreMethods: "更多登录方式",
    smsTitle: "短信验证码登录",
    pcSmsTitle: "手机验证码登录/注册",
    pcSmsSubtitle: "",
    autoCreateAgreementSuffix: "，未注册的手机号将自动创建账号",
    registerTitle: "手机号快速注册",
    phoneRegisterTitle: "其他手机号注册",
    passwordTitle: "账号密码登录",
    bindTitle: "绑定用户账号",
    bindSubtitle: "为该手机号设置用户名和密码。",
    forgotTitle: "忘记密码",
    forgotSubtitle: "通过手机号验证码验证后设置新密码。",
    username: "用户名",
    usernamePlaceholder: "请输入用户名",
    usernamePhone: "用户名 / 手机号",
    identifierPlaceholder: "请输入用户名或手机号",
    phone: "手机号",
    phonePlaceholder: "请输入手机号",
    password: "密码",
    passwordPlaceholder: "请输入密码",
    newPasswordPlaceholder: "请输入新密码",
    confirmPassword: "确认密码",
    confirmPasswordPlaceholder: "请再次输入密码",
    smsCode: "验证码",
    codePlaceholder: "请输入验证码",
    adminCode: "管理员验证码",
    adminCodePlaceholder: "请输入管理员验证码",
    send: "获取",
    wait: "请稍候",
    login: "登录",
    continue: "继续",
    create: "创建账号",
    bindAndLogin: "绑定并登录",
    resetPassword: "更换密码",
    resetDone: "密码已重置，请使用新密码登录。",
    smsLogin: "短信验证码登录",
    passwordLogin: "账号密码登录",
    goSignup: "新用户注册",
    goLogin: "返回登录",
    forgotPassword: "忘记密码",
    oneTapRegister: "本机号码一键注册",
    otherPhoneRegister: "其他手机号注册",
    otherMethods: "其他登录方式",
    togglePassword: "显示或隐藏密码",
    agreementPrefix: "我已阅读并同意",
    privacy: "隐私政策",
    terms: "用户服务协议",
    needAgreement: "请先阅读并同意服务协议和隐私政策。",
    invalidPhone: "请输出正确的手机号码。",
    passwordMismatch: "两次输入的密码不一致。",
    adminCodeRequired: "管理员登录需要输入手机验证码。",
    passwordNotSet: "该手机号账号尚未设置密码，请使用短信验证码登录，或通过忘记密码设置登录密码。",
    loginFailed: "登录失败。",
    codeFailed: "验证码发送失败。",
    codeSent: "验证码已发送。",
    codeSentDev: (code: string) => `验证码已发送，本地测试验证码：${code}`,
    registerFailed: "注册失败。",
    resetFailed: "密码重置失败。",
    usernameExists: "用户名已存在，请重新输入。",
    oneTapFailed: "本机号码登录失败。",
    oneTapFallback: "本机号码登录失败，可能是当前未使用移动数据或运营商暂不可用，请使用短信验证码登录。",
    socialSoon: (name: string) => `${name} 登录在当前测试版本暂未开放。`,
    duplicatePhone: (username: string) => `该手机号已注册并绑定 ${username} 用户。`,
    maskedPhone: "本机号码登录",
  },
}

type Copy = (typeof authCopy)["en"]

export function AuthModal({ open, language, mobileTheme = "dark", onClose, onAuthed }: AuthModalProps) {
  const t = authCopy[language]
  const [mobileStep, setMobileStep] = useState<MobileStep>("oneTap")
  const [desktopStep, setDesktopStep] = useState<DesktopStep>("sms")
  const [authTransitionDirection, setAuthTransitionDirection] = useState<AuthTransitionDirection>("forward")
  const [agreed, setAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const [username, setUsername] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [code, setCode] = useState("")
  const [adminCode, setAdminCode] = useState("")
  const [needsAdminCode, setNeedsAdminCode] = useState(false)
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const [codeSending, setCodeSending] = useState(false)
  const [codeCooldown, setCodeCooldown] = useState(0)
  const [codeFeedback, setCodeFeedback] = useState("")
  const [codeFeedbackTone, setCodeFeedbackTone] = useState<"info" | "error">("info")

  const resetAuthState = useCallback(() => {
    setMobileStep("oneTap")
    setDesktopStep("sms")
    setAuthTransitionDirection("forward")
    setAgreed(false)
    setShowPassword(false)
    setIdentifier("")
    setUsername("")
    setPhone("")
    setPassword("")
    setConfirmPassword("")
    setCode("")
    setAdminCode("")
    setNeedsAdminCode(false)
    setNotice("")
    setLoading(false)
    setCodeSending(false)
    setCodeCooldown(0)
    setCodeFeedback("")
    setCodeFeedbackTone("info")
  }, [])

  useLayoutEffect(() => {
    resetAuthState()
  }, [open, resetAuthState])

  const handleAuthClose = () => {
    resetAuthState()
    onClose()
  }

  useEffect(() => {
    if (!open || codeCooldown <= 0) return
    const timer = window.setInterval(() => {
      setCodeCooldown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [codeCooldown, open])

  if (!open) return null

  const refreshMe = async () => {
    const response = await fetch("/api/auth/me")
    const body = await response.json()
    if (body.user) onAuthed({ user: body.user, billing: body.billing })
  }

  const requireAgreement = () => {
    if (agreed) return true
    setNotice(t.needAgreement)
    return false
  }

  const requireValidPhone = () => {
    if (isMainlandMobile(phone)) return true
    setNotice("")
    setCodeFeedback(t.invalidPhone)
    setCodeFeedbackTone("error")
    return false
  }

  const handleDuplicatePhone = (body: { username?: unknown; error?: unknown }) => {
    const message = typeof body.username === "string" ? t.duplicatePhone(body.username) : String(body.error || t.registerFailed)
    setNotice(message)
    setCodeFeedback("")
    setCodeFeedbackTone("info")
    setAuthTransitionDirection("switch")
    setMobileStep("sms")
    setDesktopStep("sms")
  }

  const sendCode = async (purpose: CodePurpose = "login") => {
    if (codeSending || codeCooldown > 0) return
    if (purpose !== "admin" && !requireValidPhone()) return
    setNotice("")
    setCodeFeedback("")
    setCodeFeedbackTone("info")
    setCodeSending(true)
    try {
      const payload = purpose === "admin" ? { purpose: "admin", identifier, password } : { purpose, phone }
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.code === "PHONE_ALREADY_REGISTERED") {
          handleDuplicatePhone(body)
        } else {
          const message = typeof body.error === "string" ? body.error : t.codeFailed
          setCodeFeedback(message)
          setCodeFeedbackTone("error")
        }
        return
      }
      const message = typeof body.devCode === "string" ? t.codeSentDev(body.devCode) : t.codeSent
      setCodeFeedback(message)
      setCodeFeedbackTone("info")
      setCodeCooldown(60)
    } catch (error) {
      const message = error instanceof Error ? error.message : t.codeFailed
      setCodeFeedback(message)
      setCodeFeedbackTone("error")
    } finally {
      setCodeSending(false)
    }
  }

  const finishAuth = async () => {
    await refreshMe()
    handleAuthClose()
  }

  const finishOneTapWithToken = async (spToken: string) => {
    const response = await fetch("/api/auth/one-tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spToken, platform: "web_h5" }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : t.oneTapFailed)
    await finishAuth()
  }

  const fallbackToSmsLogin = (message: string) => {
    setAuthTransitionDirection("switch")
    setMobileStep("sms")
    setDesktopStep("sms")
    setNotice(message || t.oneTapFallback)
  }

  const submitOneTap = async () => {
    if (!requireAgreement()) return
    setLoading(true)
    setNotice("")
    try {
      const tokenResponse = await fetch("/api/auth/one-tap/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const tokenBody = (await tokenResponse.json().catch(() => ({}))) as OneTapTokenPayload
      if (!tokenResponse.ok) {
        fallbackToSmsLogin(typeof tokenBody.error === "string" ? tokenBody.error : t.oneTapFallback)
        return
      }
      if (tokenBody.provider === "mock") {
        await finishOneTapWithToken("mock-one-tap")
        return
      }
      if (!tokenBody.accessToken || !tokenBody.jwtToken) {
        fallbackToSmsLogin(t.oneTapFallback)
        return
      }
      const phoneServer = await loadAliyunPhoneServer()
      phoneServer.setLoggerEnable?.(false)
      phoneServer.setUploadEnable?.(true)
      await checkAliyunLoginAvailable(phoneServer, tokenBody.accessToken, tokenBody.jwtToken)
      const token = await getAliyunLoginSpToken(phoneServer, {
        account: t.account,
        login: mobileStep === "registerChoice" ? t.oneTapRegister : t.oneTapCta,
        privacy: t.privacy,
        terms: t.terms,
      })
      await finishOneTapWithToken(token)
    } catch (error) {
      const detail = error instanceof Error && error.message ? error.message : t.oneTapFailed
      fallbackToSmsLogin(detail === t.oneTapFailed ? t.oneTapFallback : `${detail} ${t.oneTapFallback}`)
    } finally {
      setLoading(false)
    }
  }

  const submitSmsLogin = async (bindRequired: boolean) => {
    if (!requireValidPhone()) return
    if (!requireAgreement()) return
    setLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "code", phone, code, bindRequired }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setNotice(typeof body.error === "string" ? body.error : t.loginFailed)
        return
      }
      if (body.requiresBinding) {
        setAuthTransitionDirection("forward")
        setDesktopStep("bind")
        setMobileStep("phoneRegister")
        setNotice(t.bindSubtitle)
        return
      }
      await finishAuth()
    } finally {
      setLoading(false)
    }
  }

  const submitRegister = async (purpose: "login" | "register") => {
    if (!requireValidPhone()) return
    if (!requireAgreement()) return
    if (password !== confirmPassword) {
      setNotice(t.passwordMismatch)
      return
    }
    setLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, phone, password, code, purpose }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.code === "PHONE_ALREADY_REGISTERED") {
          handleDuplicatePhone(body)
        } else if (body.code === "USERNAME_ALREADY_REGISTERED") {
          setNotice(t.usernameExists)
        } else {
          setNotice(typeof body.error === "string" ? body.error : t.registerFailed)
        }
        return
      }
      await finishAuth()
    } finally {
      setLoading(false)
    }
  }

  const submitPasswordLogin = async () => {
    if (!requireAgreement()) return
    setLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "password", identifier, password, adminCode }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.requireAdminCode) {
          setNeedsAdminCode(true)
          setNotice(t.adminCodeRequired)
        } else if (body.code === "PASSWORD_NOT_SET") {
          setNotice(t.passwordNotSet)
        } else {
          setNotice(typeof body.error === "string" ? body.error : t.loginFailed)
        }
        return
      }
      await finishAuth()
    } finally {
      setLoading(false)
    }
  }

  const submitResetPassword = async () => {
    if (!requireValidPhone()) return
    if (!requireAgreement()) return
    if (password !== confirmPassword) {
      setNotice(t.passwordMismatch)
      return
    }
    setLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, nextPassword: password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setNotice(typeof body.error === "string" ? body.error : t.resetFailed)
        return
      }
      setAuthTransitionDirection("switch")
      setDesktopStep("password")
      setMobileStep("password")
      setIdentifier(phone)
      setPassword("")
      setConfirmPassword("")
      setCode("")
      setNotice(t.resetDone)
    } finally {
      setLoading(false)
    }
  }

  const openMobileStep = (step: MobileStep, direction: AuthTransitionDirection = "forward") => {
    setAuthTransitionDirection(direction)
    setMobileStep(step)
    setNeedsAdminCode(false)
    setNotice("")
    setCodeFeedback("")
    setCodeFeedbackTone("info")
    setCodeCooldown(0)
  }

  const openDesktopStep = (step: DesktopStep) => {
    setDesktopStep(step)
    setNeedsAdminCode(false)
    setNotice("")
    setCodeFeedback("")
    setCodeFeedbackTone("info")
    setCodeCooldown(0)
  }

  const socialPlaceholder = (name: string) => {
    setNotice(t.socialSoon(name))
  }

  const renderNotice = () => (notice && notice !== codeFeedback ? <p className="auth-notice template-notice">{notice}</p> : null)

  const mobileTitle = mobileTitleForStep(mobileStep, t)
  const desktopTitle = desktopTitleForStep(desktopStep, t)
  const mobileSubtitle = mobileSubtitleForStep(mobileStep, t)
  const desktopSubtitle = desktopSubtitleForStep(desktopStep, t)
  const mobileAuthViewKey = `${mobileStep}-${needsAdminCode ? "admin" : "normal"}`
  const desktopAuthViewKey = `${desktopStep}-${needsAdminCode ? "admin" : "normal"}`
  const isSignupSized = desktopStep === "bind" || desktopStep === "forgot"

  const overlay = (
    <div className="modal-backdrop auth-backdrop">
      <section className="auth-mobile-screen" data-mobile-theme={mobileTheme} data-view={mobileStep === "oneTap" || mobileStep === "registerChoice" ? "methods" : "form"}>
        <AnimatePresence mode="wait" custom={authTransitionDirection}>
          {mobileStep === "oneTap" || mobileStep === "registerChoice" ? (
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
              {mobileStep === "registerChoice" && (
                <button className="auth-mobile-method-back" onClick={() => openMobileStep("oneTap", "back")} aria-label={t.back}>
                  <ChevronLeft size={25} />
                </button>
              )}
              <button className="auth-mobile-close" onClick={handleAuthClose} aria-label={t.close}>
                <X size={20} />
              </button>
              <CarBrandMark />
              <header>
                <h2>{mobileTitle}</h2>
                <p className="auth-mobile-mask">{t.maskedPhone}</p>
              </header>
              <div className="auth-mobile-methods">
                <button className="auth-mobile-wechat" onClick={() => void submitOneTap()} disabled={loading}>
                  <Smartphone size={19} />
                  <span>{loading ? t.wait : mobileStep === "registerChoice" ? t.oneTapRegister : t.oneTapCta}</span>
                </button>
                <button onClick={() => openMobileStep(mobileStep === "registerChoice" ? "phoneRegister" : "sms")}>
                  {mobileStep === "registerChoice" ? <UserPlus size={19} /> : <KeyRound size={19} />}
                  <span>{mobileStep === "registerChoice" ? t.otherPhoneRegister : t.moreMethods}</span>
                </button>
              </div>
              {renderNotice()}
              <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
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
                <button onClick={() => openMobileStep(mobileStep === "phoneRegister" ? "registerChoice" : "oneTap", "back")} aria-label={t.back}>
                  <ChevronLeft size={25} />
                </button>
                <button onClick={handleAuthClose} aria-label={t.close}>
                  <X size={20} />
                </button>
              </div>
              <header className="auth-mobile-route-head">
                <h2>{mobileTitle}</h2>
                {mobileSubtitle && <p>{mobileSubtitle}</p>}
              </header>
              {renderMobileForm()}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className={isSignupSized ? "auth-modal login-template-card signup" : "auth-modal login-template-card"} data-lang={language}>
        <button className="modal-close auth-close" onClick={handleAuthClose} aria-label={t.close}>
          <X size={18} />
        </button>
        <AnimatePresence mode="wait">
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
              <h2>{desktopTitle}</h2>
              {desktopSubtitle && <p>{desktopSubtitle}</p>}
            </header>
            {renderDesktopForm()}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  )

  function renderMobileForm() {
    if (mobileStep === "sms") {
      return (
        <form className="auth-template-form auth-mobile-form" onSubmit={(event) => { event.preventDefault(); void submitSmsLogin(false) }}>
          <PhoneCodeFields t={t} phone={phone} setPhone={setPhone} code={code} setCode={setCode} sendCode={() => void sendCode("login")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} />
          {renderNotice()}
          <Agreement agreed={agreed} setAgreed={setAgreed} t={t} suffix={t.autoCreateAgreementSuffix} />
          <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.login}</button>
          <AuthLinks items={[[t.goSignup, () => openMobileStep("registerChoice", "switch")], [t.passwordLogin, () => openMobileStep("password", "switch")], [t.forgotPassword, () => openMobileStep("forgot", "switch")]]} />
          <SocialButtons t={t} onClick={socialPlaceholder} />
        </form>
      )
    }
    if (mobileStep === "phoneRegister") {
      return (
        <form className="auth-template-form auth-mobile-form" onSubmit={(event) => { event.preventDefault(); void submitRegister("register") }}>
          <PhoneCodeFields t={t} phone={phone} setPhone={setPhone} code={code} setCode={setCode} sendCode={() => void sendCode("register")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} />
          <AccountBindFields t={t} username={username} setUsername={setUsername} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showPassword={showPassword} setShowPassword={setShowPassword} />
          {renderNotice()}
          <Agreement agreed={agreed} setAgreed={setAgreed} t={t} suffix={t.autoCreateAgreementSuffix} />
          <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.create}</button>
        </form>
      )
    }
    if (mobileStep === "forgot") {
      return (
        <form className="auth-template-form auth-mobile-form" onSubmit={(event) => { event.preventDefault(); void submitResetPassword() }}>
          <PhoneCodeFields t={t} phone={phone} setPhone={setPhone} code={code} setCode={setCode} sendCode={() => void sendCode("reset_password")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} />
          <PasswordResetFields t={t} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showPassword={showPassword} setShowPassword={setShowPassword} />
          {renderNotice()}
          <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
          <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.resetPassword}</button>
        </form>
      )
    }
    return (
      <form className="auth-template-form auth-mobile-form" onSubmit={(event) => { event.preventDefault(); void submitPasswordLogin() }}>
        <PasswordLoginFields t={t} identifier={identifier} setIdentifier={setIdentifier} password={password} setPassword={setPassword} adminCode={adminCode} setAdminCode={setAdminCode} needsAdminCode={needsAdminCode} sendAdminCode={() => void sendCode("admin")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} showPassword={showPassword} setShowPassword={setShowPassword} />
        {renderNotice()}
        <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
        <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.login}</button>
        <AuthLinks items={[[t.goSignup, () => openMobileStep("registerChoice", "switch")], [t.smsLogin, () => openMobileStep("sms", "switch")], [t.forgotPassword, () => openMobileStep("forgot", "switch")]]} />
        <SocialButtons t={t} onClick={socialPlaceholder} />
      </form>
    )
  }

  function renderDesktopForm() {
    if (desktopStep === "sms") {
      return (
        <form className="auth-template-form" onSubmit={(event) => { event.preventDefault(); void submitSmsLogin(true) }}>
          <PhoneCodeFields t={t} phone={phone} setPhone={setPhone} code={code} setCode={setCode} sendCode={() => void sendCode("login")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} />
          {renderNotice()}
          <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
          <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.continue}</button>
          <AuthLinks items={[[t.passwordLogin, () => openDesktopStep("password")], [t.forgotPassword, () => openDesktopStep("forgot")]]} />
          <SocialButtons t={t} onClick={socialPlaceholder} />
        </form>
      )
    }
    if (desktopStep === "bind") {
      return (
        <form className="auth-template-form" onSubmit={(event) => { event.preventDefault(); void submitRegister("login") }}>
          <label>
            <span>{t.phone}</span>
            <input value={phone} readOnly />
          </label>
          <AccountBindFields t={t} username={username} setUsername={setUsername} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showPassword={showPassword} setShowPassword={setShowPassword} />
          {renderNotice()}
          <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
          <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.bindAndLogin}</button>
          <button className="auth-template-switch" type="button" onClick={() => openDesktopStep("sms")}>{t.goLogin}</button>
        </form>
      )
    }
    if (desktopStep === "forgot") {
      return (
        <form className="auth-template-form" onSubmit={(event) => { event.preventDefault(); void submitResetPassword() }}>
          <PhoneCodeFields t={t} phone={phone} setPhone={setPhone} code={code} setCode={setCode} sendCode={() => void sendCode("reset_password")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} />
          <PasswordResetFields t={t} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showPassword={showPassword} setShowPassword={setShowPassword} />
          {renderNotice()}
          <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
          <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.resetPassword}</button>
          <button className="auth-template-switch" type="button" onClick={() => openDesktopStep("password")}>{t.goLogin}</button>
        </form>
      )
    }
    return (
      <form className="auth-template-form" onSubmit={(event) => { event.preventDefault(); void submitPasswordLogin() }}>
        <PasswordLoginFields t={t} identifier={identifier} setIdentifier={setIdentifier} password={password} setPassword={setPassword} adminCode={adminCode} setAdminCode={setAdminCode} needsAdminCode={needsAdminCode} sendAdminCode={() => void sendCode("admin")} codeSending={codeSending} codeCooldown={codeCooldown} codeFeedback={codeFeedback} codeFeedbackTone={codeFeedbackTone} showPassword={showPassword} setShowPassword={setShowPassword} />
        {renderNotice()}
        <Agreement agreed={agreed} setAgreed={setAgreed} t={t} />
        <button className="auth-template-submit" type="submit" disabled={loading}>{loading ? t.wait : t.login}</button>
        <AuthLinks items={[[t.smsLogin, () => openDesktopStep("sms")], [t.forgotPassword, () => openDesktopStep("forgot")]]} />
        <SocialButtons t={t} onClick={socialPlaceholder} />
      </form>
    )
  }

  return createPortal(overlay, document.body)
}

function mobileTitleForStep(step: MobileStep, t: Copy) {
  if (step === "oneTap") return t.oneTapTitle
  if (step === "sms") return t.smsTitle
  if (step === "registerChoice") return t.registerTitle
  if (step === "phoneRegister") return t.phoneRegisterTitle
  if (step === "forgot") return t.forgotTitle
  return t.passwordTitle
}

function mobileSubtitleForStep(step: MobileStep, t: Copy) {
  if (step === "forgot") return t.forgotSubtitle
  if (step === "phoneRegister") return t.bindSubtitle
  if (step === "sms") return ""
  return t.oneTapSubtitle
}

function desktopTitleForStep(step: DesktopStep, t: Copy) {
  if (step === "bind") return t.bindTitle
  if (step === "password") return t.passwordTitle
  if (step === "forgot") return t.forgotTitle
  return t.pcSmsTitle
}

function desktopSubtitleForStep(step: DesktopStep, t: Copy) {
  if (step === "bind") return t.bindSubtitle
  if (step === "forgot") return t.forgotSubtitle
  if (step === "password") return ""
  return t.pcSmsSubtitle
}

async function loadAliyunPhoneServer() {
  const sdk = (await import("aliyun_numberauthsdk_web")) as unknown as {
    PhoneNumberServer?: AliyunPhoneServerConstructor
    default?: { PhoneNumberServer?: AliyunPhoneServerConstructor }
  }
  const fromWindow =
    typeof window !== "undefined"
      ? (window as Window & { PhoneNumberServer?: AliyunPhoneServerConstructor }).PhoneNumberServer
      : undefined
  const PhoneNumberServer = sdk.PhoneNumberServer || sdk.default?.PhoneNumberServer || fromWindow
  if (!PhoneNumberServer) throw new Error("Aliyun phone number SDK is unavailable.")
  return new PhoneNumberServer()
}

function checkAliyunLoginAvailable(phoneServer: AliyunPhoneServer, accessToken: string, jwtToken: string) {
  return new Promise<void>((resolve, reject) => {
    phoneServer.checkLoginAvailable({
      accessToken,
      jwtToken,
      timeout: 10000,
      success: (res) => {
        if (isAliyunSdkSuccess(res)) resolve()
        else reject(new Error(sdkErrorMessage(res, "Aliyun one-tap authorization failed.")))
      },
      error: (res) => reject(new Error(sdkErrorMessage(res, "Aliyun one-tap authorization failed."))),
    })
  })
}

function getAliyunLoginSpToken(phoneServer: AliyunPhoneServer, copy: { account: string; login: string; privacy: string; terms: string }) {
  return new Promise<string>((resolve, reject) => {
    phoneServer.getLoginToken({
      timeout: 10000,
      authPageOption: oneTapAuthPageOption(copy),
      success: (res) => {
        if (isAliyunSdkSuccess(res) && typeof res.spToken === "string" && res.spToken) resolve(res.spToken)
        else reject(new Error(sdkErrorMessage(res, "Aliyun one-tap token failed.")))
      },
      error: (res) => reject(new Error(sdkErrorMessage(res, "Aliyun one-tap token failed."))),
      watch: () => undefined,
    })
  })
}

function oneTapAuthPageOption(copy: { account: string; login: string; privacy: string; terms: string }) {
  return {
    navText: copy.account,
    btnText: copy.login,
    isDialog: true,
    manualClose: false,
    privacyVenderIndex: 2,
    privacyOne: [copy.privacy, absoluteAuthUrl("/privacy")],
    privacyTwo: [copy.terms, absoluteAuthUrl("/terms")],
    privacyAlertIsNeedShow: true,
    privacyAlertConfig: {
      title: copy.account,
      btnText: copy.login,
      privacyAlertIsDialog: true,
      privacyAlertLoginText: copy.login,
      privacyAlertMaskIsNeedShow: true,
      privacyAlertIsNeedAutoLogin: true,
    },
  }
}

function absoluteAuthUrl(path: string) {
  if (typeof window === "undefined") return path
  return new URL(path, window.location.origin).toString()
}

function isAliyunSdkSuccess(res: OneTapSdkResponse) {
  return String(res?.code || "") === "600000"
}

function sdkErrorMessage(res: OneTapSdkResponse, fallback: string) {
  return typeof res?.msg === "string" && res.msg ? res.msg : fallback
}

function Agreement({ agreed, setAgreed, t, suffix = "" }: { agreed: boolean; setAgreed: (value: boolean) => void; t: Copy; suffix?: string }) {
  return (
    <label className="auth-template-agreement">
      <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
      <span>
        {t.agreementPrefix} <a href="/privacy" onClick={(event) => event.preventDefault()}>{t.privacy}</a> <a href="/terms" onClick={(event) => event.preventDefault()}>{t.terms}</a>{suffix}
      </span>
    </label>
  )
}

function PhoneCodeFields(props: {
  t: Copy
  phone: string
  setPhone: (value: string) => void
  code: string
  setCode: (value: string) => void
  sendCode: () => void
  codeSending: boolean
  codeCooldown: number
  codeFeedback: string
  codeFeedbackTone: "info" | "error"
}) {
  const sendLabel = props.codeSending ? props.t.wait : props.codeCooldown > 0 ? `${props.codeCooldown}s` : props.t.send
  return (
    <>
      <label>
        <span>{props.t.phone}</span>
        <div className="auth-template-phone">
          <b>+86</b>
          <input value={props.phone} onChange={(event) => props.setPhone(phoneDigits(event.target.value))} placeholder={props.t.phonePlaceholder} inputMode="tel" autoComplete="tel-national" maxLength={11} />
        </div>
      </label>
      <label>
        <span>{props.t.smsCode}</span>
        <div className="auth-template-code">
          <input value={props.code} onChange={(event) => props.setCode(event.target.value)} placeholder={props.t.codePlaceholder} inputMode="numeric" />
          <button type="button" onClick={props.sendCode} disabled={props.codeSending || props.codeCooldown > 0}>{sendLabel}</button>
        </div>
        {props.codeFeedback && <small className="auth-template-code-feedback" data-tone={props.codeFeedbackTone}>{props.codeFeedback}</small>}
      </label>
    </>
  )
}

function AccountBindFields(props: {
  t: Copy
  username: string
  setUsername: (value: string) => void
  password: string
  setPassword: (value: string) => void
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
}) {
  return (
    <>
      <label>
        <span>{props.t.username}</span>
        <input value={props.username} onChange={(event) => props.setUsername(event.target.value)} placeholder={props.t.usernamePlaceholder} />
      </label>
      <PasswordInput label={props.t.password} placeholder={props.t.passwordPlaceholder} value={props.password} setValue={props.setPassword} showPassword={props.showPassword} setShowPassword={props.setShowPassword} toggleLabel={props.t.togglePassword} />
      <label>
        <span>{props.t.confirmPassword}</span>
        <input type="password" value={props.confirmPassword} onChange={(event) => props.setConfirmPassword(event.target.value)} placeholder={props.t.confirmPasswordPlaceholder} />
      </label>
    </>
  )
}

function PasswordResetFields(props: {
  t: Copy
  password: string
  setPassword: (value: string) => void
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
}) {
  return (
    <>
      <PasswordInput label={props.t.password} placeholder={props.t.newPasswordPlaceholder} value={props.password} setValue={props.setPassword} showPassword={props.showPassword} setShowPassword={props.setShowPassword} toggleLabel={props.t.togglePassword} />
      <label>
        <span>{props.t.confirmPassword}</span>
        <input type="password" value={props.confirmPassword} onChange={(event) => props.setConfirmPassword(event.target.value)} placeholder={props.t.confirmPasswordPlaceholder} />
      </label>
    </>
  )
}

function PasswordLoginFields(props: {
  t: Copy
  identifier: string
  setIdentifier: (value: string) => void
  password: string
  setPassword: (value: string) => void
  adminCode: string
  setAdminCode: (value: string) => void
  needsAdminCode: boolean
  sendAdminCode: () => void
  codeSending: boolean
  codeCooldown: number
  codeFeedback: string
  codeFeedbackTone: "info" | "error"
  showPassword: boolean
  setShowPassword: (value: boolean) => void
}) {
  const sendLabel = props.codeSending ? props.t.wait : props.codeCooldown > 0 ? `${props.codeCooldown}s` : props.t.send
  return (
    <>
      <label>
        <span>{props.t.usernamePhone}</span>
        <input value={props.identifier} onChange={(event) => props.setIdentifier(event.target.value)} placeholder={props.t.identifierPlaceholder} />
      </label>
      <PasswordInput label={props.t.password} placeholder={props.t.passwordPlaceholder} value={props.password} setValue={props.setPassword} showPassword={props.showPassword} setShowPassword={props.setShowPassword} toggleLabel={props.t.togglePassword} />
      {props.needsAdminCode && (
        <label>
          <span>{props.t.adminCode}</span>
          <div className="auth-template-code">
            <input value={props.adminCode} onChange={(event) => props.setAdminCode(event.target.value)} placeholder={props.t.adminCodePlaceholder} inputMode="numeric" />
            <button type="button" onClick={props.sendAdminCode} disabled={props.codeSending || props.codeCooldown > 0}>{sendLabel}</button>
          </div>
          {props.codeFeedback && <small className="auth-template-code-feedback" data-tone={props.codeFeedbackTone}>{props.codeFeedback}</small>}
        </label>
      )}
    </>
  )
}

function PasswordInput(props: {
  label: string
  placeholder: string
  value: string
  setValue: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  toggleLabel: string
}) {
  return (
    <label>
      <span>{props.label}</span>
      <div className="auth-template-password">
        <input type={props.showPassword ? "text" : "password"} value={props.value} onChange={(event) => props.setValue(event.target.value)} placeholder={props.placeholder} />
        <button type="button" onClick={() => props.setShowPassword(!props.showPassword)} aria-label={props.toggleLabel}>
          {props.showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
        </button>
      </div>
    </label>
  )
}

function AuthLinks({ items }: { items: Array<[string, () => void]> }) {
  return (
    <div className="auth-template-links">
      {items.map(([label, onClick]) => (
        <button key={label} type="button" onClick={onClick}>{label}</button>
      ))}
    </div>
  )
}

function SocialButtons({ t, onClick }: { t: Copy; onClick: (name: string) => void }) {
  const methods = [
    { name: "WeChat", className: "wechat", icon: <MessageCircle size={18} /> },
    { name: "Apple", className: "apple", icon: <AppleLogo /> },
    { name: "QQ", className: "qq", icon: <QQLogo /> },
    { name: "Gmail", className: "google", icon: <GoogleLogo /> },
  ]
  return (
    <div className="auth-template-social">
      <span>{t.otherMethods}</span>
      <div>
        {methods.map((method) => (
          <button key={method.name} className={`auth-social-${method.className}`} type="button" title={method.name} aria-label={method.name} onClick={() => onClick(method.name)}>
            {method.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

function CarBrandMark() {
  return (
    <div className="auth-mobile-brand-mark" aria-hidden="true">
      <img src="/auth-carapp-mark.png" alt="" draggable={false} />
    </div>
  )
}

function AppleLogo() {
  return (
    <svg className="auth-social-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.8 12.5c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.8 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 3 2.3 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.8s2.1-1.1 2.9-2.3c.9-1.3 1.2-2.5 1.2-2.6-.1-.1-2.6-1-2.6-4Zm-2.4-6.8c.7-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.9-1 2.9 1 .1 2-.5 2.7-1.3Z" />
    </svg>
  )
}

function QQLogo() {
  return (
    <svg className="auth-social-logo auth-social-logo-qq" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg className="auth-social-logo auth-social-logo-google" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.2 3-7Z" />
      <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.4c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5C4.7 19.7 8.1 22 12 22Z" />
      <path fill="#fbbc05" d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.6H3.1C2.4 8.9 2 10.4 2 12s.4 3.1 1.1 4.4l3.3-2.5Z" />
      <path fill="#ea4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.6l3.3 2.5C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  )
}
