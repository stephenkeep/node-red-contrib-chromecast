# node-red-contrib-cast for NodeRED

[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/hypnos3/node-red-contrib-cast/graphs/commit-activity)
[![GitHub version](https://badge.fury.io/gh/Hypnos3%2Fnode-red-contrib-cast.svg)](https://github.com/hypnos3/node-red-contrib-cast)
[![NPM version](https://badge.fury.io/js/node-red-contrib-cast.svg)](http://badge.fury.io/js/node-red-contrib-cast)
[![HitCount](http://hits.dwyl.io/hypnos3/node-red-contrib-cast.svg)](http://hits.dwyl.io/hypnos3/node-red-contrib-cast)
[![Dependencies Status](https://david-dm.org/hypnos3/node-red-contrib-cast/status.svg)](https://david-dm.org/hypnos3/node-red-contrib-cast)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Issues](https://img.shields.io/github/issues/hypnos3/node-red-contrib-cast.svg?style=flat-square)](https://github.com/hypnos3/node-red-contrib-cast/issues)

These nodes are based on a fork of the node-red-contrib-chromecast. It is for play media on a chromecast or a google home device.

> Warning, this is still in development!!

## Installation

`npm install node-red-contrib-cast`

## Quick Start

Simple flow that sends an mp3 to the chromecast or google cast device:

![example 1](images/example1.png?raw=true "Echo Flow")

    `[{"id":"a21f1807.41d7f8","type":"cast-to-client","z":"d900d7d9.c4c498","name":"","url":null,"contentType":"","message":null,"language":"en","ip":"","port":"","volume":null,"x":590,"y":80,"wires":[["fba1eb3.2515918"]]},{"id":"74313baf.f282f4","type":"inject","z":"d900d7d9.c4c498","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":160,"y":80,"wires":[["53d91dd8.67b924"]]},{"id":"53d91dd8.67b924","type":"change","z":"d900d7d9.c4c498","name":"","rules":[{"t":"set","p":"ip","pt":"msg","to":"192.168.1.125","tot":"str"},{"t":"set","p":"url","pt":"msg","to":"http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=32&client=tw-ob&q=Word%20Up&tl=En-gb","tot":"str"},{"t":"set","p":"contentType","pt":"msg","to":"audio/mp3","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":380,"y":80,"wires":[["a21f1807.41d7f8"]]},{"id":"fba1eb3.2515918","type":"debug","z":"d900d7d9.c4c498","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":790,"y":80,"wires":[]},{"id":"9ef34079.24061","type":"comment","z":"d900d7d9.c4c498","name":"stream a url","info":"","x":130,"y":40,"wires":[]}]`

Simple flow that sends an text to Google TTS and the result to a the chromecast or google cast device:

![example 2](images/example2.png?raw=true "Echo Flow")

    `[{"id":"8d9663a.05e27a","type":"cast-to-client","z":"d900d7d9.c4c498","name":"","url":null,"contentType":"","message":null,"language":"en","ip":"","port":"","volume":null,"x":590,"y":200,"wires":[["b885e401.447548"]]},{"id":"6faf449b.c11efc","type":"inject","z":"d900d7d9.c4c498","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":160,"y":200,"wires":[["23bdf480.46b85c"]]},{"id":"23bdf480.46b85c","type":"change","z":"d900d7d9.c4c498","name":"","rules":[{"t":"set","p":"ip","pt":"msg","to":"192.168.1.125","tot":"str"},{"t":"set","p":"url","pt":"msg","to":"Word Up","tot":"str"},{"t":"set","p":"language","pt":"msg","to":"En-gb","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":380,"y":200,"wires":[["8d9663a.05e27a"]]},{"id":"b885e401.447548","type":"debug","z":"d900d7d9.c4c498","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":790,"y":200,"wires":[]},{"id":"9a5a2ce.5ae7ed","type":"comment","z":"d900d7d9.c4c498","name":"say a text","info":"","x":120,"y":160,"wires":[]}]`

## Implemented Nodes

 * Play Node - Send media to chromecast or googole home devices

## How to use

The cast node has a couple of settings, which can be provided by the configuration or by the incomming message object.

Configuration posibilities:
![configuration of the node](images/node-cast-properties.png?raw=true "Echo Flow")

Options for the incomming message object:
  - **IP**, `msg.url` or `msg.payload.url` the IP address of the device to cast the media. Could also be defined in the configuration of the node.
  - **Port**, `msg.port` or `msg.payload.port` the port of the device (if not given default <code>8009</code> will be used).
  - **Media Url**, `msg.url` or `msg.payload.url` url to a media file which should be cast to the cast device. For a chromecast this chould be a media or a viideo file. For a Google Home device without a display this could only a audio file.
  - **Media Type**, `msg.contentType` or `msg.payload.contentType` the content type of the file in the url. This property is required if a url is given. Could also be defined in the configuration of the node.
  - **Message**, `msg.message` or `msg.payload.message` a text which should be send to the google tts engine to convert to a mp3 file.
  - **Language**, `msg.language` or `msg.payload.language` the language which should be used for conveting the message to the media file.
  - **Volume**, `msg.volume` or `msg.payload.volume` the volume should be set.

- Additional options not configurable:
    - `msg.lowerVolumeLimit` or `msg.payload.lowerVolumeLimit` will set the volume to this value, if the current volume is below this value.
    - `msg.upperVolumeLimit` or `msg.payload.upperVolumeLimit` will set the volume to this value, if the current volume is above this limit.
    - `msg.muted` or `msg.payload.muted` the volume will be muted if set to false, otherwise the volume will be unmuted.


So the config can be at 3 places. The config of the node, a property of the `msg.payload` or a property of the `msg` object. The information is loaded in that order (e.g. url):
  - _(1st)_ If the `msg.payload` is a object and contains a property `msg.payload.url` this setting will be used.
    - _(2nd)_ otherwise if the `msg` object contains the property `msg.url` this setting will be used.
      - _(3rd)_ otherwise if in the configuration the **Media Url** property is set this url will be used.

## Bugs and Feedback

For bugs, questions and discussions please use the
[GitHub Issues](https://github.com/Hypnos3/node-red-contrib-cast/issues).

## LICENSE

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
