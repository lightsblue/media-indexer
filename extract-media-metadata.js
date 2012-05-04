var myConfig = require('./my-config.js').MyConfiguration,
  fs = require('fs'),
  http = require('http'),
  when = require('when'),
  ex = require('exiv2');

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
  getUserHome;

getUserHome = function () {
  return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
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
exports.metadata = metadata;
