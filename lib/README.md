## youtube-castv2-client

youtube-castv2-client youtube sender. This is based on castv2-youtube, which appears to be abandoned.
This has been updated to work with the new protocol.

### Sample

```javascript
var Client                = require('castv2-client').Client;
var Youtube               = require('youtube-castv2-client').Youtube;
var mdns                  = require('mdns');
var sequence = [
  mdns.rst.DNSServiceResolve(),
  mdns.rst.getaddrinfo({ families: [0] }),
  mdns.rst.makeAddressesUnique(),
];
var browser = mdns.createBrowser(mdns.tcp('googlecast'), { resolverSequence: sequence });

browser.on('serviceUp', function(service) {
  console.log('found device "%s" at %s:%d', service.name, service.addresses[0], service.port);
  ondeviceup(service.addresses[0]);
  browser.stop();
});

browser.start();

function ondeviceup(host) {

  var client = new Client();
  client.connect(host, function() {
    console.log('connected, launching app ...');
    client.launch(Youtube, function(err, player) {
      player.load('69V__a49xtw');
    });
  });

  client.on('error', function(err) {
    console.log('Error: %s', err.message);
    client.close();
  });

}
```

### Installation

`npm install youtube-castv2-client`

## License
MIT
