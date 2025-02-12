import { Board } from "./board.ts";



export class Game {
    meta: MetaGameInfo
    board: Board
    colorConfig: ColorConfig

    constructor(meta: MetaGameInfo) {
        this.meta = meta;
        this.board = new Board();
        this.colorConfig = genRandomColorConfig();
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

    hasUser(username: string) {
        return username === this.meta.p1 || username === this.meta.p2;
    }

    getUsers() {
        return [this.meta.p1, this.meta.p2];
    }

    setup() {
        // TODO: Choose a random color scheme.
        // ...
    }

    asClientView(username: string): GameViewForClient {
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
            boardDesc: this.board.toBoardDesc(),
        };

        return data;
    }

    // Determines whether the given username is 
    // player 1 or player 2.
    getUserPlayerRole(username: string) {
        const users = this.getUsers();

        if (username === users[0]) {
            return "p1";
        } else if (username === users[1]) {
            return "p2";
        } else {
            return "unknown";
        }
    }

    // Processes a move from the user.
    processMove(rawMove: RawMove) {
        const { from, to, username } = rawMove;

        // TODO: Add more validation.
        if (from === undefined || to === undefined || username === undefined ) {
            return { couldMove: false };
        }

        const role = this.getUserPlayerRole(username);
        if (role === "unknown") {
            return { couldMove: false };
        }

        const move: Move = { from, to, player: role };
        return this.board.processMove(move);
    }
}

function genRandomColorConfig(): ColorConfig {
    const configs: ColorConfig[] = [
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
