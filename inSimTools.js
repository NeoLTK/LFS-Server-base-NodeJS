const { InSim } = require('node-insim');
const {
  ButtonStyle,ButtonTextColour,
  IS_BTN, IS_MSX, IS_ISI_ReqI, IS_ISM, IS_TINY, IS_BFN, IS_NPL, IR_HLR, IS_MSO,IS_MTC, IS_MST, IS_SCH,IS_AXM ,
  TinyType, PacketType, InSimFlags, ButtonFunction, UserType, Language, PMOAction,
} = require('node-insim/packets');

const { _translate } = require('./_translate.js'); 
const { sqlite } = require('./sqlite.js'); 

class inSimTools {
	#buffer = []

	constructor(inSim){
		this.inSim = inSim
		this.buttons = []
		this.sqlite = new sqlite();
	}

	getCurClickId(){/*
		const maxClickID = Math.max(...this.buttons.map(button => button[2]));*/
		return this.buttons.length;
	}

	deletButton(UCID, ClickID) {
		this.buttons.forEach((button, index) => {
			if (button[2] == ClickID) {
				this.buttons.splice(index, 1);
				console.log("RM ClickID :", ClickID)
			}
		})

		this.inSim.send(
			new IS_BFN({
				ClickID: ClickID, 
				UCID: UCID
			}) 
        );
	}

	createButton(text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, lang = false){
		var tmp = this.buttons.find(button => button[2] === ClickID)
	    if(!tmp) this.buttons.push([text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, lang])
	    
		if (lang && (!tmp || tmp[0] != text)){
			var lang = this.getLanguageStr(lang);
			this.sqlite.req('select count(*) as count, result from Translate where source like "%'+text+'%" and lang like "%'+lang+'%"' , [], (e, r) => {
				if(r && r.count){
					var tmp = this.buttons.find(button => button[2] === ClickID)
					if(tmp) {
						tmp.splice(0, tmp.length, ...[text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, lang])
						//tmp = [text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, lang] //marche pas, remplace le pseudo pointer
						tmp[11] = r.result
					}
				}else
					this.sqlite.req('select *  from langues where langue_nom like "%'+lang+'%"' , [], (e, r) => {
						if(r && r.code_langue)
							_translate.translateText(text, r.code_langue).then((data) => {
								var tmp = this.buttons.find(button => button[2] === ClickID)
								if(tmp) {
									tmp.splice(0, tmp.length, ...[text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, lang])
									//tmp = [text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, lang] //marche pas, remplace le pseudo pointer
									tmp[11] = data.text
									this.sqlite.req('insert into translate values("'+text+'", "'+data.text+'", "'+lang+'")', [], (e) => {})
								}

								console.log("trad request")
								this.createButton(text, UCID, ClickID, ReqI, top, left, width, height, typeIn, BStyle, false)
								return;
							})
						else console.log("langue inconnu", e)
					});
			})
	        return;
		} 

	    this.inSim.send(
		    new IS_BTN({
		       ClickID: ClickID,
		       UCID: UCID,
		       ReqI: ReqI,
		       T: top,
		       L: left,
		       W: width,
		       H: height,
		       Text: (tmp && tmp[11] ? tmp[11] : text),
		       TypeIn:typeIn,
		       BStyle:BStyle
		   }),
		); 
		return this;
	}

	static createObject(insim){
	    insim.send(
		    new IS_AXM ({
			    UCID: 0,          // ID de l'utilisateur (0 = serveur)
			    PMOAction: PMOAction.PMO_ADD_OBJECTS,     // 1 = Ajouter l'objet
			    PMOFlags: 0,      // Aucun flag particulier
			    NumO: 1,          // Nombre d'objets à ajouter (ici 1)
			    Sp0: 0,           // Octet de remplissage
			    Sp2: [0, 0, 0],   // Trois octets de remplissage
			    ObjectInfo: [
			      {
			        X: 2869,
    				Y: -13213,
    				z: 0,
    				zByte: 4,	
			        Flags: 0,     // Flags de l'objet (byte)
			        Index: 4,     // Index de l'objet (word) – doit commencer à 4
			        Heading: 0    // Orientation de l'objet (word)
			      }
			    ]
			}),
		); 
	}

	reservClickID(UCID, ClickID, ReqI) {
		if(this.buttons.find(button => button[2] === ClickID)) return
		this.buttons.push(["", UCID, ClickID, ReqI, 0, 0, 0, 0, 0, 0, false])
	}

	drawButton(){
		this.buttons.forEach((button) => {
		    this.inSim.send(
			    new IS_BTN({
			       ClickID: button[2],
			       UCID: button[1],
			       ReqI: button[3],
			       T: button[4],
			       L: button[5],
			       W: button[6],
			       H: button[7],
			       Text: button[0],
			       TypeIn:button[8],
			       BStyle:button[9]
			   }),
			); 
		})
	}

	sendSystemToPlayerSync(player, msg, trad = true, push = true) {
		if(push) this.#buffer.push([player, msg, trad]);
		let length = this.#buffer.length

		if(length == 1)
			this.sendSystemToPlayer(player, msg, trad, () => {
				this.#buffer.shift();
			})
		else if (length == 0) return;
		else setTimeout(()=>{this.sendSystemToPlayerSync(player, msg, trad, false)}, 100);
	}

	sendSystemToPlayer(player, msg, trad = true, callback = false, sound = 2){
		if(trad) {
			console.log(player.extra.code_langue)
			_translate.translateText(msg, player.extra.code_langue).then((data) => {
				this.sendSystemToPlayer(player, data.text.replace(/\s?~\s?/g, '').replace(/!(\s)/g, '!').toLowerCase(), false, callback)
			})
	    return;
		}

		this.inSim.send(
	        new IS_MTC( {
		      UCID: player.UCID,
		      Sound: sound,
		      PLID:0,
		      Text: msg,
		    })
	    )

		if(typeof callback === "function")
			callback()
	}

	static getAllUser(inSim){
		inSim.send(new IS_TINY({
			ReqI: 99,
			SubT: TinyType.TINY_NCN
		}))
	}

	static getAllUserExtra(inSim){
		inSim.send(new IS_TINY({
			ReqI: 99,
			SubT: TinyType.TINY_NCI 
		}))
	}

	textCommand(cmd) {
		this.inSim.send(new IS_MST({
			ReqI: 99,
			Msg: cmd,
		}))
	}

	getLanguageStr(langId) {
	  var tmp = Object.keys(Language).find(key => Language[key] === langId).split("_")[1];
	  return tmp.charAt(0).toUpperCase() + tmp.slice(1).toLowerCase();
	}
}

module.exports = { inSimTools: inSimTools };