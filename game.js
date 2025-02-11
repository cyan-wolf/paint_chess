import { Board, genInitialChessBoardDesc } from "./board.js";

export class Game {
    constructor(meta) {
        this.meta = meta;
        this.board = new Board();
    }

    id() {
        return this.meta.gameId;
    }

    joinPlayer() {
        this.meta.joinedPlayers++;
    }

    getJoinedPlayerAmt() {
        return this.meta.joinedPlayers;
    }

    hasUser(username) {
        return username === this.meta.p1 || username === this.meta.p2;
    }

    getUsers() {
        return [this.meta.p1, this.meta.p2];
    }

    setup() {
        // Choose a random color scheme.
        this.colorConfig = genRandomColorConfig();
    }

    asClientView(username) {
        let isFlipped;

        if (username === this.meta.p1) {
            isFlipped = false;
        }
        else {
            isFlipped = true;
        }

        const data = {
            gameId: this.meta.gameId,
            boardConfig: {
                isFlipped,
                colorConfig: this.colorConfig,
            },
            boardDesc: genInitialChessBoardDesc(),
        };

        return data;
    }
}

function genRandomColorConfig() {
    const configs = [
        // Red and blue.
        {
            p1: {
                piece: "red",
                bgLight: "#ffa99c",
                bgDark: "#61241f",
            },
            p2: {
                piece: "blue",
                bgLight: "#9ca4ff",
                bgDark: "#1f1f61",
            },
        },
        // Lime and purple.
        {
            p1: {
                piece: "#43eb34",
                bgLight: "#9cffa6",
                bgDark: "#1f6126",
            },
            p2: {
                piece: "#c634eb",
                bgLight: "#e09cff",
                bgDark: "#4a1f61",
            },
        },
        // Orange and cyan.
        {
            p1: {
                piece: "#ffaa00",
                bgLight: "#fff29c",
                bgDark: "#61481f",
            },
            p2: {
                piece: "#00fff2",
                bgLight: "#bffaff",
                bgDark: "#1f5b61",
            },
        },
        // Mint green and pink.
        {
            p1: {
                piece: "#03fc98",
                bgLight: "#9cffde",
                bgDark: "#1f6152",
            },
            p2: {
                piece: "#fc039d",
                bgLight: "#ff9cf5",
                bgDark: "#611f5a",
            },
        },
    ];

    // Pick a random config.
    return configs[Math.floor(Math.random() * configs.length)];
}
