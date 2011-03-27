var xml2js = require('node-xml2js-expat');
var redis = require('node_redis');
var http = require('http');
var https = require('https');
var sys = require('sys');
var querystring = require('querystring');

var client = redis.createClient();

var runVersion = Math.floor(Math.random() * 100000);

var basicAuthKey = process.argv[2];

function galleryResponseProcessor(res) {
    //sys.puts(sys.inspect(res));
    res.setEncoding('utf8');
    var data = '';
    res.on('data', function(chunk) {
        data += chunk;
    });
    res.on('end', function() {
        //sys.puts(data);
        processSmugXML(data);
    });
}

function processSmugXML(xml) {
    var parser = new xml2js.Parser();
    parser.on('end', function(result, error) {
        //sys.puts(sys.inspect(result, false, 10));

        var items = result.channel.item;
        var images = {
            list: [],
            data: {}
        };
        items.forEach(function(value, key, arr) {
            var data = {
                title: value.title,
                link: value.link,
                guid: value.guid['#']
            };
            images.list.push(data);
            images.data[value.guid['#']] = data;
        });

        postImages(images);
    });

    parser.parseString(xml);
};

function postImages(images) {
    // find new images
    var newImages = [];
    var multi = client.multi();
    images.list.forEach(function(value, key, arr) {
        multi.sadd('photos-' + runVersion, value.guid);
    });

    multi.exec(function(err, replies) {
        client.sdiff('photos-' + runVersion, 'photos', function(err, reply) {
            //sys.puts('diff', sys.inspect(reply, false, null));

            client.del('photos-' + runVersion);

            postPhotos(images, reply);
        });
    });
};

function postPhotos(images, newImageGuids) {
    newImageGuids.forEach(function(value, key, arr) {
        var photoData = images.data[value];
        client.sadd('photos', value);
        sys.puts('adding', sys.inspect(photoData));
        pubDent(photoData);
    });

    client.quit();
};

function pubDent(imageData) {
    var pub = function(url) {
        var query = querystring.stringify({
            status: '[Photo] ' + imageData.title + ' ' + url
        });

        var req = https.request(
            {
                host: 'identi.ca',
                port: 443,
                path: '/api/statuses/update.json?' + query,
                method: 'POST'
            },
            function (res) {
                res.setEncoding('utf8');

                var response = '';
                res.on('data', function(chunk) {
                    response += chunk;
                });

                res.on('end', function() {
                    sys.puts('response', response);
                });
            }
        );

        //var basic = 'Basic ' + new Buffer('username' + ':' + 'password').toString('base64');
        var basic = 'Basic ' + basicAuthKey;
        req.setHeader('Authorization', basic);

        sys.puts('writing to api', query);
        //req.write(query + '\n');
        req.end();
    };

    getShortUrl(imageData.link, pub);
};

function getShortUrl(url, callback) {
    var req = https.request(
        {
            host: 'www.googleapis.com',
            port: 443,
            method: 'POST',
            path: '/urlshortener/v1/url'
        },
        function (res) {
            res.setEncoding('utf8');

            var response = '';
            res.on('data', function(chunk) {
                response += chunk;
            });

            res.on('end', function() {
                sys.puts(response);
                var data = JSON.parse(response);
                sys.puts('got short url', data.id);
                callback(data.id);
            });
        }
    );

    req.setHeader('Content-Type', 'application/json');
    req.write(JSON.stringify({
        longUrl: url
    }));
    req.end();
};

http.get(
    {
        host: 'pics.angelo.dinardi.name',
        port: 80,
        path: '/hack/feed.mg?Type=gallery&Data=16271137_VcZ4h&format=rss200'
    },
    galleryResponseProcessor
);
