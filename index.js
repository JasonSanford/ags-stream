const { Readable } = require('stream');

const async = require('async');
const request = require('request');
const terraformer = require('terraformer-arcgis-parser');
const _ = require('lodash');

class AgsStream extends Readable {
  constructor(serviceUrl, options) {
    super({objectMode: true});

    if (!serviceUrl) {
      this.emit('error', new Error('A "serviceUrl" parameter is required.'));
    }

    this.serviceUrl = serviceUrl;
    this.options = options || {};
    this.chunkSize = this.options.chunkSize || 50;
    this.where = this.options.where || '1=1';
    this.outSR = this.options.outSR || '4326';
    this.qs = this.options.qs || {};

    this._objectIdsCallback = this._objectIdsCallback.bind(this);
    this._processChunksCallback = this._processChunksCallback.bind(this);

    this._getObjectIds();
  }

  _getObjectIds() {
    const qs = Object.assign({
      returnIdsOnly: 'true',
      f: 'json',
      where: this.where
    }, this.qs);

    const objectIdsRequestOptions = {
      uri: `${this.serviceUrl}/query`,
      qs: qs,
      json: true
    };
  
    request(objectIdsRequestOptions, this._objectIdsCallback);
  }

  _objectIdsCallback(error, response, body) {
    if (error) {
      this.emit('error', new Error(error));
    } else {
      const objectIds = body.objectIds;

      this.objectIdChunks = _.chain(objectIds).groupBy((element, index) => Math.floor(index / this.chunkSize)).toArray().value();

      this._processChunks();
    }
  }

  _processChunks() {
    const tasks = this.objectIdChunks.map((chunk) => {
      return (callback) => {
        this._processChunk(chunk, callback);
      };
    });

    async.series(tasks, this._processChunksCallback);
  }

  _processChunksCallback(error) {
    if (error) {
      this.emit('error', new Error(error));
    } else {
      this.push(null);
    }
  }

  _processChunk(chunk, callback) {
    const qs = {
      objectIds: chunk.join(','),
      outFields: '*',
      returnGeometry: 'true',
      f: 'json',
      outSR: this.outSR
    };

    const featureRequestOptions = {
      uri: `${this.serviceUrl}/query`,
      qs: qs,
      json: true
    };

    request(featureRequestOptions, (error, response, body) => {
      if (error) {
        this.emit('error', new Error(error));
      } else {
        const geojsonFeatures = body.features.map(feature => terraformer.parse(feature));
        this.push(geojsonFeatures);
        callback(null, geojsonFeatures);
      }
    });
  }

  _read() {}
}

module.exports = AgsStream;
