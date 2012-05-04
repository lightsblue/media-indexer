var myConfig = require('./my-config.js').MyConfiguration,
  s3 = require('aws2js').load('s3', myConfig.account, myConfig.secretKey),
  fs = require('fs'),
  when = require('when');

(function () {
  'use strict';

  s3.setBucket('vihinen');

  var maxKeys = 1000,
    objects = {},
    getHead,
    getMedia,
    failure,
    saveContentType,
    headPromises = [],
    start = new Date().getTime();

  ////////////////////////////////////////////////////////////////////////////////
  //
  // Get the head of an S3 object.
  //
  ////////////////////////////////////////////////////////////////////////////////
  getHead = function (key) {
    var deferred = when.defer();

    s3.head('/' + key, function (error, data) {
      if (error !== null) {
        deferred.reject(error);
      } else {
        deferred.resolve({key: key, data: data});
      }
    });

    return deferred.promise;
  };

  ////////////////////////////////////////////////////////////////////////////////
  //
  // Recursively get page listings of objects from Amazon.
  //
  ////////////////////////////////////////////////////////////////////////////////
  getMedia = function () {
    var deferred = when.defer(),
      //headPromises = [],
      getPage;

    getPage = function (marker) {
      var url = '?prefix=&max-keys=' + maxKeys,
        lastKey,
        curKey,
        i;
      if (typeof marker !== 'undefined') {
        url += '&marker=' + marker;
      }
      s3.get(url, 'xml', function (error, data) {
        if (error !== null) {
          deferred.reject(error);
        } else {
          for (i = 0; i < data.Contents.length; i++) {
            curKey = data.Contents[i].Key;
            objects[curKey] = data.Contents[i];
          }
          console.log(Object.keys(objects).length + ' objects so far...');
          if (data.IsTruncated === 'true') {
            lastKey = data.Contents[data.Contents.length - 1].Key;
            getPage(lastKey);
          } else {
            deferred.resolve();
          }
        }
      });
    };
    getPage();
    return deferred.promise;
  };

  saveContentType = function (data) {
    objects[data.key].ContentType = data.data['content-type'];
  };

  failure = function (error) {
    console.log('Media indexing failed: ' + error);
  };

  ////////////////////////////////////////////////////////////////////////////////
  //
  // Build the media index, writing to a file when done.
  //
  ////////////////////////////////////////////////////////////////////////////////
  getMedia().then(function () {
    var i,
      objectCount = Object.keys(objects).length;

    console.log(objectCount + ' total objects found.');

    Object.keys(objects).forEach(function (curKey) {
      var headPromise = getHead(curKey);
      headPromises.push(headPromise);
      headPromise.then(saveContentType);
    });

    when.all(headPromises).then(function () {
      console.log('Retrieved all content types.');
      console.log('Fetched objects and content types in ' + (new Date().getTime() - start) + ' ms.');

      fs.writeFile("./media.json", JSON.stringify(objects, null, 2), function (err) {
        if (err) {
          failure(err);
        } else {
          console.log("The file was saved.");
        }
      });
    }, failure);
  }, failure);

}());
