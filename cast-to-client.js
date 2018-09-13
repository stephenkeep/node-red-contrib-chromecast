/********************************************
* cast-to-client:
*********************************************/
const Client                = require('castv2-client').Client;
const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
const googletts             = require('google-tts-api');

const getSpeechUrl = function(text, language, options, callback) {
    googletts(text, language, 1).then( (url) => {
        doPlay(url, 'audio/mp3', options, (res, data) =>{
            callback(url, data);
        });        
    }).catch( (err) => {
      console.error(err.stack);
    });
  };

const doPlay = function(url, type, options, callback) {
    var client = new Client();
    
    const doConnect =  function() {
      client.launch(DefaultMediaReceiver, (err, player) => {
  
        var media = {
          contentId: url,
          contentType: type,
          streamType: 'BUFFERED' // or LIVE
        };
        if(typeof options.volume !== 'undefined') {
            var obj = {};
            if(options.volume > 0.0){
                obj = { level: options.volume/100 };
            } else {
                obj = { muted: true };
            }
            client.setVolume(obj, function(err, newvol){
                if(err) console.log("there was an error setting the volume");
                console.log("volume changed to %s", Math.round(newvol.level * 100));
            });
        } else if(typeof options.lowerVolumeLimit !== 'undefined' || typeof options.upperVolumeLimit !== 'undefined') {
            client.getVolume(function(err, newvol){
                options.oldVolume = newvol.level * 100;
                if (options.upperVolumeLimit !== 'undefined' && (newvol.level > (options.upperVolumeLimit / 100))) {
                    newvol.level = options.upperVolumeLimit/100;
                    client.setVolume(newvol, function(err, newvol){
                        if(err) console.log("there was an error setting the volume");
                        console.log("volume changed to %s", Math.round(newvol.level * 100));
                    });
                } else if (typeof options.lowerVolumeLimit !== 'undefined' && (newvol.level < (options.lowerVolumeLimit / 100))) {
                    newvol.level = options.lowerVolumeLimit/100;
                    client.setVolume(newvol, function(err, newvol){
                        if(err) console.log("there was an error setting the volume");
                        console.log("volume changed to %s", Math.round(newvol.level * 100));
                    });
                }

                
            });
        }

        if (typeof options.muted !== 'undefined') {
            client.setVolume({ muted: (options.muted === true) }, function(err, newvol){
                if(err) console.log("there was an error setting the volume");
                console.log("volume changed to %s", Math.round(newvol.level * 100));
            });
        }

        player.load(media, { autoplay: true }, (err, status) => {
          client.close();
          if (err) {
            node.error('Error:' + err.message);
            node.status({fill:"red",shape:"dot",text:"error"});              
          }
          callback(status, options);
        });
      });
    };

    if (typeof options.port === 'undefined') {
        client.connect(options.ip, doConnect);
    } else {
        client.connect(options.ip, options.port,doConnect);
    }

    client.on('error', (err) => {
      node.error('Error:' + err.message);
      node.status({fill:"red",shape:"dot",text:"error"});        
      client.close();
      callback('error');
    });
  };

module.exports = function(RED) {
    function CastNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        
        this.on('input', function (msg) {
            //-----------------------------------------
            //Error Handling
            if (!Client) {
                this.error('Client not defined!! - Installation Problem, Please reinstall!');
                this.status({fill:"red",shape:"dot",text:"installation error"});
                return;
            }
            
            if (!DefaultMediaReceiver) {
                this.error('DefaultMediaReceiver not defined!! - Installation Problem, Please reinstall!');
                this.status({fill:"red",shape:"dot",text:"installation error"});
                return;
            }
            
            if (!googletts) {
                this.error('googletts not defined!! - Installation Problem, Please reinstall!');
                this.status({fill:"red",shape:"dot",text:"installation error"});
                return;
            }
            /********************************************
            * versenden:
            *********************************************/
            //var creds = RED.nodes.getNode(config.creds); - not used
            let attrs = ['url', 'contentType', 'message', 'language', 'ip', 'port', 'volume', 'lowerVolumeLimit', 'upperVolumeLimit', 'muted', 'delay'];
            
            var data = {};
            for (var attr of attrs) {
                if (config[attr]) {
                    data[attr] = config[attr];
                }
                if (msg[attr]) {
                    data[attr] = msg[attr];
                }
            }

            if (typeof msg.payload === 'object') {
                for (var attr of attrs) {
                    if (msg.payload[attr]) {
                        data[attr] = msg.payload[attr];
                    }
                }
            } else if (typeof msg.payload === 'string' && msg.payload.trim() !== "") {
                if (data.contentType && !msg.url && !config.url) {
                    data.url = msg.payload;
                } else {
                    data.message = msg.payload;
                }
            }
            //----------------------------------
            if (typeof data.ip === 'undefined') {
                this.error("configuraton error: IP is missing!");
                this.status({fill:"red",shape:"dot",text:"No IP given!"});
                return;
            }
            if (typeof data.language === 'undefined') {
                data.language = 'en';
            }
            if (typeof data.volume !== 'undefined' && !isNaN(data.volume) && data.volume !== '') {
                data.volume = parseInt(data.volume);
            } else {
                delete data.volume;
            }
            if(typeof data.lowerVolumeLimit !== 'undefined' && !isNaN(data.lowerVolumeLimit) && data.lowerVolumeLimit !== '') {
                data.lowerVolumeLimit = parseInt(data.lowerVolumeLimit);
            } else {
                delete data.lowerVolumeLimit;
            }
            if(typeof data.upperVolumeLimit !== 'undefined' && !isNaN(data.upperVolumeLimit) && data.upperVolumeLimit !== '') {
                data.upperVolumeLimit = parseInt(data.upperVolumeLimit);
            } else {
                delete data.upperVolumeLimit;
            }
            if (typeof data.delay === 'undefined' || isnan(data.delay) || (data.delay < 1000)) {
                data.delay = 250;
            }
            try {
                msg.payload = data;

                if (data.contentType && data.url) {
                    this.status({fill:"green",shape:"dot",text:"play from url (" + data.contentType + ") on " + data.ip});
                    doPlay(data.url, data.contentType, data, (res, data2) =>{
                        msg.payload.result = res;
                        if (data2.message && data2.language) {
                            setTimeout((data3) => {
                                this.status({fill:"green",shape:"ring",text:"play message on " + data3.ip});
                                getSpeechUrl(data3.message, data3.language, data3, (sres, data) => {
                                        msg.payload.speechResult = sres;
                                        this.status({fill:"green",shape:"dot",text:"ok"});
                                        node.send(msg);
                                    });
                            }, data2.delay, data2); 
                            return null;
                        }
                        this.status({fill:"green",shape:"dot",text:"ok"});
                        node.send(msg);
                    });
                    return null;
                }

                if (data.message && data.language) {
                    this.status({fill:"green",shape:"ring",text:"play message on " + data.ip});
                    getSpeechUrl(data.message, data.language, data, (sres) => {
                            msg.payload.speechResult = sres;
                            this.status({fill:"green",shape:"dot",text:"ok"});
                            node.send(msg);
                        });
                        return null;
                }
            } catch (err) {
                this.error('Exception occured on playing cromecast oputput! ' + err.message);
                this.status({fill:"red",shape:"dot",text:"error"});
            }
            this.error('Can not play on cast device!');
            return null;
        });
    }

    RED.nodes.registerType('cast-to-client', CastNode);
};
