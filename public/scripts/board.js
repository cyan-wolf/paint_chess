
function initBoard(board) {
    for (let index = 0; index < 8 * 8; index++) {
        const slot = document.createElement("div");
        slot.classList.add("slot");

        const row = Math.floor(index / 8);
        const col = index % 8;

        if (row % 2 == 0 && col % 2 == 0 || row % 2 == 1 && col % 2 == 1) {
            slot.style.backgroundColor = "white";
        } else {
            slot.style.backgroundColor = "black";
        }
        const pieceSpan = document.createElement("span");

        slot.appendChild(pieceSpan);
        board.appendChild(slot);
    }
}

// TODO
function genInitialChessBoardDesc(colorDesc) {
    return [
        {
            piece: "rook",
            color: colorDesc["color1"]["piece"],
            position: "a8",
        },
    ];
}

// Placeholder.
function genSampleBoardDesc() {
    return [
        "piece rook red",
        "piece knight orange",
        "piece bishop yellow",
        "piece queen lime",
        "piece king green",
        "piece bishop cyan",
        "piece knight blue",
        "piece rook purple",

        "piece pawn gray",
        "piece pawn gray",
        "piece pawn gray",
        "piece pawn gray",
        "piece pawn gray",
        "piece pawn gray",
        "piece pawn gray",
        "piece pawn gray",
    ];
}

// TODO
function updateBoard(board, boardDesc) {
    for (let index = 0; index < 8 * 8; index++) {
        board.children[index].children[0].classList = boardDesc[index];
    }
}