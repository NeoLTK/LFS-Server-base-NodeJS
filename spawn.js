const { sqlite } = require('./sqlite.js');


class spawn {
	#spawn = [];
	#selected = null;
	#sqlite = null;
	#player = null;

	constructor(player){
		this.#sqlite = new sqlite()
		this.#player = player
	}

	get(callback){
		var sqlite = this.#sqlite;

		sqlite.$('select * from spawn', [], (e, r) =>{
			if(r) {
				this.#spawn = r;
				if(typeof callback == 'function') callback(r)
			}

		})
	}

	set(name, x, y, z){
		var sqlite = this.#sqlite;
		sqlite.req('insert into spawn values(?, ?, ?, ?, 0)', [name, x, y, z ])
		this.get();
	}
}

module.exports = { spawn: spawn };