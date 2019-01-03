var util = require('util');
var castv2Cli = require('castv2-client');
var RequestResponseController = castv2Cli.RequestResponseController;
var Q = require('q');
var _ = require('lodash');
var needle = require('needle');

var utils = require('./utils');

function YoutubeController(client, sourceId, destinationId) {
    RequestResponseController.call(this, client, sourceId, destinationId, 'urn:x-cast:com.google.youtube.mdx');
    this.once('close', onclose);
    var self = this;

    function onclose() {
        self.stop();
    }
}

util.inherits(YoutubeController, RequestResponseController);


YoutubeController.prototype.load = function (videoId, callback) {

    var controlRequestQ = Q.nbind(this.controlRequest, this);
    var needleGetQ = Q.denodeify(needle.get);
    var needlePostQ = Q.denodeify(needle.post);

    var screenId, xsrfToken, loungeToken;

    var sId, gSessionId, playlistId, nowPlayingId, firstVideo;
    // 1. Fetch screen ID
    controlRequestQ({
            type: 'getMdxSessionStatus'
        })
        .then(function (response) {
            screenId = _.get(response, 'data.screenId', null);
            if (_.isNull(screenId)) {
                throw 'Failed to fetch screenID';
            }
        })
        .then(function () {
            // 2. Fetch page to extract XSRF token
            var youtubeUrl = utils.getYouTubeUrl(videoId);
            return needleGetQ(youtubeUrl);
        })
        .then(function (response) {
            // 3. Extract XSRF token
            var body = response[1];
            var match = utils.XsrfTokenRegex.exec(body);
            // console.log(match);
            // if (match.length != 1) {
            //     throw 'Failed to extract XSRF token';
            // }
            xsrfToken = match[1];

        })
        .then(function () {
            // 4. Get Lounge ID
            return needlePostQ(utils.YOUTUBE_LOUNGE_REQUEST, utils.getYouTubeLoungeTokenRequest(screenId, xsrfToken))
                .then(function (response) {

                    var screens = response[1];
                    screenId = _.get(screens, 'screens[0].screenId');
                    loungeToken = _.get(screens, 'screens[0].loungeToken');
                })

        })
        .then(function () {
            // 5. Get Session params
            var params = utils.getSessionParams(loungeToken);
            return needlePostQ(utils.YOUTUBE_PLAYIST_REQUEST + params, '')
                .then(function (response) {
                    playlistId = utils.playListIdRegex.exec(response)[1];
                    sId = utils.sIdRegex.exec(response)[1];
                    gSessionId = utils.gSessionIdRegex.exec(response)[1];
                    try {
                        firstVideo = utils.firstVideoRegex.exec(response)[1];
                    } catch (err) {
                        //noop
                    }
                    try {
                        nowPlayingId = utils.nowPlayVideoRegex.exec(response)[1];
                    } catch (err) {
                        //noop
                    }

                    console.log('Status response values: ', playlistId, sId, gSessionId, firstVideo, nowPlayingId);
                });

        })
        .then(function () {
            // TODO If playlist has a video active... clear it
            // 6. Add video to playlist
            var params = utils.setPlayListParams(loungeToken, videoId);
            return needlePostQ(utils.YOUTUBE_PLAYIST_REQUEST + params, 'count=0');
        })
        .catch(function (err) {
            callback(err);
        });

    return callback(null);
};

YoutubeController.prototype.controlRequest = function (data, callback) {

    var self = this;

    function onmessage(response) {

        self.removeListener('message', onmessage);

        if (response.type === 'INVALID_REQUEST') {
            return callback(new Error('Invalid request: ' + response.reason));
        }

        callback(null, response);
    }

    this.on('message', onmessage);
    this.send(data);
};

module.exports = YoutubeController;