var util = require('util');
var twitter = require('twitter');
var auth = require('./auth.js');
var twit = new twitter(auth);

twit.search('#vegan', function(data) {
  console.log(util.inspect(data['statuses'].map(function(tweet) {
  	// console.log(tweet);
  	return {user: tweet.user.id, text: tweet.text};
  }).filter(function(tweet) {
  	return ((tweet.text.indexOf("http://") > -1) || (tweet.text.indexOf("https://") > -1));
  })));
});
