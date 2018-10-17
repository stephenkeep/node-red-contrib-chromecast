/********************************************
* cast-to-client:
*********************************************/
const Client                = require('castv2-client').Client;
const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
const googletts             = require('google-tts-api');

const getSpeechUrl = function(node, text, language, options, callback) {
    googletts(text, language, 1).then( (url) => {
        if (node) { node.debug("returned tts media url='" + url + "'"); }
        let media = {
            contentId: url,
            contentType: 'audio/mp3',
            streamType: 'BUFFERED' // or LIVE
          };
        doPlay(node, media, options, (res, data) =>{
            callback(url, data);
        });        
    }).catch( (err) => {
        if (err) {
            var msg = 'Not able to get media file via google-tts';
            if (err.message) { msg += ':' + err.message; } else { msg += '! (unknown error message!)'; }
            
            if (node) {
                node.error(msg);
                node.debug(JSON.stringify(err, Object.getOwnPropertyNames(err)));
                if(err.stack) { node.error(err.stack); }
                node.status({fill:"red",shape:"ring",text:"error in tts"});
            }
        }
    });
  };

const doPlay = function(node, media, options, callback) {
    var client = new Client();

    const doConnect =  function() {
      client.launch(DefaultMediaReceiver, (err, player) => {

        const doSetVolume = function(volume) {
            var obj = {};
            if(volume < 0.01){
                obj = { muted: true };
            } else if(volume > 0.99){
                obj = { level: 1 };
            } else {
                obj = { level: volume };
            }
            if (node) { node.debug("try to set volume " + JSON.stringify(obj)); }
            client.setVolume(obj, function(err, newvol){
                if(err) {
                    var msg = 'Not able to set the volume';
                    if (err.message) { msg += ':' + err.message; } else { msg += '! (unknown error message!)'; }
                    
                    if (node) {
                        node.error(msg);
                        node.debug(JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        if(err.stack) { node.error(err.stack); }
                    }
                } else if (node) {
                    node.log("volume changed to %s", Math.round(volume.level * 100));
                }
            });
        }
        try {

            if(typeof options.volume !== 'undefined') {
                doSetVolume(options.volume);
            } else if(typeof options.lowerVolumeLimit !== 'undefined' || typeof options.upperVolumeLimit !== 'undefined') {
                //eventually player.getVolume --> https://developers.google.com/cast/docs/reference/receiver/cast.receiver.media.Player
                client.getVolume(function(err, newvol){
                    if (node) { node.debug("volume get from client " + JSON.stringify(newvol)); }
                    options.oldVolume = newvol.level * 100;
                    options.muted = (newvol.level < 0.01);
                    if (options.upperVolumeLimit !== 'undefined' && (newvol.level > options.upperVolumeLimit)) {
                        doSetVolume(options.upperVolumeLimit);
                    } else if (typeof options.lowerVolumeLimit !== 'undefined' && (newvol.level < options.lowerVolumeLimit)) {
                        doSetVolume(options.lowerVolumeLimit);
                    }
                });
            }

            if (typeof options.muted !== 'undefined') {
                doSetVolume({ muted: (options.muted === true) });
            }

            
            if (typeof options.pause !== 'undefined' && options.pause === true) {
                if (node) { node.debug("sending pause signal to player"); }
                client.getSessions(function(err, sessions) {
                    const session = sessions[0];
                        client.join(session, DefaultMediaReceiver, function(err, app) {
                            if (!app.media.currentSession){
                                app.getStatus(function() {
                                    app.pause();
                                });
                            } else {
                                app.pause();
                            }
                        });
                    });
            }

            if (typeof options.stop !== 'undefined' && options.stop === true) {
                if (node) { node.debug("sending pause signal to player"); }
                client.getSessions(function(err, sessions) {
                    const session = sessions[0];
                        client.join(session, DefaultMediaReceiver, function(err, app) {
                            if (!app.media.currentSession){
                                app.getStatus(function() {
                                    app.stop();
                                });
                            } else {
                                app.stop();
                            }
                        });
                    });
            }

            if (typeof media === 'object' &&
                typeof media.contentId !== 'undefined' &&
                typeof media.contentType !== 'undefined') {
                if (node) { node.debug("loading player with media='" + JSON.stringify(media) + "'"); }
                player.load(options.media, { autoplay: true }, (err, status) => {
                    client.close();
                    if (err) {
                        var msg = 'Not able to load media';
                        if (err.message) { msg += ':' + err.message; } else { msg += '! (unknown error message!)'; }
                        
                        if (node) {
                            node.error(msg);
                            node.debug(JSON.stringify(err, Object.getOwnPropertyNames(err)));
                            if(err.stack) { node.error(err.stack); }
                            node.status({fill:"red",shape:"ring",text:"error load media"});
                        }
                    }
                    callback(status, options);
                });
            }
        } catch (errm) {
            if (errm) {
                var msg = 'Exception occured on load media';
                if (errm.message) { msg += ':' + errm.message; } else { msg += '! (unknown error message!)'; }
                
                if (node) {
                    node.error(msg);
                    node.debug(JSON.stringify(errm, Object.getOwnPropertyNames(errm)));
                    if(errm.stack) { node.error(errm.stack); }
                    node.status({fill:"red",shape:"ring",text:"exception load media"});
                }
            }
        }        
      });
    };

    if (typeof options.port === 'undefined') {
        if (node) { node.debug("connect to client ip='" + options.ip + "'"); }
        client.connect(options.ip, doConnect);
    } else {
        if (node) { node.debug("connect to client ip='" + options.ip + "' port='" + options.port + "'"); }
        client.connect(options.ip, options.port,doConnect);
    }

    client.on('error', (err) => {
        client.close();
        var msg = 'Client error reported';
        if (err.message) { msg += ':' + err.message; } else { msg += ', but no error message given! (unknown error message!)'; }
        
        if (node) {
            node.error(msg);
            node.debug(JSON.stringify(err, Object.getOwnPropertyNames(err)));
            node.status({fill:"red",shape:"ring",text:"client error"});
        }
        //callback('error', options);
    });
  };

module.exports = function(RED) {
    function CastNode(config) {
        RED.nodes.createNode(this,config);
        //var node = this;
        
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
            let attrs = ['url', 'contentType', 'message', 'language', 'ip', 'port', 'volume', 'lowerVolumeLimit', 'upperVolumeLimit', 'muted', 'delay', 'stop', 'pause'];

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
            if (typeof data.language === 'undefined' || data.language === '' ) {
                data.language = 'en';
            }
            if (typeof data.volume !== 'undefined' && !isNaN(data.volume) && data.volume !== '') {
                data.volume = parseInt(data.volume) / 100;
            } else {
                delete data.volume;
            }
            if(typeof data.lowerVolumeLimit !== 'undefined' && !isNaN(data.lowerVolumeLimit) && data.lowerVolumeLimit !== '') {
                data.lowerVolumeLimit = parseInt(data.lowerVolumeLimit) / 100;
            } else {
                delete data.lowerVolumeLimit;
            }
            if(typeof data.upperVolumeLimit !== 'undefined' && !isNaN(data.upperVolumeLimit) && data.upperVolumeLimit !== '') {
                data.upperVolumeLimit = parseInt(data.upperVolumeLimit) / 100;
            } else {
                delete data.upperVolumeLimit;
            }
            if (typeof data.delay !== 'undefined' && !isNaN(data.delay) && data.delay !== '') {
                data.delay =  parseInt(data.delay);
            } else {
                data.delay = 250;
            }

            if (typeof data.contentType !== 'undefined' && typeof data.url !== 'undefined') {
                this.debug("initialize playing url='" + data.url + "' of contentType='" + data.contentType + "'");
                data.media = {
                    contentId: data.url,
                    contentType: data.contentType || 'audio/mp3',
                    streamType: 'BUFFERED' // or LIVE
                  };
            }

            try {
                msg.payload = data;
                this.debug('start playing on cast device');
                this.debug(JSON.stringify(data));

                if (data.media) {
                    this.debug("initialize playing on ip='" + data.ip + "'");
                    this.status({fill:"green",shape:"dot",text:"play (" + data.contentType + ") on " + data.ip + " [url]"});

                    doPlay(this, data.media, data, (res, data2) =>{
                        msg.payload.result = res;
                        if (data2 && data2.message) {
                            setTimeout((data3) => {
                                this.status({fill:"green",shape:"ring",text:"play message on " + data3.ip});
                                getSpeechUrl(data3.message, data3.language, data3, (sres, data) => {
                                        msg.payload.speechResult = sres;
                                        this.status({fill:"green",shape:"dot",text:"ok"});
                                        this.send(msg);
                                    });
                            }, data2.delay, data2); 
                            return null;
                        }
                        this.status({fill:"green",shape:"dot",text:"ok"});
                        this.send(msg);
                    });
                    return null;
                }

                if (data.message) {
                    this.debug("initialize getting tts message='" + data.message + "' of language='" + data.language + "'");
                    this.status({fill:"green",shape:"ring",text:"play message on " + data.ip});
                    getSpeechUrl(this, data.message, data.language, data, (sres) => {
                            msg.payload.speechResult = sres;
                            this.status({fill:"green",shape:"dot",text:"ok"});
                            this.send(msg);
                        });
                        return null;
                }

                if (data.stop || data.pause || data.volume) {
                    this.debug("only sending requestz to ip='" + data.ip + "'");
                    this.status({fill:"yellow",shape:"dot",text:"setting status on " + data.ip});

                    doPlay(this, null, data, (res, data2) =>{
                        msg.payload.result = res;
                        this.status({fill:"green",shape:"dot",text:"ok"});
                        this.send(msg);
                    });
                    return null;
                }
            } catch (err) {
                this.error('Exception occured on playing cromecast oputput! ' + err.message);
                this.status({fill:"red",shape:"dot",text:"error"});
                return null;
            }
            this.error("Input paameter wrong or missing. You need to setup (or give in the input message) the 'url' and 'content type' or the 'message' and 'language'!!");
            this.status({fill:"red",shape:"dot",text:"error - input parameter"});
            return null;
        });
    }

    RED.nodes.registerType('cast-to-client', CastNode);
};
