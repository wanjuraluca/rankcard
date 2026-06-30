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
        icon: {
            path: "M12,0.5 L22,6 L22,17 L12,23.5 L2,17 L2,6 Z M12,2.5 L20,7 L20,16.5 L12,21.5 L4,16.5 L4,7 Z M4,8 H20 V11.5 H14.5 V20 H9.5 V11.5 H4 Z",
            fillRule: "evenodd",
        },
        color: '#ef8c00',
        inputType: 'riot'
    },
}