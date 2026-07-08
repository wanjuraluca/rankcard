import LegalLayout from "../components/LegalLayout"

export const metadata = { title: "Terms of Service · RankCard" }

export default function Agb() {
    return (
        <LegalLayout title="Terms of Service">
            <section>
                <h2>1. Scope</h2>
                <p>
                    These terms apply to the use of RankCard ("the service"), operated by Luca Wanjura,
                    Uranusweg 18, 45770 Marl, Germany. By registering, you agree to these terms.
                </p>
            </section>

            <section>
                <h2>2. Service description</h2>
                <p>
                    RankCard lets you connect accounts from League of Legends, Valorant, and CS2 and
                    display them on a public profile. The rank and match data shown comes from third-party
                    providers (Riot Games, Henrik Dev API, Leetify, Steam) and is provided without any
                    guarantee of accuracy, completeness, or timeliness.
                </p>
            </section>

            <section>
                <h2>3. Registration & user account</h2>
                <p>
                    Using the service requires an account with a valid email address. You're responsible
                    for keeping your login credentials confidential and for the security of your account.
                </p>
            </section>

            <section>
                <h2>4. Connecting game accounts</h2>
                <p>
                    You may only connect game accounts that belong to you or that you're authorized to use.
                    RankCard currently doesn't perform technical ownership verification of connected
                    accounts. We reserve the right to suspend or delete profiles without prior notice if
                    we have reasonable grounds to suspect misuse.
                </p>
            </section>

            <section>
                <h2>5. Free to use</h2>
                <p>
                    RankCard is currently free to use. Should paid features be introduced in the future,
                    you'll be informed transparently about scope and price before any payment is taken, and
                    these terms will be updated accordingly.
                </p>
            </section>

            <section>
                <h2>6. Availability</h2>
                <p>
                    We aim for stable operation but can't guarantee uninterrupted availability, particularly
                    since some features depend on the availability of external APIs (e.g. Riot Games).
                </p>
            </section>

            <section>
                <h2>7. Termination & deletion</h2>
                <p>
                    You can delete your account yourself at any time from your account settings. We reserve
                    the right to suspend or delete accounts that violate these terms.
                </p>
            </section>

            <section>
                <h2>8. Liability</h2>
                <p>
                    We are liable without limitation for intent and gross negligence, as well as under
                    applicable product liability law. For slight negligence, we are only liable for breach
                    of material contractual obligations, and limited to foreseeable, contract-typical
                    damages.
                </p>
            </section>

            <section>
                <h2>9. Changes to these terms</h2>
                <p>
                    We may update these terms going forward, for example when new features are introduced.
                    We'll notify you by email of any material changes.
                </p>
            </section>

            <section>
                <h2>10. Final provisions</h2>
                <p>
                    German law applies. Should any provision of these terms be invalid, the validity of the
                    remaining provisions is unaffected.
                </p>
            </section>
        </LegalLayout>
    )
}
