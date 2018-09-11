# node-red-contrib-cast for NodeRED

These nodes are based on a fork of the node-red-contrib-chromecast. It is for play media on a chromecast or a google home device.

## Installation

`npm install node-red-contrib-cast`

## Quick Start

Simple flow that sends an mp3 to the chromecast:

    [{"id":"2789229c.d876de","type":"chromecast-play","z":"a83f67b9.57c098","name":"","x":413.5,"y":115,"wires":[["bf26f40d.40d908"]]},{"id":"bf16e7cb.40e918","type":"inject","z":"a83f67b9.57c098","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"x":141.5,"y":117,"wires":[["647d6115.9b82a"]]},{"id":"bf26f40d.40d908","type":"debug","z":"a83f67b9.57c098","name":"","active":true,"console":"false","complete":"false","x":574.5,"y":115,"wires":[]},{"id":"647d6115.9b82a","type":"function","z":"a83f67b9.57c098","name":"","func":"msg.payload = {\n    ip: '192.168.1.125',\n    url: 'http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=32&client=tw-ob&q=Word%20Up&tl=En-gb',\n    contentType: 'audio/mp3'\n}\nreturn msg;","outputs":1,"noerr":0,"x":286.5,"y":115,"wires":[["2789229c.d876de"]]}]

## Implemented Nodes

 * Play Node - Send media to chromecast or 
 * Discovery Node - (TODO) Discover nearby chromecasts
