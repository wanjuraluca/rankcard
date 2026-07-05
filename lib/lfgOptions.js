// Shared between app/find/page.jsx (filters) and LfgPostModal.jsx (post
// creation) so the two never drift apart on what queues/roles a game
// actually has — they used to be defined separately and disagreed (e.g.
// League's Duo Queue/Flex/Clash showing up as options for Overwatch, which
// has no such queues).

// "Looking for" = queue/mode options, game-specific since queue names don't
// carry across games (League's Flex/Clash, Riot Overwatch's Role/Open Queue,
// Marvel Rivals' Ranked/Quick Play are all different concepts).
export const lookingForOptionsByGame = {
    "League of Legends": ["Duo Queue", "Flex", "Clash", "Chill", "Smurf welcome"],
    Valorant: ["Duo Queue", "Chill", "Smurf welcome"],
    TFT: ["Double Up", "Chill", "Smurf welcome"],
    CSGO: ["Duo Queue", "Chill", "Smurf welcome"],
    Overwatch: ["Role Queue", "Open Queue", "Quick Play", "Chill", "Smurf welcome"],
    "Marvel Rivals": ["Ranked", "Quick Play", "Chill", "Smurf welcome"],
}

// Generic fallback for when no game is selected yet (e.g. the Find a Duo
// filter row before a game chip is picked) — only the queue-agnostic tags
// make sense without game context.
export const GENERIC_LOOKING_FOR_OPTIONS = ["Chill", "Smurf welcome"]

// Role options are game-specific — League has lane roles, Valorant has agent
// classes, Overwatch/Marvel Rivals have hero-class roles, TFT/CS2 have no
// role concept and skip this section entirely.
export const roleOptionsByGame = {
    "League of Legends": ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"],
    Valorant: ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"],
    Overwatch: ["Tank", "Damage", "Support", "Flex"],
    "Marvel Rivals": ["Vanguard", "Duelist", "Strategist", "Flex"],
}
