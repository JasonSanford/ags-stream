var Readable = require('stream').Readable
var util     = require('util');

var async   = require('async');
var request = require('request');
var _       = require('lodash');

var utils = require('./utils');

util.inherits(AgsStream, Readable);

function AgsStream (serviceUrl, options) {
  Readable.call(this, {objectMode: true});

  if (!serviceUrl) { throw new Error('A "serviceUrl" parameter is required.') }

  this.serviceUrl    = serviceUrl;
  this.options       = options || {};
  this.chunkSize     = this.options.chunkSize || 50;
  this.parallelLimit = 20;

  this._objectIdsCallback = utils.bind(this._objectIdsCallback, this);
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
    //console.log('chunks callback', results)
    this.push(null);
  }
};

AgsStream.prototype._processChunk = function (chunk, callback) {
  var me = this;

  var tasks = chunk.map(function (objectId) {
    return function (_callback) {
      me._fetchRecord(objectId, _callback);
    };
  });

  async.parallelLimit(tasks, this.parallelLimit, function (error, results) {
    if (error) {
      callback(error);
    } else {
      me.push(results)
      callback(null, results);
    }
  });
};

AgsStream.prototype._fetchRecord = function (objectId, callback) {
  var me = this;

  var qs = {
    objectIds      : objectId,
    outFields      : '*',
    returnGeometry : 'true',
    f              : 'json',
    outSR          : '4326'
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
      var agsFeature = body.features[0];
      callback(null, agsFeature)
      //me.push(agsFeature);
    }
  });
};

AgsStream.prototype._processChunksCallback = function (error, results) {
  if (error) {
    this.emit('error', new Error(error));
  } else {
    this.push(results);
  }
};

AgsStream.prototype._read = function () {
  
};

var serviceUrl = 'http://gis-web.co.union.nc.us/arcgis/rest/services/PWGIS_Web/Operational_Layers/MapServer/5';
var agsStream = new AgsStream(serviceUrl, {where: 'objectid<100'});

agsStream.on('data', function (data) {
  console.log('data: ', data);
});

agsStream.on('error', function (error) {
  console.log('error: ', error);
});

agsStream.on('end', function (data) {
  console.log('they done')
});

agsStream.read();
