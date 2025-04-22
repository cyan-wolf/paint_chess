
async function initNav() {
    const userInfo = await fetchUserData();
    fillNav(userInfo);
}

async function fetchUserData() {
    // Get the current user's username from the server.
    try {
        const response = await fetch("/current-user-info");

        if (!response.ok) {
            return null;
        }
        const { userInfo } = await response.json();
        return userInfo;
    }
    catch (error) {
        console.error(error.message);
    }
    return null;
}

function fillNav(userInfo) {
    const nav = document.getElementById("nav");

    const left = document.createElement("div");
    left.classList.add("nav-left");

    left.innerHTML += `<a href="/">Home</a>`;
    left.innerHTML += `<a href="/how-to-play">About</a>`;
    left.innerHTML += `<a href="/find-game">Find Game</a>`;

    if (userInfo !== null) {
        left.innerHTML += `<a href="/logout">Logout</a>`;
    }

    const right = document.createElement("div");
    right.classList.add("nav-right");

    if (userInfo !== null) {
        const { username, displayname } = userInfo;
        right.innerHTML += `<a href="/profile/${username}">${displayname}</a>`;
    } else {
        right.innerHTML += `<a href="/register">Register</a>`;
        right.innerHTML += `<a href="/login">Login</a>`;
    }

    nav.appendChild(left);
    nav.appendChild(right);
}

