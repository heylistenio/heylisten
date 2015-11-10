/*jshint multistr: true */
// adress, login, and password for the db
exports.url = "mongodb://localhost:27017/heylisten";

// API keys for heylisten.io
exports.apiKeys = {
    YouTube: '',
    SoundCloud: '',
    Vimeo: ''
};

exports.welcome =  "Welcome to heylisten.io! As you can see the website is \
                    pretty far from finished. We are working on making it look \
                    better and adding more features. Feel free to let us know \
                    what you think of our efforts so far by tweeting at \
                    https://twitter.com/heylisten_io \
                    and checkout the devblog at http://blog.heylisten.io \
                    We support chat commands now, use /help to find out more.";

// various settings for heylisten
exports.settings = {
    // a room with no users will be destroyed after this many miliseconds
    roomTimeout: 30000,
    // a user token will expire if the user has not been connected to a room for
    // this many minutes
    tokenTimeout: 30
};
