var myConfig = require('./my-config.js').MyConfiguration,
  fs = require('fs'),
  http = require('http'),
  when = require('when');

var start = new Date().getTime(),
  bucket = 'vihinen',
  host = bucket + '.s3.amazonaws.com',
  options = {
    host: host,
    port: 80,
    path: 'http://' + host + '/',
    method: 'GET',
    headers: { Host: host }
  },
  optionsStr = JSON.stringify(options),
  metadata,
  failure,
  getUserHome,
  extractBodyMetadata,
  count = 0;

// TODO Use this for finding S3 credentials
getUserHome = function () {
  return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
};

////////////////////////////////////////////////////////////////////////////////
//
// Extract the data given in the data hash from the specified range of object
// with id.  The data is an object literal of name-regex pairs.
//
////////////////////////////////////////////////////////////////////////////////
extractBodyMetadata = function (id, data, range) {
  'use strict';
  var deferred = when.defer(),
    tailOpts = JSON.parse(optionsStr); // lazy-man's clone
  tailOpts.path += id;
  tailOpts.headers.Range = range > 0 ? 'bytes=0-' + (range - 1) : 'bytes=' + range;
  http.get(tailOpts, function (res) {
    var tailBuf = new Buffer(Math.abs(range)),
      bytesWritten = 0;
    res.on('data', function (chunkBuffer) {
      chunkBuffer.copy(tailBuf, bytesWritten, 0, chunkBuffer.length - 1);
      bytesWritten += chunkBuffer.length;
    });
    res.on('end', function () {
      var key, regex, match;
      for (key in data) {
        if (data.hasOwnProperty(key)) {
          regex = data[key];
          match = tailBuf.toString('ascii').match(regex);
          if (match !== null && match.length > 0) {
            data[key] = match[0];
          } else {
            delete data[key];
          }
        }
      }
      if ((count % 100) === 0) {
        console.log('finishing ' + id + ' (and 100 others)');
      }
      count++;
      deferred.resolve(data);
    });
  }).end();
  return deferred.promise;
};

////////////////////////////////////////////////////////////////////////////////
//
// Fetch a single file's metadata from S3.
//
////////////////////////////////////////////////////////////////////////////////
metadata = function (id) {
  var deferred = when.defer(),
    data,
    options = JSON.parse(optionsStr);

  if (typeof id !== 'string') {
    deferred.reject('id of object must be of type string');
  }

  options.path += id; // build up the HTTP Request path
  options.method = 'HEAD';
  http.request(options, function (res) {
    res.on('end', function () {
      var regex;

      if (res.statusCode !== 206 && res.statusCode !== 200) {
        deferred.reject('Request to ' + options.path + ' returned ' + res.statusCode + '.');
        return;
      }
      data = {key: id, contentType: res.headers['content-type']};

      // "ContentType": "image/jpeg"
      // "ContentType": "video/quicktime"
      // "ContentType": "video/x-msvideo"

      if (res.headers['content-type'] === 'image/jpeg') {
        regex = /[0-9]{4}\:[0-9]{2}\:[0-9]{2} [0-9]{2}\:[0-9]{2}\:[0-9]{2}/;
        extractBodyMetadata(id, {dateTime: regex}, 2000).then(function (bodyMetadata) {
          var key, c, d;
          for (key in bodyMetadata) {
            if (bodyMetadata.hasOwnProperty(key)) {
              c = bodyMetadata[key].split(' ');
              d = c[0].replace(/:/g, '-');
              data[key] = d + 'T' + c[1];
            }
          }
          deferred.resolve(data);
        }, deferred.reject);
      } else if (res.headers['content-type'] === 'video/quicktime') {
        regex = /[0-9]{4}\-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\-[0-9]{4}/;
        extractBodyMetadata(id, {dateTime: regex}, -2000).then(function (bodyMetadata) {
          var key;
          for (key in bodyMetadata) {
            if (bodyMetadata.hasOwnProperty(key)) {
              data[key] = bodyMetadata[key];
            }
          }
          deferred.resolve(data);
        }, deferred.reject);
      } else {
        deferred.reject("Can't extract metadata for content type " + res.headers['content-type']);
      }
    });
  }).end();
  return deferred.promise;
};
exports.metadata = metadata;
