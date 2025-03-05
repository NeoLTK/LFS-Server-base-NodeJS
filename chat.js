const {
  ButtonStyle,ButtonTextColour
} = require('node-insim/packets');

const { llm } = require('./llm.js'); 
const { inSimTools } = require('./inSimTools.js'); 
const { _translate } = require('./_translate.js'); 
const { sqlite } = require('./sqlite.js'); 


class chat {
  #startClickId = null;

  constructor(inSim, player, settings = null) {
    this.inSim = inSim;
    this.inSimTools = player.inSimTools
    this.llm = new llm();
    this.windw = [];
    this.player = player;
    this.sqlite = new sqlite()

    if (!settings) {
      this.settings = {
        top: 120,
        left: 0,
        chatMaxLine: 8,
        timeOutInt: 10000,
        intervalInt:2000,
        maxHistory: 100
      }
    } else this.settings = settings;
  }

  indexed(array){
    let tmp = [];

    for (var b in array) 
      tmp[tmp.length] = b;

    return tmp;
  }

  newChatTable(name, userPrompt, sendToChat, prompt1 = "", prompt2){
    var prompt  = this.llm.updatePrompt();

    this.windw[name] = {}
    this.windw[name].selected = (this.indexed(this.windw).length == 1 ? true : false);
    this.windw[name].index = 0;
    this.windw[name].timeOut = null;
    this.windw[name].interval = null;
    this.windw[name].ollamaMessage = [];
    this.windw[name].model = this.llm.updatePrompt()[prompt1]["model"];
    this.windw[name].system_prompt = this.llm.updatePrompt()[prompt1]["prompt"];
    this.windw[name].content = [];
    this.windw[name].contentHistory = [];

    if (!userPrompt) return

    this.windw[name]['prompt'] = {}
    this.windw[name]['prompt'].ollamaMessage = this.windw[name].ollamaMessage;
    this.windw[name]['prompt'].model = this.llm.updatePrompt()[prompt2]["model"];
    this.windw[name]['prompt'].system_prompt = this.llm.updatePrompt()[prompt2]["prompt"];
    this.windw[name]['prompt'].content = [];
    this.windw[name]['prompt'].contentHistory = [];
    this.windw[name]['prompt'].pid = 200;
    this.windw[name]['prompt'].sid = 201;
    this.windw[name]['prompt'].lastResp = "";
    this.windw[name]['prompt'].validation = false;
    this.windw[name]['prompt'].sendToChat = sendToChat;
  }

  clearWindwContent(windw){
    if (windw.content.length > this.settings.chatMaxLine){
      windw.content.shift();
      return this.clearWindwContent(windw)
    } 

    if(windw.contentHistory.length > this.settings.maxHistory){
      windw.contentHistory.shift();
      windw.contentHistory.shift();
      return this.clearWindwContent(windw)
    }
  }

  translate(windw, clickId, language){
    var startClick = this.#startClickId + this.indexed(this.windw).length;

    function impair(value) {
        return value % 2 !== 0;
    }
    windw.content.forEach((content, i) => {
      //click sur le text
      if(!content[2]){
        this.sqlite.req('select *  from langues where langue_nom like ?' , ["%" + language +"%"], (e, r) => {
          if(r && r.code_langue) {
            if(!impair(clickId-startClick) && i == ((clickId-startClick)/2) -1) {
              _translate.translateText(content[1], r.code_langue).then((data) => {
            //console.log(windw.content[i][1], data.text)
                content[1] = data.text
                content[2] = true
              })
            }

            //clikc sur le nom
            if(impair(clickId-startClick) && i == ((clickId+1-startClick)/2) -1) {
              _translate.translateText(content[1], r.code_langue).then((data) => {
                content[1] = data.text
                content[2] = true
              })
            }
            this.initChatTimer(windw)
          }
        })
      }
    })
  }

  injectHistory(windw){
    var tmp = []
    for(var a in windw.contentHistory){
      if(windw.contentHistory[a][0] == "assistant" ){
        if(windw.contentHistory[a-1][0] == "user")
          tmp[tmp.length] = JSON.parse(JSON.stringify(windw.contentHistory[a-1]));

        tmp[tmp.length] = JSON.parse(JSON.stringify(windw.contentHistory[a]));
        if(windw.contentHistory[a-1][0] != "user")
          tmp[tmp.length-1][0] = JSON.parse(JSON.stringify(windw.contentHistory[a-1][0]));
      }
    }

    var currentSize = tmp.length;
    //windw.content = []

    if (currentSize <= this.settings.chatMaxLine) {
      windw.content = tmp
      return
    }

    for (var a = 0; a != this.settings.chatMaxLine; a++){
      windw.content[windw.content.length] = tmp[(currentSize-this.settings.chatMaxLine)+a];
    }
  }

  initChatTimer(windw, buttonLength = this.indexed(this.windw).length){
    if(windw.timeOut) clearTimeout(windw.timeOut);
    if(windw.interval) clearInterval(windw.interval);

    var intervalInt = this.settings.intervalInt;
    var inSim = this.inSim
    var inSimTools = this.inSimTools
    var player = this.player
    var startClickId = this.#startClickId
    windw.timeOut = setTimeout(function(){
        windw.interval = setInterval(function(){
          console.log("initChatTimerLoop")
          var curPoseClick = startClickId + (windw.content.length * 2) + buttonLength + (windw.prompt ? 2: 0)

          for (var i = 0; i != 2; i++) {
            console.log(curPoseClick)
            inSimTools.deletButton(player.UCID, (!i ? curPoseClick : curPoseClick -1))
          }

          windw.content.shift();
          
          if(windw.content.length == 0) clearInterval(windw.interval)
        }, intervalInt);
    }, this.settings.timeOutInt);
  }

  addToWindwHistory(windw, data) {
    windw.contentHistory[windw.contentHistory.length] = [data[0], data[1]];
  }

  addToWindw(windw, data){
    for (var a in data[1]) 
      windw.content[windw.content.length] = [data[0], data[1][a]];
  }

  userMessage(packet, player) {
    let msg = packet.Msg.replace(/\^./g, '').split(" : "); 

    if(msg[1] != " ") {

      this.addToWindw(this.windw["Global"], ["["+player.extra.code_langue.toUpperCase()+"]"+msg[0] , [msg[1]]]);
      this.addToWindwHistory(this.windw["Global"], ["["+player.extra.code_langue.toUpperCase()+"]"+msg[0], msg[1]]);
      this.addToWindwHistory(this.windw["Global"], ["assistant", msg[1]]);
      this.initChatTimer(this.windw["Global"]);
    }
  }

  systemMessage(packet){
    let msg = packet.Msg.split("^8");
    if(!msg[1]) msg = ["System", packet.Msg];

    this.addToWindw(this.windw["System"], [this.player.PName, [msg[1]]]);
    this.addToWindwHistory(this.windw["System"], [this.player.PName, msg[1]]);
    this.addToWindwHistory(this.windw["System"], ["assistant", msg[1]]);
    this.initChatTimer(this.windw["System"])
  }

  clearHistory(windw){
    windw.contentHistory = []
    windw.prompt.contentHistory = []
  }

  clearScreen(packet, start = 0, windw){
    var maxClickId = start + (windw.content.length*2) /*+(windw.prompt ? 2: 0)*/ + (start != this.#startClickId ? 0 : this.indexed(this.windw).length) +1;
    //var maxClickId = this.#startClickId+(this.settings.chatMaxLine*2) + this.indexed(this.windw).length+(windw.prompt ? 2: 0);

    console.log("rm de", start,"+", (windw.content.length*2),"+",/*(windw.prompt ? 2: 0),"+",*/ (start != this.#startClickId ? 0 : this.indexed(this.windw).length)+1, "=", maxClickId)
    for (var i = start; i <= maxClickId; ++i) {
      this.inSimTools.deletButton(packet.UCID, i)
    }
  }

  draw(lineHeight = 4, labelWidth = 50, nameWidth = 10){
    var settings = this.settings
    var inSimTools = this.player.inSimTools;
    var sWindw = []
    var b = 0;

    for(var a in this.player.chat.windw){
      this.player.chat.clearWindwContent(this.player.chat.windw[a]);
    } 


    //theoriquement il est intialiser et calculer que a la premiere execution donc l'allocation de button vide ne pause pas de probleme
    if(this.#startClickId === null) {
      this.#startClickId = this.player.inSimTools.getCurClickId();
    } else
      for (var a in this.windw) {
        if(this.windw[a].selected) {
          if(this.player.inSimTools.getCurClickId() < this.#startClickId) { 
            this.clearScreen(this.player, this.#startClickId, this.windw[a]);
            console.log("new startid", this.player.inSimTools.getCurClickId())
            this.#startClickId = this.player.inSimTools.getCurClickId()
          }
        }
      }

    var reserv = this.indexed(this.windw).length + (settings.chatMaxLine*2) + 2 

    for (var a = this.#startClickId ; a != reserv+1; a++){
      inSimTools.reservClickID(this.player.UCID, a, 999)
    }

    var clickId = this.#startClickId
    for (var a in this.windw) {
      clickId = clickId+1
      inSimTools.createButton(a, this.player.UCID, clickId, clickId, settings.top - lineHeight, settings.left + (nameWidth*b), nameWidth, lineHeight, 0, ButtonStyle.ISB_DARK | ButtonStyle.ISB_LEFT | ButtonStyle.ISB_CLICK | (this.windw[a].selected ? ButtonTextColour.TITLE_COLOUR : ButtonTextColour.SELECTED_TEXT), this.player.extra.Language)

      if(this.windw[a].selected)
        sWindw = this.windw[a]

      b++;   
    }


    if(typeof sWindw.prompt != 'undefined') {
      var top = settings.top+(lineHeight*settings.chatMaxLine);
      var leftPrompt = settings.left;
      var widthPrompt = nameWidth +labelWidth - 10;
      var leftButton = settings.left + nameWidth +labelWidth - 10;
      var widthButton = 10;

      var lastLine = this.#startClickId+(settings.chatMaxLine*2) + this.indexed(this.windw).length;

      inSimTools.createButton("Say : "  + (!sWindw.prompt.lastResp[0] ? "" : sWindw.prompt.lastResp[0]), this.player.UCID,  ++clickId, sWindw.prompt.pid, top, leftPrompt, widthPrompt, lineHeight, 90, ButtonStyle.ISB_DARK | ButtonStyle.ISB_LEFT | ButtonStyle.ISB_CLICK | ButtonTextColour.SELECTED_TEXT, this.player.extra.Language)
      sWindw.prompt.pid = clickId;
      inSimTools.createButton("Send", this.player.UCID,  ++clickId, sWindw.prompt.sid, top, leftButton, widthButton, lineHeight, 0, ButtonStyle.ISB_DARK | ButtonStyle.ISB_LEFT | ButtonStyle.ISB_CLICK | ButtonTextColour.SELECTED_TEXT, this.player.extra.Language)
      sWindw.prompt.sid = clickId;
    } 

    const leftText = nameWidth + settings.left;
    const maxHeight = settings.top + (lineHeight * settings.chatMaxLine);

    for (var index in sWindw.content){
      var topp = settings.top + lineHeight * index;
      topp = (topp >= maxHeight ? maxHeight : topp);

      clickId = clickId+2
      for (var i = 0; i != 2; i++) {
        /*console.log(sWindw.content)*/
        inSimTools.createButton(sWindw.content[index][i], this.player.UCID, (!i ? clickId-1 : clickId), 999, topp, (!i ? settings.left : leftText), (!i ? nameWidth : labelWidth), lineHeight, 0/*(!i ? 90 : 0)*/, ButtonStyle.ISB_DARK |ButtonStyle.ISB_CLICK| ButtonStyle.ISB_LEFT | (!i ? ButtonTextColour.TITLE_COLOUR : ButtonTextColour.SELECTED_TEXT))
      }
    }

  }

  buttonAction(packet, callback) {
    var indexed = this.indexed;
    var windw =  this.windw
    var settings =  this.settings
    
    // selection des onglet
    if(packet.ClickID <= this.#startClickId + indexed(windw).length) {
      if(!windw[indexed(windw)[packet.ClickID-this.#startClickId-1]]) return;
      var oldSelected = null

      for (var b in windw) {
        if(windw[b].selected) oldSelected = windw[b]
        windw[b].selected = false;
      }

      windw[indexed(windw)[packet.ClickID-this.#startClickId-1]].selected = true;
      this.injectHistory(windw[indexed(windw)[packet.ClickID-this.#startClickId-1]])
      //this.initChatTimer(windw[indexed(windw)[packet.ClickID-this.#startClickId-1]], indexed(windw).length)

      clearTimeout(oldSelected.timeOut)
      clearInterval(oldSelected.interval)
      var prompt = windw[indexed(windw)[packet.ClickID-this.#startClickId-1]].prompt
      this.initChatTimer(windw[indexed(windw)[packet.ClickID-this.#startClickId-1]])
      this.clearScreen(packet, this.#startClickId + indexed(windw).length+1+(prompt ? 2 :0), oldSelected) // la condition prompt provoque un lag dans le delet de la premiere ligne

    } else {
      var lang = this.inSimTools.getLanguageStr(this.player.extra.Language)
      this.translate(windw["Global"], packet.ClickID, lang[0]+lang[1])
    }

    //si c'est un pormpt
    for (var a in windw) {
      if (typeof windw[a].prompt == "undefined") continue;

      if(packet.ClickID == windw[a].prompt.sid && windw[a].selected){
        if(windw[a].prompt.sendToChat) {
          this.inSimTools.sendToChat(packet.UCID, windw[a].prompt.lastResp[0])
        }
        windw[a].prompt.lastResp = "";
      }

      if(packet.ClickID == windw[a].prompt.pid && windw[a].selected) {
        if(!windw[a].prompt.validation) {
          windw[a].prompt.lastResp = "";
          this.addToWindw(windw[a], [this.player.PName.replace(/\^./g, ''), [packet.Text]])
          this.addToWindwHistory(windw[a], [this.player.PName.replace(/\^./g, ''), packet.Text]);
          this.addToWindwHistory(windw[a], ["assistant", packet.Text]);
          this.initChatTimer(windw[a], indexed(windw).length)

          callback(a);
        }      
      }
    }
  }

}

module.exports = { chat: chat };