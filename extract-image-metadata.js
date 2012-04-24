var myConfig = require('./my-config.js').MyConfiguration,
  s3 = require('aws2js').load('s3', myConfig.account, myConfig.secretKey),
  fs = require('fs'),
  http = require('http'),
  when = require('when'),
  ex = require('exiv2');

(function () {
  'use strict';

  var start = new Date().getTime(),
    bucket = 'vihinen',
    host = bucket + '.s3.amazonaws.com',
    objectPath = '0182ce9354f720a4dbe441127b1b104d',
    options = {
      host: host,
      port: 80,
      method: 'GET',
      path: 'http://' + host + '/' + objectPath,
      headers: {
        Host: host,
        Range: 'bytes=0-31999'
      }
    };

  http.get(options, function (res) {
    console.log(res);
    var myFile = fs.createWriteStream('myOutput.txt');
    res.pipe(myFile);
    res.on('end', function () {
      ex.getImageTags(myFile.path, function (err, tags) {
        if (typeof err !== null) {
          console.log('Error: ' + err);
        }
        console.log('tags', tags);
        console.log('took ' + (new Date().getTime() - start) + ' ms');
      });
    });
  });

}());
