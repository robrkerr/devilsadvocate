var RSVP = require('rsvp');
var request = RSVP.denodeify(require('request'));
var twitter = require('twitter');
var auth = require('./auth.js');
var twit = new twitter({
	consumer_key: auth.consumer_key,
	consumer_secret: auth.consumer_secret,
	access_token_key: auth.access_token_key,
	access_token_secret: auth.access_token_secret
});

var do_expanding = false;

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

function strip_utm_params(url) {
	return url.split('?utm')[0].split('&utm')[0];
}

function expand_url(short_url) {
	if (do_expanding) {
		var base_url = 'http://api.unshorten.it?responseFormat=json&return=fullurl';
		var url = base_url + '&shortURL=' + short_url + '&apiKey=' + auth.unshortenit_api_key;
		var options = {url: url, cache: true};
		return request(options).then(function(response) {
			try {
				var data = JSON.parse(response.body);	
				if (data.fullurl) {
					return strip_utm_params(data.fullurl);	
				} else {
					return strip_utm_params(short_url);	
				}
			} catch(e) {
				return strip_utm_params(short_url);	
			}
		});	
	} else {
		return new RSVP.Promise(function(resolve, reject) {
			resolve(strip_utm_params(short_url));
		});	
	}
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
		return expand_url(url.expanded_url).catch(function(error) {
			console.log(error);
		}); 
	});
	var promises = expand_promises.concat(get_retweeters(t));
	return RSVP.all(promises).then(function(list) {
		// console.log('foo');
		var a = {
  		id: t.id_str,
  		urls: list.slice(0,list.length-1),
  		hashtags: t.entities.hashtags.map(function(tag) { return tag.text; }),
  		retweet_count: t.retweet_count,
  		retweeters: list[list.length-1],
  		user: t.user.id_str
  	};
  	// console.log('goo');
	  return a;
	}).catch(function(error) {
		console.log(error);
	});
}

function parse_and_filter_tweets(tweets) {
	var filtered_tweets = tweets.filter(function(t) {
		return (t.retweet_count > 0) && (t.entities.urls.length > 0) && (t.entities.hashtags.length > 0);
	});
	return RSVP.all(filtered_tweets.map(function(t) {
		return parse_tweet(t);
	})).then(function(tweets) {
		console.log('Processed ' + tweets.length + ' more tweets');
		return tweets;
	});
}

function get_tweets(hashtag, count, max_id) {
	if (!count) {
		count = 100;
	}
	var url = '/search/tweets.json?q=%23' + hashtag + '&result_type=recent';
	if (count < 100) {
		url = url + '&count=' + count;
	} else {
		url = url + '&count=100';
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
		var lowest_id = tweets.map(function(t) { return t.id_str; }).sort()[0];
		var parse_promise = parse_and_filter_tweets(tweets);
		if (count > 100) {
			var more_promise = get_tweets(hashtag, count-100, lowest_id);
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

var links = {};
var time = Date.now()

// var hashtag = 'islamophobia';
// var hashtag = 'obama';
var hashtag = 'ebola';
var num_tweets = 500;
get_tweets(hashtag, num_tweets).then(function(tweets) {
	console.log('done.')
	tweets.map(function(tweet) {
		tweet.urls.map(function(url) {
			if (links[url]) {
				if (links[url].users.indexOf(tweet.user) == -1) {
					links[url].users.push(tweet.user);
				}
				tweet.hashtags.map(function(tag) {
					if (links[url].hashtags.indexOf(tag) == -1) {
						links[url].hashtags.push(tag);
					}
				});
			} else {
				links[url] = {url: url, users: [tweet.user], hashtags: tweet.hashtags};
			}
		});
	});
	// console.log(tweets);
	// console.log(tweets.length);
	console.log(Object.keys(links).map(function(key) { 
		return links[key]; 
	}).sort(function(a,b) { 
		return b.users.length - a.users.length; 
	}));
	console.log('Ran in ' + (Date.now() - time)/(1000) + ' seconds.');
	// console.log(tweets[0].retweeters.length);
	// console.log(intersection(tweets[0].retweeters,tweets[1].retweeters));
}).catch(function(error) {
  console.log(error);
});

