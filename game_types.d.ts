type MetaGameInfo = {
    gameId: string,
    joinedPlayers: number,
    p1: string,
    p2: string,
};

type ColorConfig = {
    p1: {
        piece: string;
        bgLight: string;
        bgDark: string;
    };
    p2: {
        piece: string;
        bgLight: string;
        bgDark: string;
    };
};

type GameViewForClient = {
    gameId: string;
    boardConfig: {
        isFlipped: boolean;
        colorConfig: ColorConfig;
    };
    boardDesc: BoardDescription;
};

type RawMove = { 
    from?: string, 
    to?: string, 
    username?: string,
};

