// @ts-types="npm:@types/express@4.17.15"
import express from "npm:express@4.18.2";

// @ts-types="npm:@types/express-session@1.18.1"
import session from "npm:express-session@1.18.1";

import http from "node:http";
import path from "node:path";
import process from "node:process";

import { Server } from "npm:socket.io@4.8.1";

// Load configuration environment variables.
import dotenv from "npm:dotenv@16.4.7";
dotenv.config();

import { Game } from "./server/game.ts";
import db from "./server/db_conn.ts";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __dirname = import.meta.dirname!;

// Used for public files, such as front-end JS scripts and CSS.
app.use('/public', express.static(path.join(__dirname, "public")));

// Used for reading request bodies as JSON.
app.use(express.urlencoded({ extended: true }));

// Used for sessions.
const sessionMiddleware = session({
    secret: process.env.EXPRESS_SECRET!,
    resave: false,
    saveUninitialized: false,
});

// Makes sessions accessible from route handlers.
app.use(sessionMiddleware);

// Makes sessions accessible from socket event handlers.
io.engine.use(sessionMiddleware);


type User = {
    username: string,
    id: string, // unnecessary?
};

// Augment express-session with a custom SessionData object.
declare module "npm:express-session@1.18.1" {
    interface SessionData {
      user: User;
    }
}

// Setup routes.

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/index.html"));
});

app.get('/how-to-play', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/how-to-play.html"));
});

app.get('/register', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/register.html"));
});

app.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/login.html"));
});

app.get('/logout', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
        return;
    }
    req.session.destroy(() => {});
    res.redirect('/');
});

app.post('/register', (_req, res) => {
    res.send("NOT IMPLEMENTED");
});

// Placeholder login validator.
function checkLogin(reqBody: { username: string, password: string }) {
    return reqBody.username === "user123" && reqBody.password === "123"
        || reqBody.username === "other_user" && reqBody.password === "456";
}

// Placeholder ID generator.
function genId() {
    return Math.random().toString().substring(2);
}

app.post('/login', (req, res) => {
    if (checkLogin(req.body)) {
        req.session.user = { username: req.body.username, id: genId() };
        
        res.redirect('/');
    }
    else {
        res.redirect('/login');
    }
});

app.get('/find-game', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, "client/find-game.html"));
});

// This route is currently planned to be used for queueing games,
// but it's probably better to use sockets instead.
app.post('/find-game', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
    }
});

// Placeholder way of storing game data.
type GameQueue = {
    [gameId: string]: {
        waitingPlayers: string[]
    }
};

type ActiveGames = {
    [gameId: string]: Game
};

type ActivePlayers = {
    [player: string]: {
        gameId: string
        joined: boolean
    };
};

const queuedGamesDb: GameQueue = {};
const activeGamesDb: ActiveGames = {};
const activePlayers: ActivePlayers = {};

app.get("/game/:id", (req, res) => {
    const gameId = req.params.id;

    // User must be logged in.
    if (!req.session.user) {
        res.redirect("/login");        
        return;
    }
    const username = req.session.user.username;

    // Game ID must be valid.
    if (!Object.hasOwn(activeGamesDb, gameId)) {
        res.redirect("/find-game");
        return;
    }
    const game = activeGamesDb[gameId];

    // User must be a player in the game.
    if (!game.hasUser(username)) {
        res.status(400).send("User is not playing this game");
    }

    res.sendFile(path.join(__dirname, "client/game.html"));
});

app.get('/testing', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/testing.html"));
});


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
        const gameId = genId();
        queuedGamesDb[gameId] = {
            waitingPlayers: [],
        };

        io.emit("current-game-queue", queuedGamesDb);
    });

    socket.on("request-current-game-queue", () => {
        io.to(socket.id).emit("current-game-queue", queuedGamesDb);
    });

    socket.on("join-game-request", ({ gameId }) => {
        if (!Object.hasOwn(queuedGamesDb, gameId)) {
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

            //console.log(`players ${p1} and ${p2} are about to join game ${gameId}`);

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

            // // Used for miscellaneous events.
            // game.addOnMiscGameEventHandler((event) => {
            //     if (event.kind === "check_alert") {
            //         const { who, kingCoord } = event;

            //         for (const usernameInGame of game.getUsers()) {
            //             io.to(`user-${usernameInGame}`).emit("check-alert", { checkEvent: { who, kingCoord } });
            //         }
            //     }
            // });
            
            // Redirects the user to "/game/:id" on the client.
            io.to(`game-${gameId}`).emit("found-game", { gameId });
        }
        
        io.emit("current-game-queue", queuedGamesDb);
    });

    socket.on("ready-to-start-game", () => {
        if (!Object.hasOwn(activePlayers, username) || !Object.hasOwn(activePlayers[username], "gameId")) {
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
        if (!Object.hasOwn(activePlayers, username) || !Object.hasOwn(activePlayers[username], "gameId")) {
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
        if (!Object.hasOwn(activePlayers, username) || !Object.hasOwn(activePlayers[username], "gameId")) {
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
        if (!Object.hasOwn(activePlayers, username) || !Object.hasOwn(activePlayers[username], "gameId")) {
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
        if (!Object.hasOwn(activePlayers, username) || !Object.hasOwn(activePlayers[username], "gameId")) {
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

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`App running at http://localhost:${port}.`);
});