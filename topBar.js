const {
  ButtonStyle,ButtonTextColour, Language,
} = require('node-insim/packets');

class topBar {
	#player = null;
	#startClickId = null;
	#lastClickId = null;
	#top = []

	constructor(player){
		this.#player = player
	}

	create(text, value){
		if (typeof value === 'function') {
	      this.#top.push([text, value]);
	    } else {
	      console.error("Callback must be a function.");
	    }
	}

	draw() {
		if(!this.#startClickId) this.#startClickId = this.#player.inSimTools.getCurClickId();

    var inSimTools = this.#player.inSimTools;
    var player = this.#player;
    let ClickID = this.#startClickId; 
    
    const baseX = 0;
    const baseY = 17; 
    let posY = baseY;

    inSimTools.createButton("", player.UCID, ClickID, 55, 0, 0, 200, 5, 0,ButtonStyle.ISB_DARK, false);
    ClickID += 1;

    this.#top.forEach((top, i) => {
        if (i > 0) {
            posY += 20; 
        	inSimTools.createButton("|", player.UCID, ClickID, 55, baseX+1, posY-2, 2, 3, 0, "", false);
        	ClickID += 1;
        }


        const buttonTextWidth = 20; 
      
        inSimTools.createButton(top[0]+top[1](), player.UCID, ClickID, 55, baseX+1, posY, buttonTextWidth-2, 3, 0, ButtonStyle.ISB_DARK | ButtonTextColour.SELECTED_TEXT, this.#player.extra.Language);
        ClickID += 1;

    });

    return ClickID;
	}


}

module.exports = { topBar: topBar };