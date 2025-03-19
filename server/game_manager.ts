import { Server } from "npm:socket.io@4.8.1";
import { Game } from "./game.ts";

import { fetchUserData } from "./data_access.ts";

type ID = string;

type RawGameSettings = {
    secsPerPlayer?: number,
};

type GameSettings = {
    secsPerPlayer: number,
};

// Placeholder way of storing game data.
type GameQueue = {
    [gameId: ID]: {
        waitingPlayers: string[],
        gameSettings: GameSettings,
    }
};

type PlayerInfo = {
    gameId?: ID,
    joined: boolean,
    active: boolean,
    queueing: boolean,
};

type PlayerRegistry = {
    [username: string]: PlayerInfo,
};

type ActiveGames = {
    [gameId: ID]: Game
};

export class GameManager {
    queuedGamesDb: GameQueue;
    activeGamesDb: ActiveGames;
    playerRegistry: PlayerRegistry

    readonly io: Server

    constructor(io: Server) {
        this.queuedGamesDb = {};
        this.activeGamesDb = {};
        this.playerRegistry = {};

        this.io = io;
    }

    // Placeholder ID generator.
    genId(): ID {
        return Math.random().toString().substring(2);
    }

    // Make sure that the game settings are valid.
    validateGameSettings(gameSettings?: RawGameSettings): gameSettings is GameSettings {
        if (gameSettings === undefined) {
            return false;
        }
        if (gameSettings.secsPerPlayer === undefined) {
            return false;
        }
        if (typeof(gameSettings.secsPerPlayer) !== 'number') {
            return false;
        }
        // Only accept times between 1 and 90 minutes.
        if (gameSettings.secsPerPlayer < 1 * 60 || gameSettings.secsPerPlayer > 90 * 60) {
            return false;
        }
        return true;
    }

    // Determines whether the given game ID is being queued.
    gameIdIsQueued(gameId: ID): boolean {
        return Object.hasOwn(this.queuedGamesDb, gameId);
    }

    // Determines whether the given game ID is being used by an active game.
    gameIdIsActive(gameId: ID): boolean {
        return Object.hasOwn(this.activeGamesDb, gameId);
    }

    // Determines whether the given player is already in queue.
    usernameIsQueueingGame(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username) && 
            this.playerRegistry[username].queueing;
    }

    // Determines whether the given user is in an active game.
    usernameIsActive(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username) && 
            this.playerRegistry[username].active;
    }

    // Determines whether the given username is in the game 
    // with the given ID.
    usernameInGame(username: string, gameId: ID): boolean {
        return this.gameIdIsActive(gameId) && 
            this.activeGamesDb[gameId].hasUser(username);
    }

    usernameInRegistry(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username);
    }

    // Saves a player to the registry if it wasn't in it already.
    saveUsernameToRegistry(username: string) {
        if (!this.usernameInRegistry(username)) {
            this.playerRegistry[username] = {
                joined: false,
                active: false,
                queueing: false,
            };
        }
    }

    // Gets a player from the registry.
    getPlayer(username: string): PlayerInfo {
        if (!this.usernameInRegistry(username)) {
            throw new Error(`invalid player ${username}`);
            
        }
        return this.playerRegistry[username];
    }

    // Creates a new queued game.
    createQueuedGame(gameSettings: GameSettings): ID {
        const gameId = this.genId();

        this.queuedGamesDb[gameId] = {
            waitingPlayers: [],
            gameSettings,
        };
        return gameId;
    }

    // Joins a player to the given game.
    tryJoinPlayerToQueuedGame(username: string, gameId: ID) {
        if (!this.gameIdIsQueued(gameId)) {
            return; // ignore attempt if game ID is invalid
        }
        
        if (this.usernameIsQueueingGame(username)) {
            return; // avoid users that are already queueing
        }

        const queuedGame = this.queuedGamesDb[gameId];

        // Mark the current player as queueing the game.
        const playerInfo = this.playerRegistry[username];
        playerInfo.gameId = gameId;
        playerInfo.queueing = true;

        queuedGame.waitingPlayers.push(username);
        
        if (queuedGame.waitingPlayers.length == 2) {
            this.createGame(gameId);
        }
    }

    // Calculates the probability of a `rating2` rated player winning 
    // over a `rating1` rated player.
    calcWinningProbability(rating1: number, rating2: number): number {
        return 1.0 / (1 + Math.pow(10, (rating2 - rating1) / 400.0));
    }

    // Determines new ELO ratings.
    determineELORatings(ratingP1: number, ratingP2: number, k: number, outcomeValue: number): [number, number] {
        const winningProbabilityP1 = this.calcWinningProbability(ratingP2, ratingP1);
        const winningProbabilityP2 = this.calcWinningProbability(ratingP1, ratingP2);

        const updatedRatingP1 = ratingP1 + k * (outcomeValue - winningProbabilityP1);
        const updatedRatingP2 = ratingP2 + k * ((1 - outcomeValue) - winningProbabilityP2);

        return [updatedRatingP1, updatedRatingP2];
    }

    // Determines the associated outcome value based on the game's end result.
    // Used for calculating ELO.
    getOutcomeValue(gameResult: GameEndResult): number {
        if (gameResult.winner === null) {
            return 0.5; // no winner
        }
        else if (gameResult.winner === "p1") {
            return 1;
        }
        else if (gameResult.winner === "p2") {
            return 0;
        }
        else {
            // Unreachable.
            throw new Error("Unknown game outcome.");
        }
    }

    // Gets the given user's ELO rating.
    async getUserELO(username: string): Promise<number | undefined> {
        const user = await fetchUserData(username);
        return user?.elo;
    }

    // Turns a queued game into an active game.
    createGame(gameId: ID) {
        if (!this.gameIdIsQueued(gameId)) {
            return; // prevent access to games that aren't being queued
        }

        const queuedGame = this.queuedGamesDb[gameId];

        // Remove game from queue.
        delete this.queuedGamesDb[gameId];

        // Unnecessary?
        // this.playerRegistry[usernameP1].joined = false;
        // this.playerRegistry[usernameP2].joined = false;

        for (const queuedUsername of queuedGame.waitingPlayers) {
            this.playerRegistry[queuedUsername].queueing = false;
            this.playerRegistry[queuedUsername].active = true;
        }

        const game = new Game({
            gameId,
            p1: queuedGame.waitingPlayers[0], 
            p2: queuedGame.waitingPlayers[1], 
            joinedPlayers: 0,
            secsPerPlayer: queuedGame.gameSettings.secsPerPlayer,
            hasStarted: false,
        });
        this.activeGamesDb[gameId] = game;

        game.addOnGameEndEventHandler((result) => {
            console.log(`LOG: game ended: ${JSON.stringify(result)}`);

            for (const usernameInGame of game.getUsers()) {
                const gameData = game.asClientView(usernameInGame);

                // Send the final state of the game to all players before ending the game.
                this.io.to(`user-${usernameInGame}`).emit("move-performed-response", gameData);

                // Ends the game on the client.
                this.io.to(`user-${usernameInGame}`).emit("game-ended", { result });

                // Tell the clients to play a "game-end" sound.
                this.io.to(`user-${usernameInGame}`).emit("play-sound", { sound: "game-end" });

                // TODO: Calculate the new ELO of each player.
                // ...

                // TODO: add a record of the results of the game to the database
                // ...

                // Reset the player's registry.
                const playerInfo = this.playerRegistry[usernameInGame];
                playerInfo.gameId = undefined;
                playerInfo.active = false;
                playerInfo.joined = false;
                playerInfo.queueing = false;
            }

            // Make the game no longer active.
            delete this.activeGamesDb[gameId];
        });

        // Redirects the user to "/game/:id" on the client.
        for (const usernameInGame of game.getUsers()) {
            this.io.to(`user-${usernameInGame}`).emit("found-game", { gameId });
        }
    }

    // Manages socket connections.
    connectSockets() {
        const io = this.io;
        const queuedGamesDb = this.queuedGamesDb;
        const activeGamesDb = this.activeGamesDb;

        // Setup sockets.
        io.on("connection", (socket) => {
            const session = socket.request.session;

            if (!session.user) {
                return; // ignore events from this socket
            }

            const username = session.user.username;
            // For sending events using only the username.
            socket.join(`user-${username}`);

            this.saveUsernameToRegistry(username);

            // When the user queues a new game.
            socket.on("queue-game", ({ gameSettings }) => {
                // Game settings must be valid.
                if (!this.validateGameSettings(gameSettings)) {
                    return;
                }
                const gameId = this.createQueuedGame(gameSettings);

                // Auto-join the user to the game.
                this.tryJoinPlayerToQueuedGame(username, gameId);

                io.emit("current-game-queue", queuedGamesDb);
            });

            socket.on("request-current-game-queue", () => {
                io.to(socket.id).emit("current-game-queue", queuedGamesDb);
            });

            socket.on("join-game-request", ({ gameId }) => {
                this.tryJoinPlayerToQueuedGame(username, gameId);
                
                io.emit("current-game-queue", queuedGamesDb);
            });

            socket.on("ready-to-start-game", () => {
                if (!this.usernameIsActive(username)) {
                    // Ignore socket if the player is not in a game.
                    return; 
                }
                const gameId = this.playerRegistry[username].gameId!;
                
                // Re-join the user to the socket game room, as 
                // the connection was reset when the page reloaded 
                // when getting to "/game/:id".
                socket.join(`user-${username}`);

                const game = activeGamesDb[gameId];

                // Player is joining for the first time.
                if (!this.playerRegistry[username].joined) {
                    // Increment the number of joined players.
                    game.joinPlayer();

                    this.playerRegistry[username].joined = true;
                } 
                // Player is rejoining the game.
                else if (game.getUsers().includes(username)) {
                    const gameData = game.asClientView(username);
                    io.to(`user-${username}`).emit("game-start", gameData);

                    // Exit event handler here to avoid the 
                    // other player from receiving the "game-start" event as well.
                    return;
                }

                // Officially start the game.
                if (game.getJoinedPlayerAmt() == 2 && !game.hasStarted()) {
                    // Sets up various parts of the game.
                    game.start();

                    for (const usernameInGame of game.getUsers()) {
                        const gameData = game.asClientView(usernameInGame);
                        io.to(`user-${usernameInGame}`).emit("game-start", gameData);
                    }
                }
            });

            socket.on("perform-move", (move) => {
                if (!this.usernameIsActive(username)) {
                    // Ignore socket if the player is not in a game.
                    return; 
                }
                const gameId = this.playerRegistry[username].gameId!;
                const game = activeGamesDb[gameId];

                if (typeof move !== "object") {
                    return; // do not accept strange input
                }
                move.username = username;

                const couldMove = game.processMove(move);

                if (!couldMove) {
                    return;
                }

                // Send the result of the move to the users in the game.
                for (const usernameInGame of game.getUsers()) {
                    const gameData = game.asClientView(usernameInGame);
                    io.to(`user-${usernameInGame}`).emit("move-performed-response", gameData);

                    // Tell the clients to play a movement sound.
                    io.to(`user-${usernameInGame}`).emit("play-sound", { sound: "move" });
                }
            });

            socket.on("chat-publish", ({ content }) => {
                if (!this.usernameIsActive(username)) {
                    // Ignore socket if the player is not in a game.
                    return; 
                }

                if (typeof content !== 'string') {
                    return; // do not accept strange input
                }

                if (content.trim().length === 0) {
                    return; // only accept valid messages
                }

                const gameId = this.playerRegistry[username].gameId!;
                const game = activeGamesDb[gameId];

                game.publishMessage({
                    by: username,
                    content,
                });

                // Send the chat to the users in the game.
                for (const usernameInGame of game.getUsers()) {
                    io.to(`user-${usernameInGame}`)
                        .emit("current-chat-history", {
                            history: game.getMessageHistory(9)
                        });
                }
            });

            socket.on("request-current-chat-history", () => {
                if (!this.usernameIsActive(username)) {
                    // Ignore socket if the player is not in a game.
                    return; 
                }
                const gameId = this.playerRegistry[username].gameId!;
                const game = activeGamesDb[gameId];

                io.to(socket.id)
                    .emit("current-chat-history", {
                        history: game.getMessageHistory(9)
                    });
            });

            socket.on("resign", () => {
                if (!this.usernameIsActive(username)) {
                    // Ignore socket if the player is not in a game.
                    return; 
                }
                const gameId = this.playerRegistry[username].gameId!;
                const game = activeGamesDb[gameId];

                game.finish({
                    // The other player wins.
                    winner: Game.togglePlayerRole(game.userToRole(username)),
                    method: "resign",
                });
            });
        });
    }
}

