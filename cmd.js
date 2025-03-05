const { inSimTools } = require('./inSimTools.js'); 

class cmd {
	#cmds = []

	constructor(inSim, players){
		this.inSimTools = new inSimTools(inSim)
		this.players = players
	}

	cmdsParser(args){
		var ret = false
		this.#cmds.forEach((cmd, i) => {
			if(args[0] == cmd[0]){
				ret = cmd[3]
			}
		})

		return ret
	}

	parse(packet, callback){
		var args = packet.Msg.replace(/\^./g, '').split(" : ")
		if(!args[1]) return false;
		if(args[1][0] == '!') {
			args = args[1].split(" ")
			var player = this.players.find(player => player.UCID === packet.UCID)

			if(!this.cmdsParser(args)) {
				args[0] = args[0].replace(/(.{2})/g, '$1~');
				this.inSimTools.sendSystemToPlayer(player, "The command '" + args[0] + "' is not found. maybe try '!h~el~p'", this.getLanguage(packet.UCID));
			} else this.cmdsParser(args)(packet, (args[1]?args[1]:null));
			
			return true;
		}

	}


	create(cmd, desc, level, callback){
		this.#cmds.push([cmd, desc, level, callback])
	}

	getLanguage(UCID){
		const player = this.players.find(player => player.UCID === UCID);
    	return (player ? player.extra.Language : null);
	}
}

module.exports = { cmd: cmd };