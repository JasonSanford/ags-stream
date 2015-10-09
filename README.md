## ags-stream

ags-stream creates a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable) of GeoJSON Features from an ArcGIS Server instance. This can be useful for scraping records from any ArcGIS Server or any other ETL process.

ags-stream is currently used in [fulcrum-ags-import](https://github.com/fulcrumapp/fulcrum-ags-import) to import ArcGIS Server records into [Fulcrum](http://fulcrumapp.com) and [ags-shapefile](https://github.com/JasonSanford/shapefile-ags) to export shapefiles from ArcGIS Server instances.

### Installation

    npm install ags-stream

### Usage

```javascript
var AgsStream = require('ags-stream');
var agsStream = new AgsStream(<service_url>, <options>?)

agsStream.on('data', function (data) {
  // data is an array of GeoJSON features
  data.forEach(function (feature) {
    doWhatever(feature); // Add the feature to you database, write to file, whatever
  });
});

agsStream.on('error', function (error) {
  console.log('Oh boy, this happened: ', error);
});

agsStream.on('end', function () {
  console.log('All done.'); // There is no more data to read.
});
```

The `service_url` parameter represents a single layer in an ArcGIS Server map service. It should look something like `http://gis-web.co.union.nc.us/arcgis/rest/services/PWGIS_Web/Operational_Layers/MapServer/5`.

`options` is optional and accepts the following:

Option | Description | Default
------ | ----------- | -------
`chunkSize` | The number of features to fetch per request to the AGS instance | 50
`where` | The where clause for querying the service layer | '1=1' (all features)
`outSR` | The [srid](http://spatialreference.org/) for the returned geometry | 4326 (lat, lng)
