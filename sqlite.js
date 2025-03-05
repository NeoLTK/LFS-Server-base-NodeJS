const sqlite3 = require('sqlite3').verbose();

class sqlite {
    
    constructor(){
        this.db = new sqlite3.Database("./db.sqlite3");
    }

    createPlayer(player, callback){
        const stmt = this.db.prepare("INSERT INTO player VALUES (?, ?, ?, ?, ?, ?)");
        stmt.run(player.extra.UserID, player.UName, player.extra.IPAddress, player.extra.Language, new Date().toISOString().slice(0, 19).replace('T', ' '), 0)
        stmt.finalize();
        callback()
    }

    playerExist(UserID, callback){
        this.db.each("SELECT count(*) as count FROM player where UserID = " + UserID, callback);
    }

    req(req, args, callback){
        this.db.each(req, args, callback);
    }

    $(req, args, callback){
        this.db.all(req, args, callback);
    }
}

module.exports = { sqlite: sqlite };