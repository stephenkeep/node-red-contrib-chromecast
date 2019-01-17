const YOUTUBE_BASE = 'https://www.youtube.com/';
const RANDOM_ID = '12345678-9ABC-4DEF-0123-0123456789AB';

module.exports.YOUTUBE_LOUNGE_REQUEST = YOUTUBE_BASE + 'api/lounge/pairing/get_lounge_token_batch';
module.exports.YOUTUBE_PLAYIST_REQUEST = YOUTUBE_BASE + 'api/lounge/bc/bind?';

module.exports.XsrfTokenRegex = /'XSRF_TOKEN'.*"(\w+)="/;
// From current status
module.exports.sIdRegex = /"c","(.*?)","/;
module.exports.playListIdRegex = /listId":"(.*?)"/;
module.exports.gSessionIdRegex = /"S","(.*?)"]/;
module.exports.nowPlayVideoRegex = /videoId":"(.*?)"/;
module.exports.firstVideoRegex = /firstVideoId":"(.*?)"/;

module.exports.getYouTubeUrl = function (videoId) {
    return YOUTUBE_BASE + 'watch?v=' + videoId;
};

module.exports.getYouTubeLoungeTokenRequest = function (screenId, xsrfToken) {
    return 'screen_ids=' + screenId + '&session_token=' + xsrfToken;
};

function getVideoIdParam(videoIdParam) {
    return '%7B%22videoId%22%3A%22' + videoIdParam + '%22%2C%22currentTime%22%3A5%2C%22currentIndex%22%3A0%7D';
}

function getParamString(obj) {
    let str = '';
    for (const key in obj) {
        if (str !== '') {
            str += '&';
        }
        str += key + '=' + encodeURIComponent(obj[key]);
    }
    return str;
}
module.exports.getSessionParams = function (loungeIdToken) {
    const params = {device: 'REMOTE_CONTROL', id: RANDOM_ID, name: 'Desktop&app=youtube-desktop',
        'mdx-version': 3, loungeIdToken, VER: 8, v: 2, t: 1, ui: 1, RID: 75956,
        CVER: 1};
    return getParamString(params);
};

module.exports.setPlayListParams = function (loungeIdToken, videoIdParam) {
    const obj = {
        device: 'REMOTE_CONTROL',
        id: RANDOM_ID,
        name: 'Desktop&app=youtube-desktop',
        'mdx-version': 3,
        loungeIdToken,
        VER: 8,
        v: 2,
        t: 1,
        ui: 1,
        RID: 75956,
        CVER: 1,
        method: 'setPlaylist',
        params: getVideoIdParam(videoIdParam),
        TYPE: ''
    };

    return getParamString(obj);
};
module.exports.terminateSessionParams = function (loungeIdToken, videoIdParam, gSessionId, sId) {
    const obj = {
        device: 'REMOTE_CONTROL',
        id: RANDOM_ID,
        name: 'Desktop&app=youtube-desktop',
        'mdx-version': 3,
        loungeIdToken,
        VER: 8,
        v: 2,
        t: 1,
        ui: 1,
        RID: 75956,
        CVER: 1,
        method: 'setPlaylist',
        params: getVideoIdParam(videoIdParam),
        gessionid: gSessionId,
        SID: sId,
        TYPE: 'terminate'
    };

    return getParamString(obj);
};