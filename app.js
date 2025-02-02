import express from "express";
import http from "node:http";
import path from "node:path";

import db from "./db_conn.js";

const app = express();
const server = http.createServer(app);

const __dirname = import.meta.dirname;

app.use('/public', express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "client/index.html"));
});

app.get('/how-to-play', (req, res) => {
    res.sendFile(path.join(__dirname, "client/how-to-play.html"));
});

app.get('/find-game', (req, res) => {
    res.sendFile(path.join(__dirname, "client/find-game.html"));
});

app.get('/testing', (req, res) => {
    res.sendFile(path.join(__dirname, "client/testing.html"));
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log(`App running at http://localhost:${port}.`);
});
