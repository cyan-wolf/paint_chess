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
import db from "./server/db_conn.ts";
import { UserSchema } from "./server/db_conn_types.d.ts";

// For login management.
import * as login from "./server/login_management.ts";

import { fetchUserData } from "./server/data_access.ts";

// For hashing passwords.
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// For templating.
import "npm:hbs@4.2.0";

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
const sessionMiddleware = session({
    secret: process.env.EXPRESS_SECRET!,
    resave: false,
    saveUninitialized: false,
});

// Makes sessions accessible from route handlers.
app.use(sessionMiddleware);

// Makes sessions accessible from socket event handlers.
io.engine.use(sessionMiddleware);

// Sets the templating engine.
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "client-views"));

type User = {
    username: string
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

app.get('/register', (req, res) => {
    if (req.session.user) {
        // Cannot register if a session already exists.
        res.redirect("/");
        return;
    }

    res.sendFile(path.join(__dirname, "client/register.html"));
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        // Cannot login if a session already exists.
        res.redirect("/");
        return;
    }

    res.sendFile(path.join(__dirname, "client/login.html"));
});

app.get('/logout', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
        return;
    }
    // TODO: delete the guest account if a user was using one

    req.session.destroy(() => {});
    res.redirect('/');
});

type RawRegisterRequest = {
    username?: string,
    displayname?: string,
    email?: string,
    password?: string,
};

type RegisterRequest = {
    username: string,
    displayname: string,
    email: string,
    password: string,
};

function checkRegistration(reqBody: RawRegisterRequest): reqBody is RegisterRequest {
    if (reqBody.username === undefined || 
        reqBody.displayname === undefined ||
        reqBody.password === undefined || 
        reqBody.email === undefined) {
        return false;
    }
    if (!reqBody.username.match(/[A-Za-z\d_]+/) || 
        reqBody.displayname.trim().length === 0 ||
        reqBody.password.trim().length === 0 || 
        reqBody.email.trim().length === 0) {
        return false;
    }
    return true;
}

app.post('/register', async (req, res) => {
    const reqBody = req.body;

    if (!checkRegistration(reqBody)) {
        // Invalid registration.
        console.log("invalid registration");

        res.redirect("/");
        return;
    }
    const { username, displayname, email, password: plaintextPassword } = reqBody;

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
        email,
        password,
        friends: [],
        elo: 400,
    });
    console.log(`LOG: registered user ${username}`);

    // TODO
    res.send("SUCCESSFULLY REGISTERED");
});

app.post('/login', async (req, res) => {
    if (req.session.user) {
        // Cannot login if a session already exists.
        return;
    }

    const user = await login.tryLoginUser(req.body);

    if (user !== null) {
        req.session.user = user;
        
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

// This route is used for queueing games.
app.post('/find-game', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
    }
});

app.get('/current-user-info', async (req, res) => {
    if (!req.session.user) {
        res.send(null);
        return;
    }
    const username = req.session.user.username;

    const userInfo = await fetchUserData(username);
    res.send(userInfo);
});

app.get('/profile/:username', async (req, res) => {
    const username = req.params.username;
    
    const userInfo = await fetchUserData(username);

    if (userInfo === null) {
        res.send("USER NOT FOUND");
        return;
    }

    // TODO: Allow users (with accounts) to customize this.
    const description = (userInfo.isGuest) ? "This is a guest account." : "This is a user account.";

    // TODO: Add more data to this, like ELO history.
    const profileInfo = { 
        description,
        ...userInfo,
    };
    
    // Use server-side rendering or similar to generate a profile page with the above info.
    res.render("profile", profileInfo);
});

app.get('/testing', (_req, res) => {
    res.sendFile(path.join(__dirname, "client/testing.html"));
});

const gameManager = new GameManager(io);
gameManager.connectSockets();

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
        res.redirect("/find-game");
        return;
    }

    // User must be a player in the game.
    // TODO: Spectator functionality could be added here.
    if (!gameManager.usernameInGame(username, gameId)) {
        res.status(400).send("User is not playing this game");
    }

    res.sendFile(path.join(__dirname, "client/game.html"));
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`App running at http://localhost:${port}.`);
});