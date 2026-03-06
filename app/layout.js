export const metadata = {
  title: 'FF Expo',
  description: 'FastForward Expo Lead Capture',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FF Expo" />
        <meta name="theme-color" content="#0a0c1e" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="https://fastfwdus.com/wp-content/uploads/2025/03/fastforward-logo.png.png" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{margin:0,padding:0,background:'#0a0c1e',overflow:'hidden'}}>
        {children}
      </body>
    </html>
  )
}
