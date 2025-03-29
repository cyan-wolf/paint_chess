import { Board } from "./board.ts";

export class Game {
    meta: MetaGameInfo
    board: Board
    colorConfig: ColorConfig

    completedTurns: number

    messageHistory: Message[]
    timeInfo: TimeInfo
    // Used to cancel the timer started by this game.
    intervalTimerCancelID: number

    onGameEndDelegates: GameEndDelegate[]
    hasEnded: boolean

    onMiscGameEventDelegates: MiscGameEventDelegate[]

    constructor(meta: MetaGameInfo) {
        this.meta = meta;
        this.board = new Board();

        this.colorConfig = genRandomColorConfig();

        this.completedTurns = 0;

        this.messageHistory = [];

        this.timeInfo = {
            p1: {
                millisLeft: this.meta.secsPerPlayer * 1000,
                lastTimestamp: null,
            },
            p2: {
                millisLeft: this.meta.secsPerPlayer * 1000,
                lastTimestamp: null,
            },
        };

        this.intervalTimerCancelID = this.setupCountdownTimer();

        this.onGameEndDelegates = [];
        this.hasEnded = false;

        this.onMiscGameEventDelegates = [];

        // Wire events emitted from the board to the game.
        this.wireBoardEvents();
    }

    // Connects board events (such as when checkmate or stalemate happen) to the game.
    wireBoardEvents() {
        this.board.addBoardEventListener((boardEvent) => {
            switch (boardEvent.kind) {
                case "stalemate":
                    this.finish({
                        method: "stalemate",
                        winner: null,
                    });
                    break;
                case "checkmate":
                    this.finish({
                        method: "checkmate",
                        winner: boardEvent.by
                    });
                    break;
            }
        });
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

    roleToUser(role: PlayerRole): string {
        const users = this.getUsers();

        if (role === "p1") {
            return users[0];
        } else {
            return users[1];
        }
    }

    userToRole(username: string): PlayerRole {
        if (username === this.meta.p1) {
            return "p1";
        } else if (username === this.meta.p2) {
            return "p2";
        } else {
            throw Error("unknown user");
        }
    }

    hasStarted() {
        return this.meta.hasStarted;
    }

    start() {
        this.meta.hasStarted = true;
    }

    asClientView(username: string): GameViewForClient {
        const ownRole = this.userToRole(username);
        const opponentRole = Game.togglePlayerRole(ownRole);
        const isFlipped = ownRole !== "p1";

        const timeDesc = {
            "own": {
                secsLeft: this.timeInfo[ownRole].millisLeft / 1000,
                isTicking: this.completedTurns > 1 && this.board.turn === ownRole,
            },
            "opponent": {
                secsLeft: this.timeInfo[opponentRole].millisLeft / 1000,
                isTicking: this.completedTurns > 1 && this.board.turn === opponentRole,
            },
        };

        const data = {
            gameInfo: {
                gameId: this.meta.gameId,
                p1: {
                    username: this.roleToUser("p1"),
                    color: this.colorConfig["p1"].piece,
                },
                p2: {
                    username: this.roleToUser("p2"),
                    color: this.colorConfig["p2"].piece,
                },
                turn: {
                    username: this.roleToUser(this.board.turn),
                    color: this.colorConfig[this.board.turn].piece,
                },
            },
            boardConfig: {
                isFlipped,
                colorConfig: this.colorConfig,
            },
            boardDesc: this.board.toBoardDesc(),
            timeDesc,
            checkStatus: structuredClone(this.board.checkStatus),
            lastChangedCoords: Array.from(this.board.lastChangedCoords),
            legalMovesRundown: structuredClone(this.board.legalMovesRundown),
            ownRole,
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

    checkPawnPromotionField(promotion: string | undefined): promotion is PromotionPiece | undefined {
        if (promotion !== undefined) {
            const validPieces: Set<PromotionPiece> = new Set(["queen", "rook", "bishop", "knight"]);

            if (!validPieces.has(promotion as PromotionPiece)) {
                return false;
            }
        }
        return true;
    }

    // Processes a move from the user.
    processMove(rawMove: RawMove): boolean {
        if (this.hasEnded) {
            return false;
        }

        const { from, to, username, promotion } = rawMove;

        // TODO: Add more validation.
        if (from === undefined || to === undefined || username === undefined ) {
            return false;
        }

        // Check pawn promotion data.
        if (!this.checkPawnPromotionField(promotion)) {
            return false;
        }

        const role = this.getUserPlayerRole(username);
        if (role === "unknown") {
            return false;
        }

        const move: Move = { from, to, player: role, promotion };

        const couldMove = this.board.processMove(move);

        if (couldMove) {
            this.completedTurns++;
            this.toggleTimerCountdown();
        }

        return couldMove;
    }

    publishMessage(message: Message): void {
        this.messageHistory.push(message);
    }

    getMessageHistory(amount: number): Message[] {
        if (amount < 0) {
            return [];
        }

        if (this.messageHistory.length >= amount) {
            return structuredClone(this.messageHistory);
        }

        return this.messageHistory.slice(-amount);
    }

    // Sets up up a timer that asynchronously removes time 
    // from players during their turn.
    // Returns an ID that can be used to cancel the timer 
    // using the `clearInterval` global function.
    setupCountdownTimer(): number {
        const cancelID = setInterval(() => {
            for (const player of Object.keys(this.timeInfo)) {
                const timeInfo = this.timeInfo[player as PlayerRole];

                if (timeInfo.lastTimestamp !== null) {
                    const elapsedMillis = performance.now() - timeInfo.lastTimestamp;
                    timeInfo.lastTimestamp = performance.now();
                    timeInfo.millisLeft = Math.max(timeInfo.millisLeft - elapsedMillis, 0);

                    if (timeInfo.millisLeft === 0.0) {
                        this.finish({
                            winner: Game.togglePlayerRole(player as PlayerRole),
                            method: "timeout",
                        });
                    }
                }
            }
        }, 500);
        return cancelID;
    }

    // Used for switching which player's time experiences
    // a countdown after a move.
    toggleTimerCountdown() {
        // Toggle the current board turn, since that would've been 
        // the last player's role.
        const currentPlayer = this.board.turn;
        const lastMovedPlayer = Game.togglePlayerRole(this.board.turn);

        // Detects whether the last move was the first move in the game.
        // This needs to be checked since the timer rules work differently 
        // after the first move.
        if (this.completedTurns > 1) {
            // Switches the user that the timer counts down.
            this.timeInfo[currentPlayer].lastTimestamp = performance.now();
            this.timeInfo[lastMovedPlayer].lastTimestamp = null;
        }
    }

    // Ends the current game.
    finish(result: GameEndResult) {
        if (this.hasEnded) {
            return;
        }

        // Clears the interval used for the countdown timer.
        clearInterval(this.intervalTimerCancelID);
        this.hasEnded = true;
        
        for (const onGameEnd of this.onGameEndDelegates) {
            onGameEnd(result);
        }
    } 

    // Calls the supplied callback when the game ends.
    addOnGameEndEventHandler(onGameEnd: GameEndDelegate): void {
        this.onGameEndDelegates.push(onGameEnd);
    }

    static togglePlayerRole(role: PlayerRole): PlayerRole {
        return (role === "p1") ? "p2" : "p1";
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


