var myConfig = require('./my-config.js').MyConfiguration,
  extract = require('./extract-media-metadata.js');

(function () {
  'use strict';

  var start = new Date().getTime(),
    bucket = 'vihinen',
    host = bucket + '.s3.amazonaws.com',
    failure;

  failure = function (err) {
    console.log('Error: ' + err);
  };

  // IMG
  extract.metadata('0182ce9354f720a4dbe441127b1b104d').then(function (data) {
    console.log(data);
    console.log('took ' + (new Date().getTime() - start) + ' ms');
  }, failure);

  // MOV
  extract.metadata('002fde119fb97df7c912ae0788fe5f64').then(function (data) {
    console.log(data);
    console.log('took ' + (new Date().getTime() - start) + ' ms');
  }, failure);

}());
