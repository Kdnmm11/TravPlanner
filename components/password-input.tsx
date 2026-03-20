"use client"

import type { InputHTMLAttributes } from "react"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  containerClassName?: string
}

export function PasswordInput({
  className = "",
  containerClassName = "",
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const toggleLabel = visible ? "비밀번호 숨기기" : "비밀번호 보기"

  return (
    <div className={["relative", containerClassName].filter(Boolean).join(" ")}>
      <input
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={[className, "pr-10"].filter(Boolean).join(" ")}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 disabled:pointer-events-none disabled:opacity-40"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
