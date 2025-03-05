const { sqlite } = require('./sqlite.js');


class wallet {
	#transaction = [];
	#player = null;
	#sqlite = null;

	constructor(player){
		this.#sqlite = new sqlite()
		this.#player = player
		this.curAmount = 0;
	}

	get(callback){
		var sqlite = this.#sqlite;

		sqlite.req('select sum(value) as value from wallet where fkPlayer = ?', [this.#player.extra.UserID], (e, r) =>{
			if(r && r.value) {
				this.curAmount = r.value
				if(typeof callback == 'function') callback(r.value)
			}

		})
	}

	set(amount, comment){
		var sqlite = this.#sqlite;
		sqlite.req('insert into wallet values(?, ?, ?, ?)', [amount, comment,  new Date().toISOString().slice(0, 19).replace('T', ' '), this.#player.extra.UserID])
		this.get();
	}

	save(){

	}
}

module.exports = { wallet: wallet };