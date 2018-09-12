const Client                = require('castv2-client').Client;
const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
const googletts             = require('google-tts-api');

const getSpeechUrl = function(text, language, options, callback) {
    googletts(text, language, 1).then( (url) => {
        doPlay(url, 'audio/mp3', options, (res) =>{
            callback(url);
        });        
    }).catch( (err) => {
      console.error(err.stack);
    });
  };

const doPlay = function(url, type, options, callback) {
    var client = new Client();
    client.connect(options.ip, options.port, function() {
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
                if(err) console.log("there was an error setting the volume")
                console.log("volume changed to %s", Math.round(newvol.level * 100))
            });
        } else
        if(typeof options.lowerVolumeLimit !== 'undefined' || typeof options.upperVolumeLimit !== 'undefined') {
            client.getVolume(function(err, newvol){
                var obj = { level: options.upperVolumeLimit };
                if (options.upperVolumeLimit !== 'undefined' && (newvol.level > options.upperVolumeLimit)) {
                    obj = { level: options.upperVolumeLimit };
                } else if (typeof options.lowerVolumeLimit !== 'undefined' && (newvol.level < options.lowerVolumeLimit)) {
                    obj = { level: options.lowerVolumeLimit };
                }
                client.setVolume(obj, function(err, newvol){
                    if(err) console.log("there was an error setting the volume")
                    console.log("volume changed to %s", Math.round(newvol.level * 100))
                });                
            });
        }
       
        
        if (typeof options.muted !== 'undefined') {
            client.setVolume({ muted: (options.muted == true) }, function(err, newvol){
                if(err) console.log("there was an error setting the volume")
                console.log("volume changed to %s", Math.round(newvol.level * 100))
            });
        }

        player.load(media, { autoplay: true }, (err, status) => {
          client.close();
          if (err) {
            node.error('Error:' + err.message);
            node.status({fill:"red",shape:"dot",text:"error"});              
          }
          callback(status);
        });
      });
    });
  
    client.on('error', (err) => {
      node.error('Error:' + err.message);
      node.status({fill:"red",shape:"dot",text:"error"});        
      client.close();
      callback('error');
    });
  };

module.exports = function(RED) {
    'use strict';
    function CastNode(config) {
        RED.nodes.createNode(this,config);
        // node-specific code goes here
        var node = this;
        
        this.on('input', function (msg) {
            //-----------------------------------------
            //Error Handling
            if (!Client) {
                this.error('Client not defined!! - Installation Problem, Please reinstall!');
                return;
            }
            
            if (!DefaultMediaReceiver) {
                this.error('DefaultMediaReceiver not defined!! - Installation Problem, Please reinstall!');
                return;
            }
            
            if (!googletts) {
                this.error('googletts not defined!! - Installation Problem, Please reinstall!');
                return;
            }
            /********************************************
            * versenden:
            *********************************************/
            var creds = RED.nodes.getNode(config.creds);
            let attrs = ['url', 'contentType', 'message', 'language', 'ip', 'port', 'volume', 'lowerVolumeLimit', 'upperVolumeLimit', 'muted'];
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
            } else if (typeof msg.payload === 'string') {
                if (data.contentType && !msg.url && !config.url) {
                    data.url = msg.payload;
                } else {
                    data.message = msg.payload;
                }
            }
            //----------------------------------
            if (typeof data.ip === 'undefined') {
                this.error("configuraton error: IP is missing!");
                return;
            }
            if (typeof data.port === 'undefined') {
                data.options.port = 8009;
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

            try {
                msg.payload = data;

                if (data.contentType && data.url) {
                    this.status({fill:"green",shape:"dot",text:"play from url (" + data.contentType + ")"});
                    doPlay(data.url, data.contentType, data, (res) =>{
                        if (data.message && data.language) {
                            this.status({fill:"green",shape:"ring",text:"play message"});
                            getSpeechUrl(data.message, data.language, data, (resurl) => {
                                    msg.payload.result = res;
                                    node.send(msg);
                                });
                            return;
                        }
                        msg.payload.result = res;
                        node.send(msg);
                    });
                    return;
                }

                if (data.message && data.language) {
                    this.status({fill:"green",shape:"ring",text:"play message"});
                    getSpeechUrl(data.message, data.language, data, (resurl) => {
                            node.send(msg);
                        });
                    return;
                }
            } catch (err) {
                this.error('Exception occured on playing cromecast oputput! ' + err.message);
                this.status({fill:"red",shape:"dot",text:"error"});
            }
            this.error('Can not play on cast device!');
            return;
        });
    }

    RED.nodes.registerType('cast-to-client', CastNode);
};
