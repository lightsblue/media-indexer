var myConfig = require('./my-config.js').MyConfiguration,
  s3 = require('aws2js').load('s3', myConfig.account, myConfig.secretKey),
  fs = require('fs'),
  http = require('http'),
  when = require('when'),
  ex = require('exiv2'),
  _ = require('underscore').underscore,
  ffmpegmeta = require('fluent-ffmpeg').Metadata;

(function () {
  'use strict';

  var start = new Date().getTime(),
    bucket = 'vihinen',
    host = bucket + '.s3.amazonaws.com',
    //objectPath = '0182ce9354f720a4dbe441127b1b104d', // IMG
    //objectPath = '002fde119fb97df7c912ae0788fe5f64', // MOV
    options = {
      host: host,
      port: 80,
      //path: 'http://' + host + '/' + objectPath,
      path: 'http://' + host + '/',
      method: 'GET',
      headers: { Host: host }
    },
    optionsStr = JSON.stringify(options),
    fetchMediaMetadata,
    failure;

  ////////////////////////////////////////////////////////////////////////////////
  //
  // Fetch a single file's metadata from S3.
  //
  ////////////////////////////////////////////////////////////////////////////////
  fetchMediaMetadata = function (id) {
    var deferred = when.defer(),
      data,
      options = JSON.parse(optionsStr);

    options.headers.Range = 'bytes=0-31999';
    options.path += id; // build up the HTTP Request path
    http.get(options, function (res) {
      var myFile = fs.createWriteStream('/tmp/' + id),
        size;
      res.pipe(myFile);
      res.on('end', function () {
        // "ContentType": "image/jpeg"
        // "ContentType": "video/quicktime"
        // "ContentType": "video/x-msvideo"
        if (res.statusCode !== 206 && res.statusCode !== 200) {
          deferred.reject('Request to ' + options.path + ' returned ' + res.statusCode + '.');
          return;
        }
        data = {contentType: res.headers['content-type']};
        if (res.headers['content-type'] === 'image/jpeg') {
          ex.getImageTags(myFile.path, function (err, tags) {
            if (err !== null) {
              deferred.reject(err);
            } else {
              data.dateTime = tags['Exif.Image.DateTime'];
              deferred.resolve(data);
            }
          });
        } else if (res.headers['content-type'] === 'video/quicktime') {
          size = res.headers['content-range'].split(/\//)[1];
          var tailOpts = JSON.parse(optionsStr); // lazy-man's clone
          tailOpts.path += id;
          tailOpts.headers.Range = 'bytes=-2000';
          http.get(tailOpts, function (res) {
            var tailBuf = new Buffer(2000),
              bytesWritten = 0,
              regex = /[0-9]{4}\-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\-[0-9]{4}/;
            res.on('data', function (chunkBuffer) {
              chunkBuffer.copy(tailBuf, bytesWritten, 0, chunkBuffer.length - 1);
              bytesWritten += chunkBuffer.length;
            });
            res.on('end', function () {
              var match = tailBuf.toString('ascii').match(regex);
              if (match.length > 0) {
                data.dateTime = match[0];
              }
              deferred.resolve(data);
            });
          }).on('error', deferred.reject);
        } else {
          deferred.resolve(null);
        }
      });
    });
    return deferred.promise;
  };

  //options.path = 'http://' + host + '/' + objectPath;

  failure = function (err) {
    console.log('Error: ' + err);
  };

  // IMG
  fetchMediaMetadata('0182ce9354f720a4dbe441127b1b104d').then(function (data) {
    console.log(data);
    console.log('took ' + (new Date().getTime() - start) + ' ms');
  }, failure);

  // MOV
  fetchMediaMetadata('002fde119fb97df7c912ae0788fe5f64').then(function (data) {
    console.log(data);
    console.log('took ' + (new Date().getTime() - start) + ' ms');
  }, failure);

}());
