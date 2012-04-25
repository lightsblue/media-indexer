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
      headers: {
        Host: host,
        Range: 'bytes=0-31999'
      }
    },
    fetchImageMetadata,
    failure;

  ////////////////////////////////////////////////////////////////////////////////
  //
  // Fetch a single file's metadata from S3.
  //
  ////////////////////////////////////////////////////////////////////////////////
  fetchImageMetadata = function (options) {
    var deferred = when.defer(),
      data;
    http.get(options, function (res) {
      var myFile = fs.createWriteStream('/tmp/' + objectPath);
      res.pipe(myFile);
      res.on('end', function () {
        // "ContentType": "image/jpeg"
        // "ContentType": "video/quicktime"
        // "ContentType": "video/x-msvideo"
        console.log(res.statusCode);
        if (res.statusCode !== 206) {
          deferred.reject('Request to ' + options.path + ' returned ' + res.statusCode + '.');
          return;
        }
        data = {contentType: res.headers['content-type']};
        if (res.headers['content-type'] === 'image/jpeg') {
          ex.getImageTags(myFile.path, function (err, tags) {
            if (err !== null) {
              deferred.reject(err);
            } else {
              //console.log(tags);
              data.dateTime = tags['Exif.Image.DateTime'];
              data.cameraMake = tags['Exif.Image.Make'];
              data.cameraModel = tags['Exif.Image.Model'];
              deferred.resolve(data);
            }
          });
        } else {
          deferred.resolve(data);
        }
      });
    });
    return deferred.promise;
  };

  options.path = 'http://' + host + '/' + objectPath;

  failure = function (err) {
    console.log('Error: ' + err);
  };

  fetchImageMetadata(options).then(function (data) {
    console.log(data);
    console.log('took ' + (new Date().getTime() - start) + ' ms');
  }, failure);
}());
