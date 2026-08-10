import type React from "react"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-context"
import "./globals.css"

export const metadata: Metadata = {
  title: "OnCar AI",
  description: "AI 驱动的汽车改装效果预览平台，上传车辆照片即可生成改装效果预览。",
}

// Inline script to prevent FOUC: sets <html data-theme> before React hydration.
const themeInitScript = `(function(){try{var k="car-mod-studio-theme";var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
