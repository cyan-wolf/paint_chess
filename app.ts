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

// Manages socket connections to clients.
import { GameManager } from "./server/game_manager.ts"

// For database access.
import { getDB } from "./server/db_conn.ts";
import { UserSchema } from "./server/types/db_conn_types.d.ts";

// For login management.
import * as login from "./server/login_management.ts";

// For registration management.
import * as registrationManagement from "./server/registration_management.ts";

import { fetchUserData } from "./server/data_access.ts";

// For hashing passwords.
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// For templating.
import "npm:hbs@4.2.0";

import assert from "node:assert";
import { SocketManager } from "./server/socket_manager.ts";

// For user data access.
import * as data_access from "./server/data_access.ts";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __dirname = import.meta.dirname!;

// Used for public files, such as front-end JS scripts and CSS.
app.use('/public', express.static(path.join(__dirname, "public")));

// Used for reading request bodies as JSON.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Used for sessions.
assert(process.env.EXPRESS_SECRET !== undefined);

const sessionMiddleware = session({
    secret: process.env.EXPRESS_SECRET,
    resave: false,
    saveUninitialized: false,
});

// Makes sessions accessible from route handlers.
app.use(sessionMiddleware);

// Saves when the user visits a "noteworthy" page.
// Used for redirecting when the user finished logging in.
app.use((req, _res, next) => {
    const noteworthyURLs = new Set(['find-game', 'how-to-play', 'invite']);

    const urlFirstPart = req.originalUrl.split('/')[1];

    if (noteworthyURLs.has(urlFirstPart)) {
        req.session.redirectTo = req.originalUrl;
    }
    next();
});

// Makes sessions accessible from socket event handlers.
io.engine.use(sessionMiddleware);

// Sets the templating engine.
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "client-views"));

type User = {
    username: string,
};

// Augment express-session with a custom SessionData object.
declare module "npm:express-session@1.18.1" {
    interface SessionData {
        user: User,
        redirectTo?: string,
    }
}

// Globals.
const gameManager = new GameManager();

const socketManager = new SocketManager(io, gameManager);
socketManager.wireSockets();

// Setup routes.

// When the client visits the main page.
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/index.html"));
});

// When the client visits the How To Play (About) page.
app.get('/how-to-play', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/how-to-play.html"));
});

// When the client visits the registration page.
app.get('/register', (req, res) => {
    if (req.session.user) {
        // Cannot register if a session already exists.
        res.redirect("/");
        return;
    }

    res.sendFile(path.join(__dirname, "client/register.html"));
});

// When the client visits the login page.
app.get('/login', (req, res) => {
    if (req.session.user) {
        // Cannot login if a session already exists.
        res.redirect("/");
        return;
    }

    res.sendFile(path.join(__dirname, "client/login.html"));
});

// When the client visits the logout page.
app.get('/logout', (req, res) => {
    if (!req.session.user) {
        // There is no session, so logging out doesn't do anything.
        res.redirect("/");
        return;
    }
    res.sendFile(path.join(__dirname, "client/logout.html"));
});

// When the client submits registration credentials.
app.post('/register', async (req, res) => {
    const reqBody = req.body;

    const registration = registrationManagement.checkRegistration(reqBody);

    if (registration === null) {
        // Invalid registration.
        console.log("invalid registration");

        res.redirect("/");
        return;
    }
    const { username, displayname, password: plaintextPassword } = registration;

    const db = getDB();
    const usersCollection = db.collection<UserSchema>("users");

    // Disallow registration if a user with the given username already exists.
    if ((await usersCollection.findOne({ username })) !== undefined) {
        console.log("invalid registration");

        res.redirect("/");
        return;
    }

    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash(plaintextPassword, salt);
    
    await usersCollection.insertOne({
        username,
        displayname,
        password,
        elo: 400,
    });

    res.render("status/status-successful-registration", { username });
});

// When the client submits login credentials.
// The client could be trying to login as a guest user, in which 
// case a new temporary guest account is created. The client could 
// also be trying to login with a pre-existing account.
app.post('/login', async (req, res) => {
    if (req.session.user) {
        // Cannot login if a session already exists.
        return;
    }
    const user = await login.tryLoginUser(req.body);

    if (user !== null) {
        req.session.user = user;
        
        // Redirect to the previous noteworthy page.
        // This is set by middleware.
        res.redirect(req.session.redirectTo ?? '/');
        delete req.session.redirectTo;
    }
    else {
        res.redirect('/login');
    }
});

// When the client submits a request to logout.
app.post('/logout', (req, res) => {
    if (!req.session.user) {
        // There is no session, so logging out doesn't do anything.
        res.redirect("/");
        return;
    }

    // Delete the any locally-saved user data.
    const username = req.session.user.username;
    data_access.clearLocalUserData(username, gameManager);

    req.session.destroy(() => {});
    res.render("status/status-logout", {});
});

// When the client visits the Find Game page.
// This is the page where the client can queue a new game or
// view a list of queued games.
app.get('/find-game', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
        return;
    }
    if (gameManager.usernameIsInActiveGame(req.session.user.username)) {
        const gameId = gameManager.playerRegistry[req.session.user.username].gameId!;

        res.render("status/status-already-in-another-game", { gameId });
        return;
    }
    res.sendFile(path.join(__dirname, "client/find-game.html"));
});

// When the client visits an invite link to a queued game.
app.get('/invite/:id', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
        return;
    }
    const username = req.session.user.username;
    const gameId = req.params.id;

    // A user cannot join an invite if already in an active game.
    if (gameManager.usernameIsInActiveGame(username)) {
        res.render("status/status-already-in-another-game", { gameId });
        return;
    }

    // A user cannot join their own queued game using an invite.
    if (gameManager.usernameInGivenQueuedGame(username, gameId)) {
        res.render("status/status-cannot-join-queued-game", { gameId });
        return;
    }

    // A user can only join queued games when using invite links.
    if (! gameManager.gameIdIsQueued(gameId)) {
        res.render("status/status-unknown-game", { gameId });
        return;
    }

    // Temporary page used for connecting to sockets and then immediately 
    // requesting to join the game with the given ID.
    // The game ID is hard coded on the temp page using templating.
    res.render("invite", { gameId });
});

// API endpoint for getting the current user's data.
// Used for loading the navbar in the various pages.
app.get('/current-user-info', async (req, res) => {
    if (!req.session.user) {
        res.send({ userInfo: null });
        return;
    }
    const username = req.session.user.username;

    const userInfo = await fetchUserData(username);
    res.send({ userInfo });
});

// When the client visits a user's profile page.
// All users, even guests and AI accounts, have profile pages.
app.get('/profile/:username', async (req, res) => {
    const username = req.params.username;
    
    const userInfo = await fetchUserData(username);

    if (userInfo === null) {
        res.render("status/status-unknown-user", { username });
        return;
    }
    const description = (userInfo.isTemp) ? "This is a temporary account." : "This is a user account.";

    const profileInfo = { 
        description,
        ...userInfo,
    };
    res.render("profile", profileInfo);
});

// When the client visits an active game page.
// Clients under normal circumstances do not visit this page directly, instead:
// 1) They are taken to this page automatically when a game is found in the Find Game page. 
// 2) Invite links also redirect to this page. 
app.get("/game/:id", (req, res) => {
    const gameId = req.params.id;

    // User must be logged in.
    if (!req.session.user) {
        res.redirect("/login");        
        return;
    }
    const username = req.session.user.username;

    // Game ID must be valid.
    if (!gameManager.gameIdIsActive(gameId)) {
        res.render("status/status-unknown-game", { gameId });
        return;
    }

    // User must be a player in the game.
    if (!gameManager.usernameInGivenActiveGame(username, gameId)) {
        // TODO: Spectator functionality could be added here.
        res.render("status/status-not-playing-current-game", { gameId });
        return;
    }

    res.sendFile(path.join(__dirname, "client/game.html"));
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`App running at port ${port}.`);
});