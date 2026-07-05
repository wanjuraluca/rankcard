import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Only re-alert for an ongoing outage once per hour, so a flood of failed
// requests during a real outage doesn't spam Discord/email on every hit.
const ALERT_COOLDOWN_MS = 60 * 60 * 1000

async function sendDiscordAlert(message) {
  const url = process.env.DISCORD_STATUS_WEBHOOK_URL
  if (!url) return
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    })
  } catch (err) {
    console.error("Failed to send Discord status alert:", err)
  }
}

async function sendEmailAlert(subject, text) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL_TO
  if (!apiKey || !to) return
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RankCard Status <noreply@rankcard.app>",
        to: [to],
        subject,
        text,
      }),
    })
  } catch (err) {
    console.error("Failed to send email status alert:", err)
  }
}

// Call from a catch block or a 5xx/timeout response when an external
// dependency (e.g. OverFast) fails. No-ops (besides the DB write) if this
// service is already known to be down and was already alerted recently.
export async function markServiceDown(service, errorDetail) {
  const { data: existing } = await supabaseAdmin
    .from("service_status")
    .select("status, last_alert_at")
    .eq("service", service)
    .maybeSingle()

  const now = new Date()
  const shouldAlert =
    existing?.status !== "down" ||
    !existing.last_alert_at ||
    now - new Date(existing.last_alert_at) > ALERT_COOLDOWN_MS

  await supabaseAdmin.from("service_status").upsert({
    service,
    status: "down",
    last_failure_at: now.toISOString(),
    last_error: errorDetail ?? null,
    ...(shouldAlert ? { last_alert_at: now.toISOString() } : {}),
  })

  if (shouldAlert) {
    const message = `🔴 **${service}** is down: ${errorDetail ?? "unknown error"}`
    await Promise.all([
      sendDiscordAlert(message),
      sendEmailAlert(`RankCard: ${service} is down`, message),
    ])
  }
}

// Call on a successful response. Sends a one-time "recovered" alert if the
// service was previously marked down.
export async function markServiceUp(service) {
  const { data: existing } = await supabaseAdmin
    .from("service_status")
    .select("status")
    .eq("service", service)
    .maybeSingle()

  await supabaseAdmin.from("service_status").upsert({
    service,
    status: "up",
    last_success_at: new Date().toISOString(),
  })

  if (existing?.status === "down") {
    const message = `🟢 **${service}** is back up.`
    await Promise.all([
      sendDiscordAlert(message),
      sendEmailAlert(`RankCard: ${service} recovered`, message),
    ])
  }
}
