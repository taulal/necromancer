import type {ReactNode} from 'react'

export const metadata = {title: 'Vessel', description: 'Resurrected by Necromancer'}

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
