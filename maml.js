// MAML - Media API Middleman Library
// This library is the middleman in between heylisten.io and different
// online media APIs

var https = require('https');
var http = require('http');

function errorReport(e) {
    console.log("Got error: " + e);
}

// makes https get request and returns the response JSON parsed response
function httpsGet(uri, callback) {
    https.get(uri, function(res){
        var body = '';
        res.on('data', function(chunk) {
            body+= chunk;
        });
        res.on('end',function(){
            callback(JSON.parse(body));
        });
    }).on('error', function(e){
        console.log(e);
    });
}

// makes http get request and returns the response JSON parsed response

function httpGet(uri, callback){
    http.get(uri, function(res){
        var body = '';
        res.on('data', function(chunk) {
            body+= chunk;
        });
        res.on('end',function(){
            callback(JSON.parse(body));
        });
    }).on('error', function(e){
        console.log(e);
    });
}

//get video titles
function getYTVideoInfo(plObj, ytAPIkey, callback) {
    var uri = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + plObj.id + '&key=' + ytAPIkey;
    httpsGet(uri, function(res){
        if (res) {
            plObj.title = res.items[0].snippet.title;
            callback(plObj);
        } else {
            return false;
        }
    });
}

//get soundcloud song info
function getSCSongInfo(plObj, scAPIkey, callback) {
    var uri = 'http://api.soundcloud.com/resolve.json?url=' + plObj.id + '&client_id='+ scAPIkey; //the url to resolve the other url
    console.log("uri ", uri);
    httpGet(uri, function(response){
        if(response) {
            console.log(61,  response);
            httpsGet(response.location, function(songInfo) {
                plObj.title = songInfo.user.username + " - " + songInfo.title;
                callback(plObj);
            });
        }
    });
}

function getVimeoSongInfo(plObj, apiKey, callback) {
	var newTitle;
	var newURL = '';
	var uri = 'https://api.vimeo.com/videos/' + plObj.id;
	var path = '/videos/' + plObj.id;
	var apikey = {'Authorization': 'bearer ' + apiKey};
	var options = {
		hostname: 'api.vimeo.com',
		port: 443,
		path: path,
		method: 'GET',
		headers: apikey
	};
	console.log(options);
	var req = https.request(options, function (res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function (){
			var songInfo = JSON.parse(body);
            if (songInfo) {
                plObj.title = songInfo.name;
    		    callback(plObj);
            } else {
                callback(null);
            }
		});
	});
	req.end();

	req.on('error', function(e) {
		console.log(e);
	});
}

// avaliable functions
exports.getMediaInfo = function (plObj, apiKeys, doc, callback) {
    for (var i = 0; i < plObj.length; i++) {
        if (plObj[i].platform === "youtube") {
            title = getYTVideoInfo(plObj[i], apiKeys.YouTube, callback);
        } else if (plObj[i].platform === "soundcloud") {
            title = getSCSongInfo(plObj[i], apiKeys.SoundCloud, callback);
        } else if (plObj[i].platform === "vimeo") {
            title = getVimeoSongInfo(plObj[i], apiKeys.Vimeo, callback);
        }
    }
};
// Needs to be cleaned up
// get recent uploads from a youtube channel
exports.getYouTubeChannelUploads = function(channelName, maxResults, ytAPIkey, callback) {
    var playlistIdRequest = "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forUsername=" + channelName + '&key=' + ytAPIkey;
    https.get(playlistIdRequest, function (res) {
            var body = '';
            res.on ('data', function(chunk) {
            body+= chunk;
        });
        res.on('end', function() {
            var channelInfo = JSON.parse(body);
            if (channelInfo.items.length > 0) {
                playlistId = channelInfo.items[0].contentDetails.relatedPlaylists.uploads;

                // check if the uploads playlists exists
                if (playlistId) {
                    var playlistItemsRequest = "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=" + maxResults +"&playlistId=" + playlistId + '&key=' + ytAPIkey;
                    // get playlist items from id
                    https.get(playlistItemsRequest, function(res){
                        body = '';
                        res.on('data', function(chunk){
                            body += chunk;
                        });
                        res.on('end', function() {
                            var playlistInfo = JSON.parse(body);
                            var videoList = [];
                            for (var i = 0; i < playlistInfo.items.length; i++) {
                                videoList[i] = playlistInfo.items[i].contentDetails.videoId;
                            }
                            if (videoList.length > 0) {
                                callback(videoList);
                            } else {
                                callback(null);
                            }
                        });
                    }).on('error', function(e) {
                        console.log("Got error: " + e);
                        });
                }
            } else {
                callback(null);
            }
        });
    }).on('error', function(e) {
        console.log("Got error: " + e);
        });
};

//get video list from a yt playlist
exports.getYouTubePlaylist = function(playlistID, maxResults, ytAPIkey, callback) {
    var playlistItemsRequest = "https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=" + maxResults +"&playlistId=" + playlistID + '&key=' + ytAPIkey;
    // get playlist items from id
    https.get(playlistItemsRequest, function(res){
        body = '';
        res.on('data', function(chunk){
            body += chunk;
        });
        res.on('end', function() {
            var playlistInfo = JSON.parse(body);
            var videoList = [];
            for (var i = 0; i < playlistInfo.items.length; i++) {
                videoList[i] = playlistInfo.items[i].contentDetails.videoId;
            }
            if (videoList.length > 0) {
                callback(videoList);
            } else {
                callback(null);
            }
        });
    }).on('error', function(e) {
        console.log("Got error: " + e);
        });
};
