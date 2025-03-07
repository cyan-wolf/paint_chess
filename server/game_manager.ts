import { Server } from "npm:socket.io@4.8.1";
import { Game } from "./game.ts";

type ID = string;

// Placeholder way of storing game data.
type GameQueue = {
    [gameId: ID]: {
        waitingPlayers: string[]
    }
};

type ActiveGames = {
    [gameId: ID]: Game
};

type ActivePlayers = {
    [player: string]: {
        gameId: ID,
        joined: boolean,
    };
};

export class GameManager {
    queuedGamesDb: GameQueue;
    activeGamesDb: ActiveGames;
    activePlayers: ActivePlayers;
    readonly io: Server

    constructor(io: Server) {
        this.queuedGamesDb = {};
        this.activeGamesDb = {};
        this.activePlayers = {};

        this.io = io;
    }

    // Placeholder ID generator.
    genId(): ID {
        return Math.random().toString().substring(2);
    }

    // Determines whether the given game ID is being queued.
    gameIdIsQueued(gameId: ID): boolean {
        return Object.hasOwn(this.queuedGamesDb, gameId);
    }

    // Determines whether the given game ID is being used by an active game.
    gameIdIsActive(gameId: ID): boolean {
        return Object.hasOwn(this.activeGamesDb, gameId);
    }

    // Determines whether the given user is in an active game.
    usernameIsActive(username: string): boolean {
        return Object.hasOwn(this.activePlayers, username);
    }

    // Determines whether the given username is in the game 
    // with the given ID.
    usernameInGame(username: string, gameId: ID): boolean {
        return this.gameIdIsActive(gameId) && 
            this.activeGamesDb[gameId].hasUser(username);
    }

    // Manages socket connections.
    connectSockets() {
        const io = this.io;
        const queuedGamesDb = this.queuedGamesDb;
        const activeGamesDb = this.activeGamesDb;
        const activePlayers = this.activePlayers;

        // Setup sockets.
        io.on("connection", (socket) => {
            const session = socket.request.session;

            if (!session.user) {
                return; // ignore events from this socket
            }

            const username = session.user.username;
            // For sending events using only the username.
            socket.join(`user-${username}`);

            socket.on("queue-game", (gameSettings) => {
                const gameId = this.genId();
                queuedGamesDb[gameId] = {
                    waitingPlayers: [],
                };

                io.emit("current-game-queue", queuedGamesDb);
            });

            socket.on("request-current-game-queue", () => {
                io.to(socket.id).emit("current-game-queue", queuedGamesDb);
            });

            socket.on("join-game-request", ({ gameId }) => {
                if (!this.gameIdIsQueued(gameId)) {
                    return; // ignore event if game ID is invalid
                }
                const queuedGame = queuedGamesDb[gameId];
                
                if (queuedGame.waitingPlayers.includes(username)) {
                    return; // avoid duplicate users in the same game
                }
                queuedGame.waitingPlayers.push(username);
                socket.join(`game-${gameId}`);

                if (queuedGame.waitingPlayers.length == 2) {
                    // Remove game from queue.
                    delete queuedGamesDb[gameId];

                    // Joining game logic
                    const [p1, p2] = queuedGame.waitingPlayers;

                    activePlayers[p1] = { gameId, joined: false };
                    activePlayers[p2] = { gameId, joined: false };

                    const game = new Game({
                        p1, p2, gameId,
                        joinedPlayers: 0,
                        secsPerPlayer: 5 * 60,
                        hasStarted: false,
                    });
                    activeGamesDb[gameId] = game;

                    game.addOnGameEndEventHandler((result) => {
                        console.log("game ended!");
                        console.log(result);

                        for (const usernameInGame of game.getUsers()) {
                            const gameData = game.asClientView(usernameInGame);

                            // Send the final state of the game to all players before ending the game.
                            io.to(`user-${usernameInGame}`).emit("move-performed-response", gameData);

                            // Ends the game on the client.
                            io.to(`user-${usernameInGame}`).emit("game-ended", { result });

                            // Tell the clients to play a "game-end" sound.
                            io.to(`user-${usernameInGame}`).emit("play-sound", { sound: "game-end" });

                            // TODO: add a record of the results of the game to the database
                            // ...

                            // Make the player no longer active.
                            delete activePlayers[usernameInGame];
                        }

                        // Make the game no longer active.
                        delete activeGamesDb[gameId];
                    });
                    
                    // Redirects the user to "/game/:id" on the client.
                    io.to(`game-${gameId}`).emit("found-game", { gameId });
                }
                
                io.emit("current-game-queue", queuedGamesDb);
            });

            socket.on("ready-to-start-game", () => {
                if (!this.usernameIsActive(username)) {
                    // Ignore socket if the player is not in a game.
                    return; 
                }
                const gameId = activePlayers[username].gameId;
                
                // Re-join the user to the socket game room, as 
                // the connection was reset when the page reloaded 
                // when getting to "/game/:id".
                socket.join(`game-${gameId}`);
                socket.join(`user-${username}`);

                const game = activeGamesDb[gameId];

                // Player is joining for the first time.
                if (!activePlayers[username].joined) {
                    // Increment the number of joined players.
                    game.joinPlayer();

                    activePlayers[username].joined = true;
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
                const gameId = activePlayers[username].gameId;
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

                if (content.length === 0) {
                    return; // only accept valid messages
                }

                const gameId = activePlayers[username].gameId;
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
                const gameId = activePlayers[username].gameId;
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
                const gameId = activePlayers[username].gameId;
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

