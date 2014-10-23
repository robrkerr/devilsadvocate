var util = require('util');
var twitter = require('twitter');
var config = require('./config.js');
var twit = new twitter(config);

twit.search('sam harris', function(data) {
  console.log(util.inspect(data['statuses'].map(function(tweet) {
  	return tweet.text;
  })));
});