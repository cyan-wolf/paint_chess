import express from "express";
import http from "node:http";
import path from "node:path";
import session from "express-session";

// Load configuration environment variables.
import dotenv from "dotenv";
dotenv.config();

import db from "./db_conn.js";

const app = express();
const server = http.createServer(app);

const __dirname = import.meta.dirname;

// Used for public files, such as front-end JS scripts and CSS.
app.use('/public', express.static(path.join(__dirname, "public")));

// Used for reading request bodies as JSON.
app.use(express.urlencoded({ extended: true }));

// Used for sessions.
app.use(session({
    secret: process.env.EXPRESS_SECRET,
    resave: false,
    saveUninitialized: false,
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "client/index.html"));
});

app.get('/how-to-play', (req, res) => {
    res.sendFile(path.join(__dirname, "client/how-to-play.html"));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, "client/register.html"));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, "client/login.html"));
});

app.get('/logout', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
        return;
    }
    req.session.destroy();
    res.redirect('/');
});

app.post('/register', (req, res) => {
    res.send("NOT IMPLEMENTED");
});

// Placeholder login validator.
function checkLogin(reqBody) {
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
    console.log(req.session.user);
    res.sendFile(path.join(__dirname, "client/find-game.html"));
});

// This route is currently planned to be used for queueing games,
// but it's probably better to use sockets instead.
app.post('/find-game', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
    }

    // Placeholder.
    console.log(`queued game from ${req.session.user.username}`);
});

app.get('/testing', (req, res) => {
    res.sendFile(path.join(__dirname, "client/testing.html"));
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`App running at http://localhost:${port}.`);
});
