
function fillNav(navSettings) {
    const { username } = navSettings;

    const nav = document.getElementById("nav");

    const left = document.createElement("div");
    left.classList.add("nav-left");

    left.innerHTML += `<a href="/">Home</a>`;
    left.innerHTML += `<a href="/how-to-play">How to Play</a>`;
    left.innerHTML += `<a href="/find-game">Find Game</a>`;

    if (username !== null) {
        left.innerHTML += `<a href="/logout">Logout</a>`;
    }

    const right = document.createElement("div");
    right.classList.add("nav-right");

    if (username !== null) {
        right.innerHTML += `<a href="/profile/${username}">${username}</a>`;
    } else {
        right.innerHTML += `<a href="/register">Register</a>`;
    }

    nav.appendChild(left);
    nav.appendChild(right);
}

