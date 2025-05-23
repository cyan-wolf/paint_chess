import { ID } from "../utils.ts";
import * as utils from "../utils.ts";
import { Board } from "./board.ts";
import { ChatColorInfo, ColorConfig, GameEndDelegate, GameEndResult, GameViewForClient, Message, MetaGameInfo, MiscGameEventDelegate, RawMove, TimeInfo, UserDataRundown } from "./types/game_types.d.ts";

export class Game {
    meta: MetaGameInfo
    board: Board
    colorConfig: ColorConfig

    completedTurns: number

    messageHistory: Message[]
    timeInfo: TimeInfo
    // Used to cancel the timer started by this game.
    intervalTimerCancelID: number

    startingTimeoutCancelID?: number

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
                        winner: boardEvent.by,
                    });
                    break;
            }
        });
    }

    id(): ID {
        return this.meta.gameId;
    }

    joinPlayer(): void {
        this.meta.joinedPlayers++;
    }

    getJoinedPlayerAmt(): number {
        return this.meta.joinedPlayers;
    }

    hasUser(username: string): boolean {
        return username === this.meta.p1.username || 
            username === this.meta.p2.username;
    }

    /**
     * Returns the usernames of the users in the game.
     */
    getUsernames(): string[] {
        return [this.meta.p1.username, this.meta.p2.username];
    }

    roleToUsername(role: PlayerRole): string {
        const users = this.getUsernames();

        if (role === "p1") {
            return users[0];
        } else {
            return users[1];
        }
    }

    usernameToRole(username: string): PlayerRole {
        if (username === this.meta.p1.username) {
            return "p1";
        } else if (username === this.meta.p2.username) {
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

        this.startingTimeoutCancelID = this.setupStartingTimeout();
    }

    asClientView(username: string): GameViewForClient {
        const ownRole = this.usernameToRole(username);
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

        const userDataRundown: UserDataRundown = {};
        userDataRundown[this.roleToUsername("p1")] = this.meta.p1;
        userDataRundown[this.roleToUsername("p2")] = this.meta.p2;

        const chatColorInfo: ChatColorInfo = {};
        chatColorInfo[this.roleToUsername("p1")] = this.colorConfig["p1"].bgLight;
        chatColorInfo[this.roleToUsername("p2")] = this.colorConfig["p2"].bgLight;

        const data = {
            gameInfo: {
                gameId: this.meta.gameId,
                p1: {
                    username: this.roleToUsername("p1"),
                    color: this.colorConfig["p1"].piece,
                },
                p2: {
                    username: this.roleToUsername("p2"),
                    color: this.colorConfig["p2"].piece,
                },
                turn: {
                    username: this.roleToUsername(this.board.turn),
                    color: this.colorConfig[this.board.turn].piece,
                },
            },
            boardConfig: {
                isFlipped,
                colorConfig: this.colorConfig,
            },
            boardDesc: this.board.toBoardDesc(),
            timeDesc,
            userDataRundown,
            chatColorInfo,
            checkStatus: structuredClone(this.board.checkStatus),
            lastChangedCoords: Array.from(this.board.lastChangedCoords),
            legalMovesRundown: structuredClone(this.board.legalMovesRundown),
            turn: this.board.turn,
            ownRole,
        };
        return data;
    }

    // Determines whether the given username is 
    // player 1 or player 2.
    getUserPlayerRole(username: string) {
        const users = this.getUsernames();

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

        // Check that the properties are strings.
        if (typeof(from) !== 'string' || typeof(to) !== 'string') {
            return false;
        }
        // Check that the promotion promotion property is either a string or undefined.
        if (typeof(promotion) !== 'string' && typeof(promotion) !== 'undefined') {
            return false;
        }
        // Check that the `from` and `to` are chess coordinates.
        if (! isValidChessCoord(from) || ! isValidChessCoord(to)) {
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

            this.updateStartingTimeout();
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

    setupStartingTimeout(): number {
        const startingTimeOutMillis = 60 * 1000; // 1 minute

        return setTimeout(() => {
            this.finish({
                method: "timeout",
                winner: null,
            });          
        }, startingTimeOutMillis);
    }

    updateStartingTimeout() {
        if (this.startingTimeoutCancelID === undefined) {
            return;
        }
        clearTimeout(this.startingTimeoutCancelID);
        this.startingTimeoutCancelID = undefined;

        if (this.completedTurns < 2) {
            this.startingTimeoutCancelID = this.setupStartingTimeout();
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

function isValidChessCoord(coordString: string): boolean {
    if (coordString.length !== 2) {
        return false;
    }
    const [rank, file] = coordString;

    if (rank < 'a' || rank > 'h') {
        return false;
    }
    if (file < '1' || file > '8') {
        return false;
    }
    return true;
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
    return utils.choose(configs)!;
}
