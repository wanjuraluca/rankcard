import * as simpleIcons from 'simple-icons'

export const platformConfig = {
    'League of Legends': {
        name: 'League of Legends',
        shortName: 'LoL',
        icon: simpleIcons.siLeagueoflegends,
        color: '#C8AA6E',
        inputType: 'riot'
    },

    Valorant: {
        name: 'Valorant',
        shortName: 'Valorant',
        icon: simpleIcons.siValorant,
        color: '#ff4655',
        inputType: 'riot'
    },

    CSGO: {
        name: 'Counter-Strike 2',
        shortName: 'CS2',
        icon: simpleIcons.siCounterstrike,
        color: '#4b9fff',
        inputType: 'steam'
    },

    TFT: {
        name: 'Teamfight Tactics',
        shortName: 'TFT',
        icon: null,
        imageUrl: '/Icons/tft.png',
        color: '#ef8c00',
        inputType: 'riot'
    },

    Overwatch: {
        name: 'Overwatch',
        shortName: 'OW',
        icon: null,
        imageUrl: '/Icons/owLogo.png',
        color: '#4a4c4e',
        // Same BattleTag (name#tag) input shape as League/Valorant/TFT — the "#"
        // just gets swapped for a "-" when calling OverFast, see app/api/summoner.
        inputType: 'riot'
    },
}