var RSVP = require('rsvp');
var promiseRequest = RSVP.denodeify(require('request'));
var twitter = require('twitter');
var auth = require('./auth.js');
var twit = new twitter(auth);

var twitter_get = function(url) {
	return new RSVP.Promise(function(resolve, reject) {
		twit.get(url, function(data) {
			resolve(data);
		});
	});
};

function expand_url(short_url) {
	var options = {method: 'HEAD', url: short_url, followAllRedirects: true};
	return promiseRequest(options).then(function(response) {
		return response.request.href.split('?')[0];
	});
}

function parse_tweet(t) {
	var expand_promises = t.entities.urls.map(function(url) { 
		return expand_url(url.expanded_url); 
	});
	return RSVP.all(expand_promises).then(function(urls) {
	  return {
  		id: t.id_str,
  		urls: urls,
  		hashtags: t.entities.hashtags.map(function(tag) { return tag.text; }),
  		retweet_count: t.retweet_count,
  		user: t.user.id_str
  	};
	});
}

function parse_and_filter_tweets(tweets) {
	return RSVP.all(tweets.map(function(t) {
		return parse_tweet(t);
	})).then(function(list) {
		return list.filter(function(t) {
  		return (t.retweet_count > 0) && (t.urls.length > 0) && (t.hashtags.length > 0);
  	});
	});
}

function get_popular_tweets(hashtag) {
	var url = '/search/tweets.json?q=%23' + hashtag + '&count=100&result_type=popular';
	return twitter_get(url).then(function(data) {
		return parse_and_filter_tweets(data['statuses']);
	});	
}

var hashtag = 'islamophobia';
get_popular_tweets(hashtag).then(function(tweets) {
	console.log(tweets);
});

// twit.get('/statuses/retweets/525664776157163520.json', function(data) {
//   console.log(util.inspect(data.map(function(tweet) {
//   	return tweet.entities.urls.map(function(url) { return url.expanded_url});
//   })));
// });
