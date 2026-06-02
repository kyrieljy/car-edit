"use client"

import { UserRound } from "lucide-react"
import type { AuthUser } from "@/lib/types"

export function AccountAvatar({
  user,
  imageUrl,
  className = "",
  label = "Account avatar",
}: {
  user?: AuthUser | null
  imageUrl?: string
  className?: string
  label?: string
}) {
  const src = imageUrl || user?.avatarUrl || (user ? "/assets/avatars/person_default.png" : "")
  return (
    <span className={["account-avatar-image", className].filter(Boolean).join(" ")} aria-label={label}>
      {src ? <img src={src} alt="" draggable={false} /> : <UserRound size={22} aria-hidden="true" />}
    </span>
  )
}
