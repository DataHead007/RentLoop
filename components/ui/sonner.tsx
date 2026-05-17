"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-center"
      closeButton
      richColors
      offset={{ bottom: "1rem" }}
      mobileOffset={{
        bottom: "max(1rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))",
      }}
      toastOptions={{
        classNames: {
          toast:
            "border border-border/60 bg-background text-foreground shadow-lg touch-manipulation",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  )
}

