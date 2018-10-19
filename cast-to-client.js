/********************************************
* cast-to-client:
*********************************************/
const Client                = require('castv2-client').Client;
const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;
const googletts             = require('google-tts-api');

const errorHandler = function(node, err, messageText, stateText) {
    if (!err) {
        return true;
    }
    if (err.message) {
        let msg = err.message.toLowerCase();
        if (msg.indexOf('invalid player state')>=0) {
            //Sent when the request by the sender can not be fulfilled because the player is not in a valid state. For example, if the application has not created a media element yet.
            //https://developers.google.com/cast/docs/reference/messages#InvalidPlayerState
            messageText += ':' + err.message + ' The request can not be fulfilled because the player is not in a valid state.';
        } else if (msg.indexOf('load failed')>=0) {
            //Sent when the load request failed. The player state will be IDLE.
            //https://developers.google.com/cast/docs/reference/messages#LoadFailed
            messageText += ':' + err.message + ' Not able to load the media.';
        } else if (msg.indexOf('load cancelled')>=0) {
            //Sent when the load request was cancelled (a second load request was received).
            //https://developers.google.com/cast/docs/reference/messages#LoadCancelled
            messageText += ':' + err.message + ' The request was cancelled (a second load request was received).';
        } else if (msg.indexOf('invalid request')>=0) {
            //Sent when the request is invalid (an unknown request type, for example).
            //https://developers.google.com/cast/docs/reference/messages#InvalidRequest
            messageText += ':' + err.message + ' The request is invalid (example: an unknown request type).';
        } else {
            messageText += ':' + err.message;
        }
    } else {
        messageText += '! (No error message given!)';
    }

    if (node) {
        node.error(messageText);
        node.debug(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        node.status({fill:"red",shape:"ring",text:stateText});
    } else if (console) {
        console.error(messageText);
        console.error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
    return false;
}

const getSpeechUrl = function(node, text, language, options, callback) {
    googletts(text, language, 1).then( (url) => {
        if (node) { node.debug("returned tts media url='" + url + "'"); }
        let media = {
            contentId: url,
            contentType: 'audio/mp3',
            streamType: 'BUFFERED' // or LIVE
          };
        doCast(node, media, options, (res, data) =>{
            callback(url, data);
        });
    }).catch( (err) => {
        errorHandler(node,err,'Not able to get media file via google-tts',"error in tts");
    });
  };

const doCast = function(node, media, options, callbackResult) {
    var client = new Client();

    const connectedCallback =  function() {
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
                    errorHandler(node,err,'Not able to set the volume');
                } else if (node) {
                    node.log("volume changed to %s", Math.round(volume.level * 100));
                }
            });
        }
        try {

            if(typeof options.volume !== 'undefined') {
                doSetVolume(options.volume);
            } else if(typeof options.lowerVolumeLimit !== 'undefined' || typeof options.upperVolumeLimit !== 'undefined') {
                //eventually getVolume --> https://developers.google.com/cast/docs/reference/receiver/cast.receiver.media.Player
                client.getVolume(function(err, newvol){
                    if(err) {
                        errorHandler(node,err,'Not able to get the volume');
                    } else {
                        if (node) { node.debug("volume get from client " + JSON.stringify(newvol)); }
                        options.oldVolume = newvol.level * 100;
                        options.muted = (newvol.level < 0.01);
                        if (options.upperVolumeLimit !== 'undefined' && (newvol.level > options.upperVolumeLimit)) {
                            doSetVolume(options.upperVolumeLimit);
                        } else if (typeof options.lowerVolumeLimit !== 'undefined' && (newvol.level < options.lowerVolumeLimit)) {
                            doSetVolume(options.lowerVolumeLimit);
                        }
                    }
                });
            }

            if (typeof options.muted !== 'undefined') {
                doSetVolume({ muted: (options.muted === true) });
            }

            if (typeof options.pause !== 'undefined' && options.pause === true) {
                if (node) { node.debug("sending pause signal to player"); }

                client.getSessions(function(err, sessions) {
                    if(err) {
                        errorHandler(node,err,'Not able to get sessions');
                    } else {
                        client.join(sessions[0], DefaultMediaReceiver, function(err, app) {
                            if (!app.media.currentSession){
                                app.getStatus(function() {
                                    app.pause();
                                });
                            } else {
                                app.pause();
                            }
                        });
                    }
                });
            }

            if (typeof options.stop !== 'undefined' && options.stop === true) {
                if (node) { node.debug("sending pause signal to player"); }
                client.getSessions(function(err, sessions) {
                    if(err) {
                        errorHandler(node,err,'Not able to get sessions');
                    } else {
                        client.join(sessions[0], DefaultMediaReceiver, function(err, app) {
                            if (!app.media.currentSession){
                                app.getStatus(function() {
                                    app.stop();
                                });
                            } else {
                                app.stop();
                            }
                        });
                    }
                });
            }

            if (typeof media === 'object' &&
                typeof media.contentId !== 'undefined') {
                if (!media.contentType) { media.contentType = 'audio/mp3'; }
                if (!media.streamType) { media.contentType = 'BUFFERED'; }

                if (node) { node.debug("loading player with media='" + JSON.stringify(media) + "'"); }
                player.load(media, { autoplay: true }, (err, status) => {
                    if (err) {
                        errorHandler(node,err,'Not able to load media','error load media');
                    } else if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                        if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                            if (node) { node.debug("seek to position " + String(options.seek)); }
                            player.seek(options.seek, function(err, status) {
                                if(err) {
                                    errorHandler(node,err,'Not able to seek to position ' + String(options.seek));
                                } else {
                                    callbackResult(status, options);
                                }
                            });
                        }
                    } else {
                        callbackResult(status, options);
                    }
                    client.close();
                });
            } else {
                if (node) { node.debug("getting Status signal to player"); }
                client.getStatus(function(err, status) {
                    if(err) {
                        errorHandler(node,err,'Not able to get status');
                    } else {
                        callbackResult(status, options);
                    }
                });
            }
        } catch (err) {
            errorHandler(node,err,'Exception occured on load media','exception load media');
        }
      });
    };

    client.on('error', (err) => {
        client.close();
        errorHandler(node,err,'Client error reported','client error');
    });

    client.on('status', (status) => {
        if (node) {
            node.send([null,{
                payload : status,
                type : 'status',
                topic : ''
            }]);
        }
    });

    if (typeof options.port === 'undefined') {
        if (node) { node.debug("connect to client ip='" + options.ip + "'"); }
        client.connect(options.ip, connectedCallback);
    } else {
        if (node) { node.debug("connect to client ip='" + options.ip + "' port='" + options.port + "'"); }
        client.connect(options.ip, options.port,connectedCallback);
    }
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
            let attrs = ['media', 'url', 'contentType', 'message', 'language', 'ip', 'port', 'volume', 'lowerVolumeLimit', 'upperVolumeLimit', 'muted', 'delay', 'stop', 'pause', 'seek', 'duration'];

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
                if (data.contentType && !msg.url && !config.url && !data.media) {
                    data.url = msg.payload;
                } else {
                    data.message = msg.payload;
                }
            }
            //-------------------------------------------------------------------
            if (typeof data.ip === 'undefined') {
                this.error("configuraton error: IP is missing!");
                this.status({fill:"red",shape:"dot",text:"No IP given!"});
                return;
            }
            if (typeof data.language === 'undefined' || data.language === '' ) {
                data.language = 'en';
            }
            if (typeof data.volume !== 'undefined' &&
                !isNaN(data.volume) &&
                data.volume !== '') {
                data.volume = parseInt(data.volume) / 100;
            } else {
                delete data.volume;
            }
            if(typeof data.lowerVolumeLimit !== 'undefined' &&
                !isNaN(data.lowerVolumeLimit) &&
                data.lowerVolumeLimit !== '') {
                data.lowerVolumeLimit = parseInt(data.lowerVolumeLimit) / 100;
            } else {
                delete data.lowerVolumeLimit;
            }
            if(typeof data.upperVolumeLimit !== 'undefined' &&
                !isNaN(data.upperVolumeLimit) &&
                data.upperVolumeLimit !== '') {
                data.upperVolumeLimit = parseInt(data.upperVolumeLimit) / 100;
            } else {
                delete data.upperVolumeLimit;
            }
            if (typeof data.delay !== 'undefined' && !isNaN(data.delay) && data.delay !== '') {
                data.delay =  parseInt(data.delay);
            } else {
                data.delay = 250;
            }

            if (typeof data.url !== 'undefined') {
                this.debug("initialize playing url='" + data.url + "' of contentType='" + data.contentType + "'");

                if (typeof media === 'object') {
                    data.media.contentId = data.url;
                } else {
                    data.media = {
                        contentId: data.url,
                        contentType: data.contentType,
                      };
                }
            }

            if (typeof data.contentType !== 'undefined' &&
                typeof media === 'object') {
                data.media.contentType = data.contentType;
            }

            if (typeof data.duration !== 'undefined' &&
                !isNaN(data.duration) &&
                typeof media === 'object') {
                data.media.duration = data.duration;
            }

            try {
                msg.data = data;
                this.debug('start playing on cast device');
                this.debug(JSON.stringify(data));

                if (data.media) {
                    this.debug("initialize playing on ip='" + data.ip + "'");
                    this.status({fill:"green",shape:"dot",text:"play (" + data.contentType + ") on " + data.ip + " [url]"});

                    doCast(this, data.media, data, (res, data2) =>{
                        msg.payload = res;
                        if (data2 && data2.message) {
                            setTimeout((data3) => {
                                this.status({fill:"green",shape:"ring",text:"play message on " + data3.ip});
                                getSpeechUrl(data3.message, data3.language, data3, (sres, data) => {
                                        msg.speechResult = sres;
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
                            msg.payload = sres;
                            this.status({fill:"green",shape:"dot",text:"ok"});
                            this.send(msg);
                        });
                        return null;
                }

                this.debug("only sending unspecified request to ip='" + data.ip + "'");
                this.status({fill:"yellow",shape:"dot",text:"connect to " + data.ip});
                doCast(this, null, data, (status, data2) =>{
                    msg.payload = status;
                    this.status({fill:"green",shape:"dot",text:"ok"});
                    this.send(msg);
                });
            } catch (err) {
                errorHandler(this,err,'Exception occured on cast media to oputput', 'internal error');
            }
            //this.error("Input parameter wrong or missing. You need to setup (or give in the input message) the 'url' and 'content type' or the 'message' and 'language'!!");
            //this.status({fill:"red",shape:"dot",text:"error - input parameter"});
            return null;
        });
    }

    RED.nodes.registerType('cast-to-client', CastNode);
};
