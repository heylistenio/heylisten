// MAML - Media API Middleman Library
// This library is the middleman in between heylisten.io and different
// online media APIs

var https = require('https');
var httpNS = require('http');

//get video titles
function getYTVideoInfo(id, ytAPIkey, callback) {
    var newTitle;
    var uri = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + id + '&key=' + ytAPIkey;
    https.get(uri, function (res) {
            var body = '';
            res.on ('data', function(chunk) {
            body+= chunk;
        });
        res.on('end', function() {
            var vidInfo = JSON.parse(body);
            //execute a callback function with the new title as a parameter
            if (vidInfo.items[0]) {
             callback(vidInfo.items[0].snippet.title);
         } else {
             callback(null);
         }
        });
    }).on('error', function(e) {
        console.log("Got error: " + e);
        });
}

//get soundcloud song info
function getSCSongInfo(id, scAPIkey, callback) {
    var newTitle;
    var newURL = '';
    var uri = 'http://api.soundcloud.com/resolve.json?url=' + id + '&client_id=' + scAPIkey; //the url to resolve the other url
    httpNS.get(uri, function (res) {
        var body = '';
        res.on('data', function(chunk) {
            body+= chunk;
        });
        res.on('end', function() {
            var urlInfo = JSON.parse(body);
            newURL = urlInfo.location;
            if (newURL) {
                https.get(newURL, function(res) {
                    var body = '';
                    res.on('data', function(chunk) {
                        body += chunk;
                    });
                    res.on('end', function() {
                        var songInfo = JSON.parse(body);
                        newTitle = songInfo.user.username + " - " + songInfo.title;
                        if (newTitle) {
                            callback(newTitle);
                        } else {
                            callback(null);
                        }
                    });
                });
            } //else {
            //    rooms[roomId].playlist.splice(playPos, 1);
            //    io.to(roomId).emit('playlist', rooms[roomId].playlist);
            //    terminalMessage("could not resolve ulr, removing sc song from playlist");
            //}

        });
        res.on('error', function(e) {
            console.log("Failed to resolve SC url: ", e);
        });
    });


}

function getVimeoSongInfo(id, apiKey, callback) {
	var newTitle;
	var newURL = '';
	var uri = 'https://api.vimeo.com/videos/' + id;
	var path = '/videos/' + id;
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
    		    callback(songInfo.name);
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
exports.getMediaInfo = function (platform, id, apiKeys, callback) {
    console.log(apiKeys);
    if (platform === "youtube") {
        title = getYTVideoInfo(id, apiKeys.YouTube, callback);
    } else if (platform === "soundcloud") {
        title = getSCSongInfo(id, apiKeys.SoundCloud, callback);
    } else if (platform === "vimeo") {
        title = getVimeoSongInfo(id, apiKeys.Vimeo, callback);
    }
};

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
            if (channelInfo.items && channelInfo.items.length > 0) {
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
            if (playlistInfo.items) {
                for (var i = 0; i < playlistInfo.items.length; i++) {
                    videoList[i] = playlistInfo.items[i].contentDetails.videoId;
                }
                if (videoList.length > 0) {
                    callback(videoList);
                } else {
                    callback(null);
                }
            } else {
                callback(null);
            }
        });
    }).on('error', function(e) {
        console.log("Got error: " + e);
        });
};
