# node-red-contrib-cast for NodeRED

[![NPM version](https://badge.fury.io/js/node-red-contrib-cast.svg)](http://badge.fury.io/js/node-red-contrib-cast)
[![Dependencies Status](https://david-dm.org/hypnos3/node-red-contrib-cast/status.svg)](https://david-dm.org/hypnos3/node-red-contrib-cast)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

These nodes are based on a fork of the node-red-contrib-chromecast. It is for play media on a chromecast or a google home device.

## Installation

`npm install node-red-contrib-cast`

## Quick Start

Simple flow that sends an mp3 to the chromecast or google cast device:
    [{"id":"a21f1807.41d7f8","type":"cast-to-client","z":"d900d7d9.c4c498","name":"","url":null,"contentType":"","message":null,"language":"en","ip":"","port":"","volume":null,"x":590,"y":80,"wires":[["fba1eb3.2515918"]]},{"id":"74313baf.f282f4","type":"inject","z":"d900d7d9.c4c498","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":160,"y":80,"wires":[["53d91dd8.67b924"]]},{"id":"53d91dd8.67b924","type":"change","z":"d900d7d9.c4c498","name":"","rules":[{"t":"set","p":"ip","pt":"msg","to":"192.168.1.125","tot":"str"},{"t":"set","p":"url","pt":"msg","to":"http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=32&client=tw-ob&q=Word%20Up&tl=En-gb","tot":"str"},{"t":"set","p":"contentType","pt":"msg","to":"audio/mp3","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":380,"y":80,"wires":[["a21f1807.41d7f8"]]},{"id":"fba1eb3.2515918","type":"debug","z":"d900d7d9.c4c498","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":790,"y":80,"wires":[]},{"id":"9ef34079.24061","type":"comment","z":"d900d7d9.c4c498","name":"stream a url","info":"","x":130,"y":40,"wires":[]}]

Simple flow that sends an text to Google TTS and the result to a the chromecast or google cast device:
[{"id":"8d9663a.05e27a","type":"cast-to-client","z":"d900d7d9.c4c498","name":"","url":null,"contentType":"","message":null,"language":"en","ip":"","port":"","volume":null,"x":590,"y":200,"wires":[["b885e401.447548"]]},{"id":"6faf449b.c11efc","type":"inject","z":"d900d7d9.c4c498","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":160,"y":200,"wires":[["23bdf480.46b85c"]]},{"id":"23bdf480.46b85c","type":"change","z":"d900d7d9.c4c498","name":"","rules":[{"t":"set","p":"ip","pt":"msg","to":"192.168.1.125","tot":"str"},{"t":"set","p":"url","pt":"msg","to":"Word Up","tot":"str"},{"t":"set","p":"language","pt":"msg","to":"En-gb","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":380,"y":200,"wires":[["8d9663a.05e27a"]]},{"id":"b885e401.447548","type":"debug","z":"d900d7d9.c4c498","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":790,"y":200,"wires":[]},{"id":"9a5a2ce.5ae7ed","type":"comment","z":"d900d7d9.c4c498","name":"say a text","info":"","x":120,"y":160,"wires":[]}]


## Implemented Nodes

 * Play Node - Send media to chromecast or googole home devices

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