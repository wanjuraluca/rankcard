import LegalLayout from "../components/LegalLayout"

export const metadata = { title: "Legal Notice · RankCard" }

export default function Impressum() {
    return (
        <LegalLayout title="Legal Notice">
            <section>
                <h2>Information according to § 5 DDG (German Digital Services Act)</h2>
                <p>
                    Luca Wanjura<br />
                    Uranusweg 18<br />
                    45770 Marl<br />
                    Germany
                </p>
            </section>

            <section>
                <h2>Contact</h2>
                <p>
                    Email: <a href="mailto:info@rankcard.app">info@rankcard.app</a>
                </p>
            </section>

            <section>
                <h2>Responsible for content according to § 18 Abs. 2 MStV</h2>
                <p>
                    Luca Wanjura<br />
                    Uranusweg 18<br />
                    45770 Marl
                </p>
            </section>

            <section>
                <h2>Liability for content</h2>
                <p>
                    As a service provider, we are responsible for our own content on these pages under
                    general law. However, we are not obligated to monitor transmitted or stored third-party
                    information or to investigate circumstances that indicate illegal activity.
                </p>
            </section>

            <section>
                <h2>Liability for links</h2>
                <p>
                    Our service contains links to external third-party websites (e.g. Riot Games, Leetify,
                    Steam) over whose content we have no influence. The respective provider is always
                    responsible for the content of linked pages.
                </p>
            </section>

            <section>
                <h2>Trademark notice</h2>
                <p>
                    RankCard isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot
                    Games or anyone officially involved in producing or managing Riot Games properties. Riot
                    Games and all associated properties are trademarks or registered trademarks of Riot
                    Games, Inc. VALORANT, Counter-Strike 2, and Steam are likewise trademarks of their
                    respective owners. RankCard has no affiliation with these companies.
                </p>
            </section>
        </LegalLayout>
    )
}
