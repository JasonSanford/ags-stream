var Readable = require('stream').Readable
var util     = require('util');

var async   = require('async');
var request = require('request');
var _       = require('lodash');

var utils = require('./utils');

util.inherits(AgsStream, Readable);

function AgsStream (serviceUrl, options) {
  Readable.call(this, {objectMode: true});

  //if (!serviceUrl) { throw new Error('A "serviceUrl" parameter is required.') }
  if (!serviceUrl) { this.emit('error', new Error('A "serviceUrl" parameter is required.')) }

  this.serviceUrl    = serviceUrl;
  this.options       = options || {};
  this.chunkSize     = this.options.chunkSize || 50;

  this._objectIdsCallback     = utils.bind(this._objectIdsCallback, this);
  this._processChunksCallback = utils.bind(this._processChunksCallback, this);

  this._getObjectIds();
}

AgsStream.prototype._getObjectIds = function () {
  var qs = {
    returnIdsOnly : 'true',
    f             : 'json',
    where         : this.options.where || '1=1'
  };
  var objectIdsRequestOptions = {
    uri  : this.serviceUrl + '/query',
    qs   : qs,
    json : true
  };

  request(objectIdsRequestOptions, this._objectIdsCallback);
};

AgsStream.prototype._objectIdsCallback = function (error, response, body) {
  var chunkSize = this.chunkSize;

  if (error) {
    this.emit('error', new Error(error));
  } else {
    var objectIds = body.objectIds;

    this.objectIdChunks = _.chain(objectIds).groupBy(function(element, index){
      return Math.floor(index / chunkSize);
    }).toArray().value();;

    this._processChunks();
  }
};

AgsStream.prototype._processChunks = function () {
  var me = this;

  var tasks = this.objectIdChunks.map(function (chunk) {
    return function(callback) {
      me._processChunk(chunk, callback);
    };
  });

  async.series(tasks, this._processChunksCallback);
};

AgsStream.prototype._processChunksCallback = function (error, results) {
  if (error) {
    this.emit('error', new Error(error));
  } else {
    this.push(null);
  }
};

AgsStream.prototype._processChunk = function (chunk, callback) {
  var me = this;

  var qs = {
    objectIds      : chunk.join(','),
    outFields      : '*',
    returnGeometry : 'true',
    f              : 'json',
    outSR          : this.options.outSR || '4326'
  };
  var featureRequestOptions = {
    uri  : this.serviceUrl + '/query',
    qs   : qs,
    json : true
  };

  request(featureRequestOptions, function (error, response, body) {
    if (error) {
      self.emit('error', new Error(error));
    } else {
      var features = body.features;
      me.push(features);
      callback(null,features)
    }
  });
};

AgsStream.prototype._read = function () {
  
};

var serviceUrl = 'http://gis-web.co.union.nc.us/arcgis/rest/services/PWGIS_Web/Operational_Layers/MapServer/5';
var agsStream = new AgsStream(serviceUrl, {chunkSize: 5, where: 'objectid<100', outSR: 2264});

agsStream.on('data', function (data) {
  console.log('data: ', data[0]);
});

agsStream.on('error', function (error) {
  console.log('error: ', error);
});

agsStream.on('end', function (data) {
  console.log('they done')
});

agsStream.read();
