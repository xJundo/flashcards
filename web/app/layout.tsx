import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Flashcards coréen",
  description: "Révise le vocabulaire de tes cours de coréen.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body className="min-h-svh bg-background">
        <ThemeProvider>
          <TooltipProvider>
            <Toaster>
              <SiteHeader />
              <main className="mx-auto w-full max-w-5xl px-4 py-8">
                {children}
              </main>
            </Toaster>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
