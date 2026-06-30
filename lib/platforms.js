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
        imageUrl: '/icons/tft.png',
        color: '#ef8c00',
        inputType: 'riot'
    },
}