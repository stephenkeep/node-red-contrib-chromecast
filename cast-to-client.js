/********************************************
 * cast-to-client:
 *********************************************/
const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const googletts = require('google-tts-api');

const errorHandler = function (node, err, messageText, stateText) {
    if (!err) {
        return true;
    }
    if (err.message) {
        let msg = err.message.toLowerCase();
        if (msg.indexOf('invalid player state') >= 0) {
            //Sent when the request by the sender can not be fulfilled because the player is not in a valid state. For example, if the application has not created a media element yet.
            //https://developers.google.com/cast/docs/reference/messages#InvalidPlayerState
            messageText += ':' + err.message + ' The request can not be fulfilled because the player is not in a valid state.';
        } else if (msg.indexOf('load failed') >= 0) {
            //Sent when the load request failed. The player state will be IDLE.
            //https://developers.google.com/cast/docs/reference/messages#LoadFailed
            messageText += ':' + err.message + ' Not able to load the media.';
        } else if (msg.indexOf('load cancelled') >= 0) {
            //Sent when the load request was cancelled (a second load request was received).
            //https://developers.google.com/cast/docs/reference/messages#LoadCancelled
            messageText += ':' + err.message + ' The request was cancelled (a second load request was received).';
        } else if (msg.indexOf('invalid request') >= 0) {
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
        node.status({
            fill: 'red',
            shape: 'ring',
            text: stateText
        });
    } else if (console) {
        console.error(messageText);
        console.error(JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
    return false;
};

const getContentType = function(data, node, fileName){
  //node property wins!
  if(data.contentType){
    return data.contentType;
  }

  if(!fileName){
    fileName = data.url;
  }

  var contentType;
  if(fileName){
    var contentTypeMap = {
      'youtube' : 'youtube/video',
      'mp3' : 'audio/mp3',
      'mp4' : 'audio/mp4',
      'mid' : 'audio/mid',
      'rmi' : 'audio/mid',
      'aif' : 'audio/x-aiff',
      'm3u' : 'audio/x-mpegurl',
      'ogg' : 'audio/ogg',
      'wav' : 'audio/vnd.wav',
      'flv' : 'video/x-flv',
      'm3u8' : 'application/x-mpegURL',
      '3gp' : 'video/3gpp',
      'mov' : 'video/quicktime',
      'avi' : 'video/x-msvideo',
      'wmv' : 'video/x-ms-wmv',
      'ra' : 'audio/vnd.rn-realaudio'
    };

    var ext = fileName.split('.')[fileName.split('.').length-1];
    contentType = contentTypeMap[ext];
    node.debug('contentType for ext '+ext + ' is '+contentType + + '('+fileName+')');
  }
  if (!contentType) {
      node.warn('No contentType given!, using "audio/basic" which is maybe wrong! ('+fileName+')');
      contentType = 'audio/basic';
  }

  return contentType;
};

const addGenericMetadata = function(media, contentTitle, imageUrl){
  if(!contentTitle){
    //default from url
    contentTitle = media.contentId;
    if(contentTitle.indexOf('/') > -1){
      try {
        var paths = contentTitle.split('/');
        if(paths.length>2){
          paths = paths.slice(paths.length-2,paths.length);
        }
        contentTitle = paths.join(' - ');
      } catch (e) {
      }
    }
  }
  if(!imageUrl){
    imageUrl = 'https://nodered.org/node-red-icon.png';
  }

  media.metadata = {
    type: 0,
    metadataType: 0,
    title: contentTitle,
    images: [
      { url: imageUrl}
    ]
  };
};

const getSpeechUrl = function (node, text, language, options, callback) {
    googletts(text, language, 1).then((url) => {
        if (node) {
            node.debug('returned tts media url=\'' + url + '\'');
        }
        let media = {
            contentId: url,
            contentType: 'audio/mp3',
            streamType: 'BUFFERED' // or LIVE
        };
        doCast(node, media, options, (res, data) => {
            callback(url, data);
        });
    }).catch((err) => {
        errorHandler(node, err, 'Not able to get media file via google-tts', 'error in tts');
    });
};

const doCast = function (node, media, options, callbackResult) {
    var client = new Client();

    const onStatus = function (status) {
        if (node) {
            node.send([null, {
                payload: status,
                type: 'status',
                topic: ''
            }]);
        }
    };
    const onClose = function () {
        if (node) {
            node.debug('Player Close');
        }
        client.close();
        /*reconnect(function(newclient, newplayer) {
            chcClient = newclient;
            chcPlayer = newplayer;
        });*/
    };
    const onError = function (err) {
        client.close();
        errorHandler(node, err, 'Client error reported', 'client error');
    };

    const doSetVolume = function (volume) {
        var obj = {};
        if (volume < 0.01) {
            obj = {
                muted: true
            };
        } else if (volume > 0.99) {
            obj = {
                level: 1
            };
        } else {
            obj = {
                level: volume
            };
        }
        if (node) {
            node.debug('try to set volume ' + JSON.stringify(obj));
        }
        client.setVolume(obj, function (err, newvol) {
            if (err) {
                errorHandler(node, err, 'Not able to set the volume');
            } else if (node) {
                node.log('volume changed to %s', Math.round(newvol.level * 100));
            }
        });
    };

    const checkOptions = function (options) {
        if (typeof options.volume !== 'undefined' && options.volume != null) {
            doSetVolume(options.volume);
        } else if (typeof options.lowerVolumeLimit !== 'undefined' || typeof options.upperVolumeLimit !== 'undefined') {
            //eventually getVolume --> https://developers.google.com/cast/docs/reference/receiver/cast.receiver.media.Player
            client.getVolume(function (err, newvol) {
                if (err) {
                    errorHandler(node, err, 'Not able to get the volume');
                } else {
                    if (node) {
                        node.debug('volume get from client ' + JSON.stringify(newvol));
                    }
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

        if (typeof options.muted !== 'undefined' && options.muted != null) {
            doSetVolume({
                muted: (options.muted === true)
            });
        }

        if (typeof options.pause !== 'undefined' && options.pause === true) {
            if (node) {
                node.debug('sending pause signal to player');
            }

            client.getSessions(function (err, sessions) {
                if (err) {
                    errorHandler(node, err, 'Not able to get sessions');
                } else {
                    client.join(sessions[0], DefaultMediaReceiver, function (err, app) {
                        if (!app.media.currentSession) {
                            app.getStatus(function () {
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
            if (node) {
                node.debug('sending pause signal to player');
            }
            client.getSessions(function (err, sessions) {
                if (err) {
                    errorHandler(node, err, 'Not able to get sessions');
                } else {
                    client.join(sessions[0], DefaultMediaReceiver, function (err, app) {
                        if (!app.media.currentSession) {
                            app.getStatus(function () {
                                app.stop();
                            });
                        } else {
                            app.stop();
                        }
                    });
                }
            });
        }
    }

    /*
status of a playing audio stream:
    {"applications":[{"appId":"12F05308","displayName":"TuneIn Free","iconUrl":"https://lh3.googleusercontent.com/HY9FJJF6gvT-JykObo1KvoNbewRoUJa2VjsE8TRgmBUmFFYGDI3FYJRGxGkj9gkMh_f3K-QSytav8G8","isIdleScreen":false,"launchedFromCloud":true,"namespaces":[{"name":"urn:x-cast:com.google.cast.cac"},{"name":"urn:x-cast:com.tunein.cast.init"},{"name":"urn:x-cast:com.tunein.cast.initUrl"},{"name":"urn:x-cast:com.tunein.cast.play"},{"name":"urn:x-cast:com.tunein.cast.pause"},{"name":"urn:x-cast:com.tunein.cast.stop"},{"name":"urn:x-cast:com.tunein.cast.comm.addSender"},{"name":"urn:x-cast:com.tunein.cast.comm.mediaLoaded"},{"name":"urn:x-cast:com.tunein.cast.comm.playState"},{"name":"urn:x-cast:com.tunein.cast.comm.tuneDataLoaded"},{"name":"urn:x-cast:com.tunein.cast.comm.scrubberMovedMessage"},{"name":"urn:x-cast:com.tunein.cast.comm.nowPlayingDataLoaded"},{"name":"urn:x-cast:com.tunein.cast.comm.error"},{"name":"urn:x-cast:com.google.cast.broadcast"},{"name":"urn:x-cast:com.google.cast.media"}],"sessionId":"ee64fbea-2828-475c-be1d-5a4adaad1804","statusText":"Casting: Radio Dresden","transportId":"ee64fbea-2828-475c-be1d-5a4adaad1804"}],"userEq":{"high_shelf":{"frequency":4500,"gain_db":0,"quality":0.707},"low_shelf":{"frequency":150,"gain_db":0,"quality":0.707},"max_peaking_eqs":0,"peaking_eqs":[]},"volume":{"controlType":"master","level":0.2799999713897705,"muted":false,"stepInterval":0.019999999552965164}}
    /* */
    /*
    status if nothing playing:
    {"applications":[{"appId":"CC1AD845","displayName":"Default Media Receiver","iconUrl":"","isIdleScreen":false,"launchedFromCloud":false,"namespaces":[{"name":"urn:x-cast:com.google.cast.cac"},{"name":"urn:x-cast:com.google.cast.broadcast"},{"name":"urn:x-cast:com.google.cast.media"}],"sessionId":"7d6af4d1-eb33-4643-bcdd-6c50c79dbbce","statusText":"Default Media Receiver","transportId":"7d6af4d1-eb33-4643-bcdd-6c50c79dbbce"}],"userEq":{"high_shelf":{"frequency":4500,"gain_db":0,"quality":0.707},"low_shelf":{"frequency":150,"gain_db":0,"quality":0.707},"max_peaking_eqs":0,"peaking_eqs":[]},"volume":{"controlType":"master","level":0.2799999713897705,"muted":false,"stepInterval":0.019999999552965164}}
    /* */
    const statusCallback = function () {
        client.getSessions(function(err, sessions) {
            if (err) {
                errorHandler(node, err, 'error getting session');
            } else {
                try {
                    checkOptions(options);
                    var session = sessions[0]; // For now only one app runs at once, so using the first session should be ok
                    if (node) {
                        node.debug("session: " + JSON.stringify(sessions[0]));
                    }
                    client.join(session, DefaultMediaReceiver, function(err, player) {
                        if (err) {
                            errorHandler(node, err, 'error joining session');
                        } else {
                            if (node) {
                                node.debug('session joined ...');
                            }
                            player.on('status', onStatus);
                            player.on('close', onClose);

                            if (node) {
                                node.debug('do get Status from player');
                            }
                            client.getStatus(function (err, status) {
                                if (err) {
                                    errorHandler(node, err, 'Not able to get status');
                                } else {
                                    callbackResult(status, options);
                                }
                                client.close();
                            });
                        }
                    });
                } catch (err) {
                    errorHandler(node, err, 'Exception occured on load media', 'exception load media');
                }
            }
        });
    }

    const connectedCallback = function () {
        client.launch(DefaultMediaReceiver, (err, player) => {
            if (err) {
                errorHandler(node, err, 'Not able to launch DefaultMediaReceiver');
            }

            try {
                checkOptions(options);

                if (media != null &&
                    typeof media !== 'undefined' &&
                    typeof media === 'object' &&
                    typeof media.contentId !== 'undefined') {
                    if (typeof media.contentType !== 'string' ||
                        media.contentType == '') {
                        media.contentType = 'audio/basic';
                    }
                    if (typeof media.streamType !== 'string' ||
                        media.streamType == '') {
                        media.streamType = 'BUFFERED';
                    }

                    if (node) {
                        node.debug('loading player with media=\'' + JSON.stringify(media) + '\'');
                    }

                    addGenericMetadata(media);

                    player.load(media, {
                        autoplay: true
                    }, (err, status) => {
                        if (err) {
                            errorHandler(node, err, 'Not able to load media', 'error load media');
                        } else if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                            if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                                if (node) {
                                    node.debug('seek to position ' + String(options.seek));
                                }
                                player.seek(options.seek, function (err, status) {
                                    if (err) {
                                        errorHandler(node, err, 'Not able to seek to position ' + String(options.seek));
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
                    if (node) {
                        node.debug('get Status from player');
                    }
                    client.getStatus(function (err, status) {
                        if (err) {
                            errorHandler(node, err, 'Not able to get status');
                        } else {
                            callbackResult(status, options);
                        }
                        client.close();
                    });
                }

            } catch (err) {
                errorHandler(node, err, 'Exception occured on load media', 'exception load media');
            }
        });
    };

    const launchQueueCallback = function () {
        client.launch(DefaultMediaReceiver, (err, player) => {
            if (err) {
                errorHandler(node, err, 'Not able to launch DefaultMediaReceiver');
            }

           player.on('status', function(status) {
               node.debug('QUEUE STATUS '+ JSON.stringify(status) );
           });

            try {
                checkOptions(options);

                if (media != null &&
                    typeof media !== 'undefined' &&
                    typeof media === 'object' &&
                    typeof media.mediaList !== 'undefined') {

                    if (node) {
                        node.log('loading player with queue= ' + media.mediaList.length+ " items");
                        node.debug('queue data=\'' + JSON.stringify(media) + '\'');
                    }

                   for (var i = 0; i < media.mediaList.length; i++) {
                     addGenericMetadata(media.mediaList[i].media);
                   }

                   player.queueLoad(
                     media.mediaList,
                     {
                       startIndex:1,
                       repeatMode: "REPEAT_OFF"
                     },
                     function(err, status) {
                       node.log("Loaded QUEUE of "+media.mediaList.length+ " items");
          
                       if (err) {
                           errorHandler(node, err, 'Not able to load media', 'error load media');
                       } else if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                           if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                               if (node) {
                                   node.debug('seek to position ' + String(options.seek));
                               }
                               player.seek(options.seek, function (err, status) {
                                   if (err) {
                                       errorHandler(node, err, 'Not able to seek to position ' + String(options.seek));
                                   } else {
                                       callbackResult(status, options);
                                   }
                               });
                           }
                       } else {
                           callbackResult(status, options);
                       }
                       client.close();


                       }
                   );


                } else {
                    if (node) {
                        node.debug('get Status from player');
                    }
                    client.getStatus(function (err, status) {
                        if (err) {
                            errorHandler(node, err, 'Not able to get status');
                        } else {
                            callbackResult(status, options);
                        }
                        client.close();
                    });
                }

            } catch (err) {
                errorHandler(node, err, 'Exception occured on load media', 'exception load media');
            }
        });
    };

    client.on('error', onError);
    client.on('status', onStatus);

    if (typeof options.port === 'undefined') {
        if (node) {
            node.debug('connect to client ip=\'' + options.ip + '\'');
        }
        if ((typeof options.status !== 'undefined' && options.status === true) ||
            (typeof media === 'undefined') || (media == null)) {
            client.connect(options.ip, statusCallback);
        } else if (media.mediaList && media.mediaList.length > 0) {
            client.connect(options.ip, launchQueueCallback);
        } else {
            client.connect(options.ip, connectedCallback);
        }
    } else {
        if (node) {
            node.debug('connect to client ip=\'' + options.ip + '\' port=\'' + options.port + '\'');
        }
        if ((typeof options.status !== 'undefined' && options.status === true) ||
            (typeof media === 'undefined') || (media == null)) {
            client.connect(options.ip, options.port, statusCallback);
        } else if (media.mediaList && media.mediaList.length > 0) {
            client.connect(options.ip, launchQueueCallback);
        } else {
            client.connect(options.ip, options.port, connectedCallback);
        }
    }
};

module.exports = function (RED) {
    function CastNode(config) {
        RED.nodes.createNode(this, config);
        //var node = this;

        this.on('input', function (msg) {
            //-----------------------------------------
            //Error Handling
            if (!Client) {
                this.error('Client not defined!! - Installation Problem, Please reinstall!');
                this.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'installation error'
                });
                return;
            }

            if (!DefaultMediaReceiver) {
                this.error('DefaultMediaReceiver not defined!! - Installation Problem, Please reinstall!');
                this.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'installation error'
                });
                return;
            }

            if (!googletts) {
                this.error('googletts not defined!! - Installation Problem, Please reinstall!');
                this.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'installation error'
                });
                return;
            }
            /********************************************
             * versenden:
             *********************************************/
            //var creds = RED.nodes.getNode(config.creds); - not used
            let attrs = ['media', 'url', 'urlList', 'contentType', 'streamType', 'message', 'language', 'ip', 'port', 'volume', 'lowerVolumeLimit', 'upperVolumeLimit', 'muted', 'delay', 'stop', 'pause', 'seek', 'duration', 'status'];

            var data = {};
            for (let attr of attrs) {
                if (config[attr]) {
                    data[attr] = config[attr];
                }
                if (msg[attr]) {
                    data[attr] = msg[attr];
                }
            }

            if (typeof msg.payload === 'object') {
                for (let attr of attrs) {
                    if (msg.payload[attr]) {
                        data[attr] = msg.payload[attr];
                    }
                }
            } else if (typeof msg.payload === 'string' && msg.payload.trim() !== '') {
                if (data.contentType && !msg.url && !config.url && !data.media) {
                    data.url = msg.payload;
                } else {
                    data.message = msg.payload;
                }
            }
            //-------------------------------------------------------------------
            if (typeof data.ip === 'undefined') {
                this.error('configuraton error: IP is missing!');
                this.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'No IP given!'
                });
                return;
            }
            if (typeof data.language === 'undefined' || data.language === '') {
                data.language = 'en';
            }
            if (typeof data.volume !== 'undefined' &&
                !isNaN(data.volume) &&
                data.volume !== '') {
                data.volume = parseInt(data.volume) / 100;
            } else {
                delete data.volume;
            }
            if (typeof data.lowerVolumeLimit !== 'undefined' &&
                !isNaN(data.lowerVolumeLimit) &&
                data.lowerVolumeLimit !== '') {
                data.lowerVolumeLimit = parseInt(data.lowerVolumeLimit) / 100;
            } else {
                delete data.lowerVolumeLimit;
            }
            if (typeof data.upperVolumeLimit !== 'undefined' &&
                !isNaN(data.upperVolumeLimit) &&
                data.upperVolumeLimit !== '') {
                data.upperVolumeLimit = parseInt(data.upperVolumeLimit) / 100;
            } else {
                delete data.upperVolumeLimit;
            }
            if (typeof data.delay !== 'undefined' && !isNaN(data.delay) && data.delay !== '') {
                data.delay = parseInt(data.delay);
            } else {
                data.delay = 250;
            }

            if (typeof data.url !== 'undefined' &&
                data.url != null) {
                this.debug('initialize playing url=\'' + data.url + '\' of contentType=\'' + data.contentType + '\'');

                if (typeof data.contentType !== 'string' || data.contentType == '') {
                    data.contentType = getContentType(data, this);
                }
                data.media = {
                    contentId: data.url,
                    contentType: data.contentType
                }
            }else if (typeof data.urlList !== 'undefined' && data.urlList.length>0) {
                //if is a list of files
                this.debug('initialize playing queue=\'' + data.urlList.length );

                data.media = {}
                data.media.mediaList = [];

                var listSize = data.urlList.length;
                for (var i = 0; i < listSize; i++) {
                  var item = data.urlList[i];

                  var contentType = getContentType(data, this, item);
                  var mediaItem = {
                    autoplay : true,
                    preloadTime : listSize,
                    startTime : i+1,
                    activeTrackIds : [],
                    playbackDuration: 2,
                    media: {
                      contentId: item,
                      contentType: contentType,
                      streamType: 'BUFFERED'
                    }
                  };
                  data.media.mediaList.push(mediaItem);
                }
            }

            if (typeof data.media === 'object' &&
                data.media != null) {

                if (typeof data.contentType !== 'undefined' &&
                    data.contentType != null) {
                    data.media.contentType = data.contentType;
                }

                if (typeof data.streamType !== 'undefined' &&
                    data.streamType != null) {
                    data.media.streamType = data.streamType;
                }

                if (typeof data.duration !== 'undefined' &&
                    !isNaN(data.duration)) {
                    data.media.duration = data.duration;
                }
            }

            try {
                msg.data = data;
                this.debug('start playing on cast device');
                this.debug(JSON.stringify(data));

                if (data.media) {
                    this.debug('initialize playing on ip=\'' + data.ip + '\'');
                    this.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'play (' + data.contentType + ') on ' + data.ip + ' [url]'
                    });

                    doCast(this, data.media, data, (res, data2) => {
                        msg.payload = res;
                        if (data2 && data2.message) {
                            setTimeout((data3) => {
                                this.status({
                                    fill: 'green',
                                    shape: 'ring',
                                    text: 'play message on ' + data3.ip
                                });
                                getSpeechUrl(data3.message, data3.language, data3, (sres) => {
                                    msg.speechResult = sres;
                                    this.status({
                                        fill: 'green',
                                        shape: 'dot',
                                        text: 'ok'
                                    });
                              this.send(msg);
                                });
                            }, data2.delay, data2);
                            return null;
                        }
                        this.status({
                            fill: 'green',
                            shape: 'dot',
                            text: 'ok'
                        });
                        this.send(msg);
                    });
                    return null;
                }

                if (data.message) {
                    this.debug('initialize getting tts message=\'' + data.message + '\' of language=\'' + data.language + '\'');
                    this.status({
                        fill: 'green',
                        shape: 'ring',
                        text: 'play message on ' + data.ip
                    });
                    getSpeechUrl(this, data.message, data.language, data, (sres) => {
                        msg.payload = sres;
                        this.status({
                            fill: 'green',
                            shape: 'dot',
                            text: 'ok'
                        });
                        this.send(msg);
                    });
                    return null;
                }

                this.debug('only sending unspecified request to ip=\'' + data.ip + '\'');
                this.status({
                    fill: 'yellow',
                    shape: 'dot',
                    text: 'connect to ' + data.ip
                });
                doCast(this, null, data, (status) => {
                    msg.payload = status;
                    this.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'ok'
                    });
                    this.send(msg);
                });
            } catch (err) {
                errorHandler(this, err, 'Exception occured on cast media to oputput', 'internal error');
            }
            //this.error("Input parameter wrong or missing. You need to setup (or give in the input message) the 'url' and 'content type' or the 'message' and 'language'!!");
            //this.status({fill:"red",shape:"dot",text:"error - input parameter"});
            return null;
        });
    }

    RED.nodes.registerType('cast-to-client', CastNode);
};
