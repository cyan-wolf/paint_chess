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
        // TODO: choose a random color scheme
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
                colorConfig: {
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
            },
            boardDesc: genInitialChessBoardDesc(),
        };

        return data;
    }
}


