/********************************************
 * Cast-to-client:
 *********************************************/

const util = require('util');
const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
// Const path = require('path');
// const YoutubeMediaReceiver = require(path.join(__dirname, '/lib/Youtube.js')).Youtube;

const googletts = require('google-tts-api');

const isTrue = function(val) {
    val = (val+'').toLowerCase();
    return (val === 'true' || val === 'yes' || val === 'on' || val === 'ja' || val === '1' || (!isNaN(val) && (Number(val) > 0)));
};

const isFalse = function(val) {
    val = (val+'').toLowerCase();
    return (val === 'false' || val === 'no' || val === 'off' || val === 'nein' || val === '0' || (!isNaN(val) && (Number(val) <= 0)));
};

const errorHandler = function (node, err, messageText, stateText) {
    if (!err) {
        return true;
    }
    if (err.message) {
        const msg = err.message.toLowerCase();
        if (msg.indexOf('invalid player state') >= 0) {
            // Sent when the request by the sender can not be fulfilled because the player is not in a valid state. For example, if the application has not created a media element yet.
            // https://developers.google.com/cast/docs/reference/messages#InvalidPlayerState
            messageText += ':' + err.message + ' The request can not be fulfilled because the player is not in a valid state.';
        } else if (msg.indexOf('load failed') >= 0) {
            // Sent when the load request failed. The player state will be IDLE.
            // https://developers.google.com/cast/docs/reference/messages#LoadFailed
            messageText += ':' + err.message + ' Not able to load the media.';
        } else if (msg.indexOf('load cancelled') >= 0) {
            // Sent when the load request was cancelled (a second load request was received).
            // https://developers.google.com/cast/docs/reference/messages#LoadCancelled
            messageText += ':' + err.message + ' The request was cancelled (a second load request was received).';
        } else if (msg.indexOf('invalid request') >= 0) {
            // Sent when the request is invalid (an unknown request type, for example).
            // https://developers.google.com/cast/docs/reference/messages#InvalidRequest
            messageText += ':' + err.message + ' The request is invalid (example: an unknown request type).';
        } else {
            messageText += ':' + err.message;
        }
    } else {
        messageText += '! (No error message given!)';
    }

    if (node) {
        node.error(messageText);
        node.debug(util.inspect(err, Object.getOwnPropertyNames(err)));
        node.status({
            fill: 'red',
            shape: 'ring',
            text: stateText
        });
    } else if (console) {
        console.error(messageText); // eslint-disable-line
        console.error(util.inspect(err, Object.getOwnPropertyNames(err))); // eslint-disable-line
    }
    return false;
};

const getContentType = function (data, node, fileName) {
    // Node property wins!
    if (data.contentType) {
        return data.contentType;
    }

    if (!fileName) {
        fileName = data.url;
    }

    let contentType;
    if (fileName) {
        const contentTypeMap = {
            youtube: 'youtube/video',
            mp3: 'audio/mp3',
            mp4: 'audio/mp4',
            mid: 'audio/mid',
            rmi: 'audio/mid',
            aif: 'audio/x-aiff',
            m3u: 'audio/x-mpegurl',
            ogg: 'audio/ogg',
            wav: 'audio/vnd.wav',
            flv: 'video/x-flv',
            m3u8: 'application/x-mpegURL',
            mjpg: 'video/x-motion-jpeg',
            mjpeg: 'video/x-motion-jpeg',
            '3gp': 'video/3gpp',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            wmv: 'video/x-ms-wmv',
            ra: 'audio/vnd.rn-realaudio'
        };

        const ext = fileName.split('.')[fileName.split('.').length - 1];
        contentType = contentTypeMap[ext.toLowerCase()];
        node.debug('contentType for ext ' + ext + ' is ' + contentType + Number('(') + fileName + ')');
    }
    if (!contentType) {
        node.warn('No contentType given!, using "audio/basic" which is maybe wrong! (' + fileName + ')');
        contentType = 'audio/basic';
    }

    return contentType;
};

const addGenericMetadata = function (media, imageUrl, contentTitle) {
    if (!contentTitle) {
        // Default from url
        contentTitle = media.contentId;
        if (contentTitle.indexOf('/') > -1) {
            try {
                let paths = contentTitle.split('/');
                if (paths.length > 2) {
                    paths = paths.slice(paths.length - 2, paths.length);
                }
                contentTitle = paths.join(' - ');
            } catch (e) {
                // Not used
            }
        }
    }
    if (!imageUrl) {
        imageUrl = media.imageUrl || 'https://nodered.org/node-red-icon.png';
    }

    media.metadata = {
        type: 0,
        metadataType: 0,
        title: contentTitle,
        images: [{
            url: imageUrl
        }]
    };
};

const getSpeechUrl = function (node, text, language, options, callback) {
    googletts(text, language, 1).then(url => {
        node.debug('returned tts media url=\'' + url + '\'');
        const media = {
            contentId: url,
            contentType: 'audio/mp3',
            streamType: 'BUFFERED' // Or LIVE
        };
        doCast(node, media, options, (res, data) => {
            callback(url, data);
        });
    }).catch(err => {
        errorHandler(node, err, 'Not able to get media file via google-tts', 'error in tts');
    });
};

const doCast = function (node, media, options, callbackResult) {
    const client = new Client();

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
        node.debug('Player Close');
        client.close();
        /*
        Reconnect(function(newClient, newPlayer) {
            chcClient = newClient;
            chcPlayer = newPlayer;
        });
        */
    };
    const onError = function (err) {
        client.close();
        errorHandler(node, err, 'Client error reported', 'client error');
    };

    const doGetVolume = function (fkt) {
        client.getVolume((err, vol) => {
            if (err) {
                errorHandler(node, err, 'Not able to get the volume');
            } else {
                node.context().set('volume', vol.level);
                node.debug('volume get from client ' + util.inspect(vol, Object.getOwnPropertyNames(vol)));
                if (fkt) {
                    fkt(vol);
                }
            }
        });
    };

    const doSetVolume = function (volume) {
        let obj = {};
        if (typeof volume === 'object') {
            obj = volume;
        } else if (volume < 0.01) {
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
        node.debug('try to set volume ' + util.inspect(obj, Object.getOwnPropertyNames(obj)));
        client.setVolume(obj, (err, newvol) => {
            const oldVol = node.context().get('volume');
            if (oldVol !== newvol.level) {
                node.context().set('oldVolume', oldVol);
                node.context().set('volume', newvol.level);
            }

            if (err) {
                errorHandler(node, err, 'Not able to set the volume');
            } else if (node) {
                node.log('volume changed to %s', Math.round(newvol.level * 100));
            }
        });
    };

    const checkOptions = function (options) {
        node.debug('checkOptions');
        node.debug(util.inspect(options, Object.getOwnPropertyNames(options)));
        if (isTrue(options.muted)) {
            doSetVolume({
                muted: true
            });
        } else if (isFalse(options.muted)) {
            doSetVolume({
                muted: false
            });
        } else if (typeof options.volume !== 'undefined' && options.volume !== null) {
            doSetVolume(options.volume);
        } else if (typeof options.lowerVolumeLimit !== 'undefined' || typeof options.upperVolumeLimit !== 'undefined') {
            // Eventually getVolume --> https://developers.google.com/cast/docs/reference/receiver/cast.receiver.media.Player
            doGetVolume( (newvol) => {
                options.oldVolume = newvol.level * 100;
                if (options.upperVolumeLimit !== 'undefined' && (newvol.level > options.upperVolumeLimit)) {
                    doSetVolume(options.upperVolumeLimit);
                } else if (typeof options.lowerVolumeLimit !== 'undefined' && (newvol.level < options.lowerVolumeLimit)) {
                    doSetVolume(options.lowerVolumeLimit);
                }
            });
        }

        if (typeof options.pause !== 'undefined' && options.pause === true) {
            node.debug('sending pause signal to player');

            client.getSessions((err, sessions) => {
                if (err) {
                    errorHandler(node, err, 'Not able to get sessions');
                } else {
                    client.join(sessions[0], DefaultMediaReceiver, (err, app) => {
                        if (!app.media.currentSession) {
                            app.getStatus(() => {
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
            node.debug('sending pause signal to player');
            client.getSessions((err, sessions) => {
                if (err) {
                    errorHandler(node, err, 'Not able to get sessions');
                } else {
                    client.join(sessions[0], DefaultMediaReceiver, (err, app) => {
                        if (!app.media.currentSession) {
                            app.getStatus(() => {
                                app.stop();
                            });
                        } else {
                            app.stop();
                        }
                    });
                }
            });
        }
    };

    const statusCallback = function () {
        node.debug('statusCallback');
        client.getSessions((err, sessions) => {
            node.debug('getSessions Callback');
            if (err) {
                errorHandler(node, err, 'error getting session');
            } else {
                try {
                    checkOptions(options);
                    const session = sessions[0]; // For now only one app runs at once, so using the first session should be ok
                    node.debug('session: ' + util.inspect(sessions, Object.getOwnPropertyNames(sessions)));
                    if (typeof sessions !== 'undefined' && sessions.length > 0) {
                        client.join(session, DefaultMediaReceiver, (err, player) => {
                            node.debug('join Callback');
                            if (err) {
                                errorHandler(node, err, 'error joining session');
                            } else {
                                node.debug('session joined ...');
                                player.on('status', onStatus);
                                player.on('close', onClose);

                                node.debug('do get Status from player');
                                client.getStatus((err, status) => {
                                    if (err) {
                                        errorHandler(node, err, 'Not able to get status');
                                    } else {
                                        callbackResult(status, options);
                                    }
                                    client.close();
                                });
                            }
                        });
                    } else {
                        // Nothing is playing
                        client.close();
                        callbackResult({
                            applications: []
                        }, options);
                    }
                } catch (err) {
                    errorHandler(node, err, 'Exception occurred on load media', 'exception load media');
                }
            }
        });
    };

    /*
    Const launchYTCallback = function () {
        node.debug('launchYTCallback');
        client.launch(YoutubeMediaReceiver, function (err, player) {
            if (err) {
                errorHandler(node, err, 'Not able to launch YoutubeMediaReceiver');
            }
            try {
                checkOptions(options)
                if (media.videoId) {
                    media.contentId = videoId;
                }
                node.debug('experimental implementation playing youtube videos media=\'' + util.inspect(media, Object.getOwnPropertyNames(media)) + '\'');
                player.load(media.contentId, (err) => {
                    if (err) {
                        errorHandler(node, err, 'Not able to load youtube video', 'error load youtube video');
                    }
                    client.close();
                });
            } catch (err) {
                errorHandler(node, err, 'Exception occurred on load youtube video', 'exception load youtube video');
            }
        });
    };
    */

    const launchDefCallback = function () {
        node.debug('launchDefCallback');
        client.launch(DefaultMediaReceiver, (err, player) => {
            if (err) {
                errorHandler(node, err, 'Not able to launch DefaultMediaReceiver');
            }

            try {
                checkOptions(options);

                if (media !== null &&
                    typeof media !== 'undefined' &&
                    typeof media === 'object' &&
                    typeof media.contentId !== 'undefined') {
                    if (typeof media.contentType !== 'string' ||
                        media.contentType === '') {
                        media.contentType = 'audio/basic';
                    }
                    if (typeof media.streamType !== 'string' ||
                        media.streamType === '') {
                        media.streamType = 'BUFFERED';
                    }

                    node.debug('loading player with media=\'' + util.inspect(media, Object.getOwnPropertyNames(media)) + '\'');

                    addGenericMetadata(media);

                    player.load(media, {
                        autoplay: true
                    }, (err, status) => {
                        if (err) {
                            errorHandler(node, err, 'Not able to load media', 'error load media');
                        } else if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                            if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                                node.debug('seek to position ' + String(options.seek));
                                player.seek(options.seek, (err, status) => {
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
                    node.debug('get Status from player');
                    client.getStatus((err, status) => {
                        if (err) {
                            errorHandler(node, err, 'Not able to get status');
                        } else {
                            callbackResult(status, options);
                        }
                        client.close();
                    });
                }
            } catch (err) {
                errorHandler(node, err, 'Exception occurred on load media', 'exception load media');
            }
        });
    };

    const launchQueueCallback = function () {
        client.launch(DefaultMediaReceiver, (err, player) => {
            if (err) {
                errorHandler(node, err, 'Not able to launch DefaultMediaReceiver');
            }

            player.on('status', status => {
                node.debug('QUEUE STATUS ' + util.inspect(status, Object.getOwnPropertyNames(status)));
            });

            try {
                checkOptions(options);

                if (media !== null &&
                    typeof media !== 'undefined' &&
                    typeof media === 'object' &&
                    typeof media.mediaList !== 'undefined') {
                    node.log('loading player with queue= ' + media.mediaList.length + ' items');
                    node.debug('queue data=\'' + util.inspect(media, Object.getOwnPropertyNames(media)) + '\'');

                    for (let i = 0; i < media.mediaList.length; i++) {
                        addGenericMetadata(media.mediaList[i].media, media.imageUrl);
                    }

                    player.queueLoad(
                        media.mediaList, {
                            startIndex: 1,
                            repeatMode: 'REPEAT_OFF'
                        },
                        (err, status) => {
                            node.log('Loaded QUEUE of ' + media.mediaList.length + ' items');

                            if (err) {
                                errorHandler(node, err, 'Not able to load media', 'error load media');
                            } else if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                                if (typeof options.seek !== 'undefined' && !isNaN(options.seek)) {
                                    node.debug('seek to position ' + String(options.seek));
                                    player.seek(options.seek, (err, status) => {
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
                    node.debug('get Status from player');
                    client.getStatus((err, status) => {
                        if (err) {
                            errorHandler(node, err, 'Not able to get status');
                        } else {
                            callbackResult(status, options);
                        }
                        client.close();
                    });
                }
            } catch (err) {
                errorHandler(node, err, 'Exception occurred on load media', 'exception load media');
            }
        });
    };

    try {
        client.on('error', onError);
        client.on('status', onStatus);

        if (typeof options.host === 'undefined') {
            options.host = options.ip;
        }

        node.debug('connect to client ip=\'' + options.ip + '\' port=\'' + options.port + '\'');
        node.debug(util.inspect(options, Object.getOwnPropertyNames(options)));
        if ((typeof options.status !== 'undefined' && options.status === true) ||
            (typeof media === 'undefined') || (media === null)) {
            client.connect(options, statusCallback);
        } else if (media.mediaList && media.mediaList.length > 0) {
            client.connect(options, launchQueueCallback);
        } else if (media.contentType.indexOf('youtube') !== -1) {
            node.error('currently not supported');
            // Client.connect(options, launchYTCallback);
        } else {
            client.connect(options, launchDefCallback);
        }
    } catch (err) {
        errorHandler(node, err, 'Exception occurred on load media', 'exception load media');
    }
};

module.exports = function (RED) {
    function CastNode(config) {
        RED.nodes.createNode(this, config);
        // Var node = this;

        this.on('input', function (msg) {
            //-----------------------------------------
            // Error Handling
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
             * Versenden:
             *********************************************/
            // var creds = RED.nodes.getNode(config.creds); - not used
            const attrs = [
                'media', 'url', 'urlList', 'imageUrl', 'contentType',
                'streamType', 'message', 'language', 'ip', 'port', 'volume',
                'lowerVolumeLimit', 'upperVolumeLimit', 'muted', 'mute',
                'delay', 'stop', 'pause', 'seek', 'duration', 'status'
            ];

            const data = {};
            for (const attr of attrs) {
                // Value === 'undefined' || value === null --> value == null
                if ((config[attr] != null) && (config[attr] !== '')) { // eslint-disable-line
                    data[attr] = config[attr];
                }
                if ((msg[attr] != null) && (msg[attr] !== '')) { // eslint-disable-line
                    data[attr] = msg[attr];
                }
            }

            if (typeof msg.payload === 'object') {
                for (const attr of attrs) {
                    if ((msg.payload[attr] != null) && (msg.payload[attr] !== '')) { // eslint-disable-line
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
                this.error('configuration error: IP is missing!');
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
            if (typeof data.volume !== 'undefined') {
                if (!isNaN(data.volume) &&
                    data.volume !== '') {
                    data.volume = parseInt(data.volume) / 100;
                } else if ((data.volume.toLowerCase() === 'max') ||
                       (data.volume.toLowerCase() === 'full') ||
                       (data.volume.toLowerCase() === 'loud')) {
                    data.volume = 100;
                } else if ((data.volume.toLowerCase() === 'min') ||
                        (data.volume.toLowerCase() === 'mute') ||
                        (data.volume.toLowerCase() === 'muted')) {
                    data.volume = 0;
                } else if (data.volume !== 0) {
                    delete data.volume;
                }
            }
            if (typeof data.mute !== 'undefined') {
                data.muted = data.mute;
                delete data.mute;
            }
            if (typeof data.lowerVolumeLimit !== 'undefined' &&
                !isNaN(data.lowerVolumeLimit) &&
                data.lowerVolumeLimit !== '') {
                data.lowerVolumeLimit = parseFloat(data.lowerVolumeLimit);
                if (data.lowerVolumeLimit > 1) {
                    data.lowerVolumeLimit = data.lowerVolumeLimit / 100;
                }
            } else {
                delete data.lowerVolumeLimit;
            }
            if (typeof data.upperVolumeLimit !== 'undefined' &&
                !isNaN(data.upperVolumeLimit) &&
                data.upperVolumeLimit !== '') {
                data.upperVolumeLimit = parseFloat(data.upperVolumeLimit);
                if (data.upperVolumeLimit > 1) {
                    data.upperVolumeLimit = data.upperVolumeLimit / 100;
                }
            } else {
                delete data.upperVolumeLimit;
            }
            this.debug(util.inspect(data, Object.getOwnPropertyNames(data)));

            if (typeof data.delay !== 'undefined' && !isNaN(data.delay) && data.delay !== '') {
                data.delay = parseInt(data.delay);
            } else {
                data.delay = 250;
            }

            if (typeof data.url !== 'undefined' &&
                data.url != null) {  // eslint-disable-line
                this.debug('initialize playing url=\'' + data.url + '\' of contentType=\'' + data.contentType + '\'');

                if (typeof data.contentType !== 'string' || data.contentType === '') {
                    data.contentType = getContentType(data, this);
                }
                data.media = {
                    contentId: data.url,
                    contentType: data.contentType
                };
            } else if (typeof data.urlList !== 'undefined' && data.urlList.length > 0) {
                // If is a list of files
                this.debug('initialize playing queue=\'' + data.urlList.length);

                data.media = {};
                data.media.mediaList = [];

                const listSize = data.urlList.length;
                for (let i = 0; i < listSize; i++) {
                    const item = data.urlList[i];

                    const contentType = getContentType(data, this, item);
                    const mediaItem = {
                        autoplay: true,
                        preloadTime: listSize,
                        startTime: i + 1,
                        activeTrackIds: [],
                        playbackDuration: 2,
                        media: {
                            contentId: item,
                            contentType,
                            streamType: 'BUFFERED'
                        }
                    };
                    data.media.mediaList.push(mediaItem);
                }
            }

            if (typeof data.media === 'object' &&
                data.media != null) { // eslint-disable-line

                if (typeof data.contentType !== 'undefined' &&
                    data.contentType != null) { // eslint-disable-line
                    data.media.contentType = data.contentType;
                }

                if (typeof data.streamType !== 'undefined' &&
                    data.streamType != null) { // eslint-disable-line
                    data.media.streamType = data.streamType;
                }

                if (typeof data.duration !== 'undefined' &&
                    !isNaN(data.duration)) {
                    data.media.duration = data.duration;
                }

                if (typeof data.imageUrl !== 'undefined' &&
                    data.imageUrl != null) { // eslint-disable-line
                    data.media.imageUrl = data.imageUrl;
                }
            }

            try {
                msg.data = data;

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
                            setTimeout(data3 => {
                                this.status({
                                    fill: 'green',
                                    shape: 'ring',
                                    text: 'play message on ' + data3.ip
                                });
                                getSpeechUrl(data3.message, data3.language, data3, sres => {
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
                    this.debug(util.inspect(data, Object.getOwnPropertyNames(data)));
                    this.status({
                        fill: 'green',
                        shape: 'ring',
                        text: 'play message on ' + data.ip
                    });
                    getSpeechUrl(this, data.message, data.language, data, sres => {
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
                doCast(this, null, data, status => {
                    msg.payload = status;
                    this.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'ok'
                    });
                    this.send(msg);
                });
            } catch (err) {
                errorHandler(this, err, 'Exception occurred on cast media to output', 'internal error');
            }
            // This.error("Input parameter wrong or missing. You need to setup (or give in the input message) the 'url' and 'content type' or the 'message' and 'language'!!");
            // this.status({fill:"red",shape:"dot",text:"error - input parameter"});
            return null;
        });

        discoverIpAddresses('googlecast', (ipaddresses) => {
            RED.httpAdmin.get('/ipaddresses', (req, res) => {
                res.json(ipaddresses);
            });
        });
    }

    function discoverIpAddresses(serviceType, discoveryCallback) {
        const ipaddresses = [];
        const bonjour = require('bonjour')();
        bonjour.find({
            type: serviceType
        }, (service) => {
            service.addresses.forEach((ip) => {
                if (ip.split('.').length === 4) {
                    ipaddresses.push({
                        ip: ip,
                        port: service.port,
                        label: service.txt.md
                    });
                }
            });

            // delay for all services to be discovered
            if (discoveryCallback) {
                setTimeout(() => {
                    discoveryCallback(ipaddresses);
                }, 2000);
            }
        });
    }

    RED.nodes.registerType('cast-to-client', CastNode);
};