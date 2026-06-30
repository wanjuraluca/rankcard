const SITE_URL = "https://rankcard.app"

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth", "/auth/callback", "/reset-password", "/compare"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
