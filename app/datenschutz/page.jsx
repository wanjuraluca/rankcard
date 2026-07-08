import LegalLayout from "../components/LegalLayout"

export const metadata = { title: "Privacy Policy · RankCard" }

export default function Datenschutz() {
    return (
        <LegalLayout title="Privacy Policy">
            <section>
                <h2>1. Data controller</h2>
                <p>
                    Luca Wanjura<br />
                    Uranusweg 18<br />
                    45770 Marl, Germany<br />
                    Email: <a href="mailto:info@rankcard.app">info@rankcard.app</a>
                </p>
            </section>

            <section>
                <h2>2. Overview</h2>
                <p>
                    RankCard connects your League of Legends, Valorant, and CS2 accounts into one public
                    profile. We only store what's necessary for that: your login data, your profile name,
                    and the game accounts you choose to connect. We don't sell your data to third parties
                    and we don't run ads.
                </p>
            </section>

            <section>
                <h2>3. Registration & user account</h2>
                <p>
                    When you register, we process your email address, your (hashed) password, and your
                    chosen username. You can optionally add a profile picture and a short bio. The legal
                    basis is Art. 6(1)(b) GDPR (performance of the user contract). This data is stored with{" "}
                    <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>, our
                    database and authentication provider. This may involve a transfer of data to the USA,
                    safeguarded through the European Commission's Standard Contractual Clauses.
                </p>
            </section>

            <section>
                <h2>4. Connected game accounts</h2>
                <p>
                    When you connect League of Legends, Valorant, or CS2 to your profile, we store the
                    in-game name (or SteamID) you provide. We use this to fetch publicly available rank and
                    match data through the respective official or community APIs (Riot Games API, Henrik
                    Dev API, Leetify, Steam Web API). We never store passwords or login credentials for
                    your game accounts. Connecting an account only relies on publicly visible profile
                    data.
                </p>
            </section>

            <section>
                <h2>5. Hosting</h2>
                <p>
                    This website is hosted by <a href="https://vercel.com" target="_blank" rel="noreferrer">Vercel
                    Inc.</a> When you visit the site, Vercel automatically processes technical connection
                    data (e.g. IP address, time of request), as is technically necessary for any web
                    hosting. The legal basis is Art. 6(1)(f) GDPR (legitimate interest in operating the
                    website securely and reliably).
                </p>
            </section>

            <section>
                <h2>6. Web analytics</h2>
                <p>
                    We use <a href="https://vercel.com/analytics" target="_blank" rel="noreferrer">Vercel
                    Web Analytics</a> for anonymized, cookieless analysis of page views. No personal
                    profiles are created and no cookies are set. The legal basis is Art. 6(1)(f) GDPR.
                </p>
            </section>

            <section>
                <h2>7. Email delivery</h2>
                <p>
                    Transactional emails (e.g. confirmation links, password resets) are sent through{" "}
                    <a href="https://resend.com" target="_blank" rel="noreferrer">Resend</a>. This involves
                    processing your email address and the respective email content. The legal basis is Art.
                    6(1)(b) GDPR.
                </p>
            </section>

            <section>
                <h2>8. Local storage (no tracking cookies)</h2>
                <p>
                    To keep you signed in, your browser stores a technically necessary session token in
                    local storage (not a classic cookie). This is strictly required for the login to
                    function (Art. 6(1)(b) GDPR) and doesn't require separate consent under § 25(2) TTDSG.
                    We don't use marketing or tracking cookies.
                </p>
            </section>

            <section>
                <h2>9. Retention & deletion</h2>
                <p>
                    We store your data for as long as your account exists. You can delete your account and
                    all associated data yourself, at any time, from your account settings (the account menu on your
                    profile → "Delete account"). This permanently removes your profile, all connected game
                    accounts, and your login.
                </p>
            </section>

            <section>
                <h2>10. Your rights</h2>
                <p>You have the right at any time to:</p>
                <ul>
                    <li>Request access to the data we hold about you (Art. 15 GDPR)</li>
                    <li>Correct inaccurate data (Art. 16 GDPR)</li>
                    <li>Request deletion of your data (Art. 17 GDPR)</li>
                    <li>Request restriction of processing (Art. 18 GDPR)</li>
                    <li>Request data portability (Art. 20 GDPR)</li>
                    <li>Object to processing (Art. 21 GDPR)</li>
                </ul>
                <p>
                    Just reach out to <a href="mailto:info@rankcard.app">info@rankcard.app</a>. You also
                    have the right to lodge a complaint with a data protection supervisory authority.
                </p>
            </section>

            <section>
                <h2>11. Contact</h2>
                <p>
                    Questions about privacy? Email us at{" "}
                    <a href="mailto:info@rankcard.app">info@rankcard.app</a>.
                </p>
            </section>
        </LegalLayout>
    )
}
