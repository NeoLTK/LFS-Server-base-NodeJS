const { InSim } = require('node-insim');
const {
  ButtonStyle,ButtonTextColour,
  IS_BTN, IS_MSX, IS_ISI_ReqI, IS_ISM, IS_TINY, IS_BFN, IS_NPL, IR_HLR, IS_PLP,
  TinyType, PacketType, InSimFlags, ButtonFunction, Language ,
} = require('node-insim/packets');
const fs = require('fs');

const { llm } = require('./llm.js'); 
const { chat } = require('./chat.js'); 
const { inSimTools } = require('./inSimTools.js'); 
const { cmd } = require('./cmd.js'); 
const { dash } = require('./dash.js'); 
const { topBar } = require('./topBar.js'); 
const { sqlite } = require('./sqlite.js'); 
const { wallet } = require('./wallet.js'); 
const { spawn } = require('./spawn.js'); 

class inSimServ {

  constructor(name, ip, port, passwd){
    this.inSim = new InSim();
    this.players = Array();

    this.cmd = new cmd(this.inSim, this.players);
    this.sqlite = new sqlite();

    this.inSimConnect(name, ip, port, passwd);
    this.initEvents();
  }

  inSimConnect(name, ip, port, psswd){
    this.inSim.connect({
      IName: name,
      Host: ip,
      Port: port,
      ReqI: IS_ISI_ReqI.SEND_VERSION,
      Admin: psswd, 
      Flags: InSimFlags.ISF_RES_0 | InSimFlags.ISF_RES_1 | InSimFlags.ISF_MCI | InSimFlags.ISF_AXM_EDIT | InSimFlags.ISF_AXM_LOAD | InSimFlags.ISF_MSO_COLS | InSimFlags.ISF_CON | InSimFlags.ISF_REQ_JOIN | InSimFlags.ISF_OBH | InSimFlags.ISF_HLV | InSimFlags.ISF_NLP,
    });
  }

  initEvents() {
    this.cmd.create('!help', 'draw help', 0, (packet, args) => {
      var player = this.players.find(player => player.UCID === packet.UCID) 
      player.inSimTools.sendSystemToPlayerSync(player, "Welcome !, The server is in development and open for testing.")
      player.inSimTools.sendSystemToPlayerSync(player, "he will not ready before some time.")

      player.dash.create("Welcome to LFS International server", this.welcomeMessage(), (index, flag) => {
        if(flag > 0) player.dash.closeModal(index); 
        else player.dash.closeModal(index); 
      });
    })

    this.cmd.create('!createspawn','create spawn point ( !createspawn {spawn name} )', 1, (packet, args) => {
      var player = this.players.find(player => player.UCID === packet.UCID) 
      if(!player.PLID || !player.position) {
        player.inSimTools.sendSystemToPlayerSync(player, "PLID not set, go to pit for set it", 4)
        return
      }
      if(!args) {
        player.inSimTools.sendSystemToPlayerSync(player, "Please name you spawn", 4)
        return
      }

      if(player.riding) {
        player.inSimTools.sendSystemToPlayerSync(player, "Please stop your car", 4)
        return
      }

      player.spawn.set(args, player.position.x, player.position.y, player.position.z)
      player.inSimTools.sendSystemToPlayerSync(player, "Spawn "+args+" set with success")
    })


    this.inSim.on('connect', () => {
      inSimTools.getAllUser(this.inSim)
      inSimTools.getAllUserExtra(this.inSim)
      inSimTools.createObject(this.inSim) // tryhard mais marche pas

      setInterval(() => {
        this.players.forEach((player) => {
          if(player.extra) {
            if(player.chat) player['chat'].draw();
            if(player.dash) player['dash'].draw(); 
            if(player.topBar) player['topBar'].draw(); 

            if(Math.floor(new Date().getTime() / 1000) - player.dUpdate >= 600) {
              console.log(Math.floor(new Date().getTime() / 1000) - player.dUpdate)
              player.dUpdate = Math.floor(new Date().getTime() / 1000)

              player.wallet.set(100, "time reward");
              player.inSimTools.sendSystemToPlayerSync(player, "Congratulations !, Your game time has earned you 100$")
            }
          }
        }) 
      }, 200);
    });

    this.inSim.on('disconnect', () => { console.log('Disconnected'); });

    for (var a in PacketType){
      this.inSim.on(a, (packet) => {
        if (typeof  this.inSimRecev()[packet.constructor.name] === "function") {
          this.inSimRecev()[packet.constructor.name](packet)
        }
        else console.log(Math.floor(new Date().getTime() / 1000) , "Packet not supported", packet)
      });
    }
  }

  inSimRecev() {
    return {
      //version
      IS_VER: (packet) => {
      },
      //new connexion
      IS_NCN: (packet) => {
        if(this.playerExist(packet)) return;
        packet.inSimTools = new inSimTools(this.inSim)
        packet.dCreate =  Math.floor(new Date().getTime() / 1000);
        packet.dUpdate =  Math.floor(new Date().getTime() / 1000);

        this.players.push(packet);


      },
      //extra new connexion
      IS_NCI: (packet) =>  {
        this.players.forEach((player, index) => {
          if (player.UCID == packet.UCID && !player.extra) {
            player.extra = packet;

            var strLanguage = player.inSimTools.getLanguageStr(player.extra.Language);
            player.extra.str_langue = strLanguage;

            this.sqlite.req('select count(*) as count, *  from penality where UserID = ?' , [player.extra.UserID], (e, r) => {
              if(r.count > 0 && r.loop) {
                var text = ""
                for (var a = 0; a != 50; a++) 
                  player.inSimTools.sendSystemToPlayer(player, r.raison,  false, false, 4)
                player.inSimTools.sendSystemToPlayer(player, `┌∩┐(>﹏<)┌∩┐`, false, false, 4)
                player.inSimTools.textCommand("/" + r.type + " "+player.UName)
              } else

                this.sqlite.req('select *  from langues where langue_nom like ?' , ["%" + strLanguage +"%"], (e, r) => {
                  player.extra.code_langue = r.code_langue

                  player.chat = new chat(this.inSim, player);
                  player.chat.newChatTable("Global", false, false, 'translatorIn', 'translatorOut');
                  player.chat.newChatTable(strLanguage, true, false, 'translatorIn', 'translatorOut');
                  player.chat.newChatTable("System", false, false, "system");

                  player.wallet = new wallet(player);
                  player.wallet.get(() => {});
                  
                  player.topBar = new topBar(player);
                  player.topBar.create("Wallet : ", () => { return player.wallet.curAmount+"$"})
                  player.topBar.create("Jobs : ", () => {/*return player.jobs.current*/})
                  player.topBar.create("Spawn : ", () => {/*return player.jobs.current*/})
                  player.topBar.create("Wanted level : ", () => {return 0;})
                  player.dash = new dash(player)
                  player.spawn = new spawn(player);

                  
                  if(packet.ReqI != 99) {
                    setTimeout(()=>{
                      player.dash.create("Welcome to LFS International server", this.welcomeMessage(), (index, flag) => {
                        if(flag > 0) player.dash.closeModal(index); 
                        else player.inSimTools.textCommand("/kick "+ player.PName)
                      })
                    }, 500)
                  }

                 /* player.wallet.get((r) => {
                    if (r > 0) player.inSimTools.sendSystemToPlayer(player, "You have " + r + "$ in your wallet")
                  });*/

                  this.sqlite.playerExist(player.extra.UserID, (err, row) => {
                    if(row.count == 0) {
                      player.inSimTools.sendSystemToPlayerSync(player, "Welcome !,  Your account has been created")
                      player.inSimTools.sendSystemToPlayerSync(player, "The server is in development and open for testing.")
                      player.inSimTools.sendSystemToPlayerSync(player, "he will not ready before some time.")
                      this.sqlite.createPlayer(player, () => {
                        player.wallet.set(5000, "Starter Park");
                        player.inSimTools.sendSystemToPlayerSync(player, "To start well on our server, we sent you $5000.")
                      })
                    } else {
                      player.inSimTools.sendSystemToPlayerSync(player, "Welcome !, The server is in development and open for testing.")
                      player.inSimTools.sendSystemToPlayerSync(player, "he will not ready before some time.")
                    }
                  })
                })
              })
          }
        })
      },
      //connexion left
      IS_CNL: (packet) => {
        this.players.forEach((player, index) => {
          if (player.UCID == packet.UCID)
            this.players.splice(index, 1);
        })
      },
      // reception message du chat
      IS_MSO: (packet) => {
        if(this.cmd.parse(packet)) return;
        var curPlayer = this.players.find(player => player.UCID === packet.UCID) 

        this.players.forEach((player, index) => {
          if(player.UCID && player.chat) {
            if (packet.UCID || packet.PLID) 
              player.chat.userMessage(packet, curPlayer);
            else  
              player.chat.systemMessage(packet);
          }
        })
      },
      //reception des bouton text
      IS_BTT: async (packet) => {
        this.players.forEach((player, index) => {
          if(player.UCID == packet.UCID) {
            player.chat.buttonAction(packet, (wIndex) => {
              this.players.forEach((pl) => {
                //canal regions
                if(pl.UCID != 0 && ((pl.extra.Language == player.extra.Language) && pl.UCID != player.UCID)) {
                  pl.chat.addToWindw(pl.chat.windw[wIndex], [player.PName, [packet.Text]])
                  pl.chat.addToWindwHistory(pl.chat.windw[wIndex], [player.PName, packet.Text]);
                  pl.chat.addToWindwHistory(pl.chat.windw[wIndex], ["assistant", packet.Text]);
                  pl.chat.initChatTimer(pl.chat.windw[wIndex])
                }
              })
            });
          }
        })
      },
      //reception des bouton click
      IS_BTC:  async (packet) => {
        this.players.forEach((player, index) => {
          if(player.UCID == packet.UCID) {
            /// appel dynamic
            for(var a in player) {
              console.log(player[a], a)
              if(player[a] && typeof player[a].clickAction === "function") player[a].clickAction(packet)
            }

            //chat static a changer
            player.chat.buttonAction(packet, (wIndex) => {
              this.players.forEach((pl) => {
                // canal region
                if(pl.UCID != 0 && ((pl.extra.Language == player.extra.Language) && pl.UCID != player.UCID)) {
                  pl.chat.addToWindw(pl.chat.windw[wIndex], [player.PName, [packet.Text]])
                  pl.chat.addToWindwHistory(pl.chat.windw[wIndex], [player.PName, packet.Text]);
                  pl.chat.addToWindwHistory(pl.chat.windw[wIndex], ["assistant", packet.Text]);
                  pl.chat.initChatTimer(pl.chat.windw[wIndex])
                }
              })
            });
          }
        })
      },
      //sorti de stand
      IS_NPL: (packet) => {
        console.log("sortie 2", packet)
        var player = this.players.find(player => player.UCID === packet.UCID)
        player.PLID = packet.PLID;

        //si le plid a changer on le met a jours
        /*this.players.forEach((pl) => {
          if(pl.UCID != 0 && pl.UCID != packet.UCID) {
            pl.PLID = packet.PLID;
          }
        })*/

        //insert tout les voiture en db
        this.sqlite.req('select count(*) as count from car where CName like ?' , ["%"+packet.CName+"%"], (e, r) => {
          if (r && r.count == 0) this.sqlite.req('INSERT INTO car VALUES (?, 0, 0)', [packet.CName])
        })
      },
      //player left pit
      IS_PLP: (packet) => {
        //rien d'interessant ici
        //console.log("sortie de stand", packet)
      },
      IS_TINY: (packet) => {
        if(packet.Type == 3) return console.log("LFS Ping " + new Date().toISOString().slice(0, 19).replace('T', ' '))

        console.log("Packet not supported", packet)
      },
      //player start / stop car with position
      IS_CSC: (packet) => {
        var player = this.players.find(player => player.PLID === packet.PLID) 

        console.log(this.players, packet)
        if(!player) return;
        if(typeof player.position == "undefined") player.position = {}

        player.position.x = packet.C.X
        player.position.y = packet.C.Y
        player.position.z = packet.C.Zbyte
        player.riding = packet.CSCAction
        player.time = packet.Time
        //console.log(packet)
      },
      //player interect with objet
      IS_UCO: (packet) => {
        console.log(packet)
      }, 
      //mode edition
      IS_CIM: (packet) => {

      }
    }
  }

  playerExist(packet){
    var exist = false;

    this.players.forEach((player, index) => {
      if(packet.UCID == 0) return true;
      if(player.UCID == packet.UCID)
        exist = true;
    })

    return exist;
  }

  welcomeMessage(){
    try {
      return fs.readFileSync('./welcome.txt', 'utf8');
    } catch (err) {
      console.log(err);
      process.exit()
    }
  }

}

var server = new inSimServ('Node this.inSim App', '188.122.74.156', 54722, '***REMOVED***');

module.exports = { inSimServ: inSimServ };