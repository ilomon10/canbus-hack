const can = require("socketcan");

const channel = can.createRawChannel("can0", true);

// Log any message
channel.addListener("onMessage", function (msg) {
    console.log(String(msg.data));
});

// Reply any message
channel.addListener("onMessage", channel.send, channel);

channel.start();
