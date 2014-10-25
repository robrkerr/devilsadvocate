var RSVP = require('rsvp');
var twitter = require('twitter');
var unshortener = require('unshortener');
var auth = require('./auth.js');
var twit = new twitter(auth);

var twitter_get = function(url) {
	return new RSVP.Promise(function(resolve, reject) {
		twit.get(url, function(data) {
			if (data.statusCode) {
				console.log(data);	
				reject();
			}
			resolve(data);
		});
	});
};

function expand_url(short_url) {
	return new RSVP.Promise(function(resolve, reject) {
		unshortener.expand(short_url, function(err, url) {
			if (err) {
				console.log(err);
				resolve(short_url);
			} else {
				resolve(url.href.split("?")[0]);
			}
		});
	});
}

function get_retweeters(tweet) {
	return new RSVP.Promise(function(resolve, reject) {
		resolve([]);
	});
	// var url = '/statuses/retweets/' + tweet.id_str + '.json';
	// return twitter_get(url).then(function(data) {
	// 	return data.map(function(tweet) {
	// 		return tweet.user.id_str;
	// 	});
	// });	
}

function parse_tweet(t) {
	var expand_promises = t.entities.urls.map(function(url) { 
		return expand_url(url.expanded_url); 
	});
	var promises = expand_promises.concat(get_retweeters(t));
	return RSVP.all(promises).then(function(list) {
		// console.log(list);
	  return {
  		id: t.id_str,
  		urls: list.slice(0,list.length-1),
  		hashtags: t.entities.hashtags.map(function(tag) { return tag.text; }),
  		retweet_count: t.retweet_count,
  		retweeters: list[list.length-1].sort(),
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

function get_tweets(hashtag, count, max_id) {
	if (!count) {
		count = 100;
	}
	var url = '/search/tweets.json?q=%23' + hashtag;
	if (count < 100) {
		url = url + '&count=' + count + '&result_type=recent';
	} else {
		url = url + '&count=100&result_type=recent';
	}
	if (max_id) {
		url = url + '&max_id=' + max_id; 
	}
	return twitter_get(url).then(function(data) {
		if (max_id) {
			var tweets = data['statuses'].slice(1);
		} else {
			var tweets = data['statuses'];
		}
		var parse_promise = parse_and_filter_tweets(tweets);
		if (count > 100) {
			var more_promise = get_tweets(hashtag, count-100, max_id);
			return RSVP.all([parse_promise, more_promise]).then(function(responses) {
				return responses[0].concat(responses[1]);
			});
		} else {
			return parse_promise;
		}
	});	
}

function intersection(a1,a2) {
	return a1.filter(function(e1) {
    return a2.indexOf(e1) != -1;
	});	
}

// var hashtag = 'islamophobia';
// var hashtag = 'obama';
var hashtag = 'ebola';
get_tweets(hashtag, 300).then(function(tweets) {
	console.log(tweets);
	console.log(tweets.length);
	// console.log(tweets[0].retweeters.length);
	// console.log(intersection(tweets[0].retweeters,tweets[1].retweeters));
}).catch(function(error) {
  console.log(error);
});
