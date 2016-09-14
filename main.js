console.log("Starting ...");

// ### Requirements
const net = require("net");
const irc = require("irc");

var proxyHost = "127.0.0.1";
var proxyPort = 8000;

// ### Utils
exports.utils = new ((function() {

   function _Class() {}

   _Class.prototype.ipToHex = function(str) {
      var nums = str.split('.', 4);
      var bytes = new Array(4);
      for (i = 0; i < 4; ++i) {
         if (isNaN(bytes[i] = +nums[i]))
            throw new Error('Error parsing IP: ' + str);
      }

      return bytes;
   }

   return _Class;

})());

// ### The IRC Bot
exports.xdcc_bot = new ((function() {

   function _Class() {
      this.localServer = null;
      this.ircServer = null;
   }

   _Class.prototype.create = function(proxySocket) {
      var self = this;

      // Create a new server
      self.localServer = net.createServer(function(clientSocket) {
         console.log("Forwarding traffic to proxy");
         // When a client connects, do not accept new connections and pipe all trafic
         clientSocket.pipe(proxySocket);
         proxySocket.pipe(clientSocket);
      });
      self.localServer.listen(function() {
         console.log("Listening on " + this.address().port);

         // When listening was succes we can connect to it
         console.log("Connecting to IRC");
         self.ircServer = new irc.Client(proxyHost, "JJ-Whatismyname", {
            channels: ["#the.source"],
            userName: "irc-client",
            realName: "This is very secret!",
            port: self.localServer.address().port
         });

         self.ircServer.addListener('error', function(message) {
            console.log('error: ', message);
         });

         self.ircServer.addListener('registered', function(message) {
            console.log('Registered on server: %s: %s', message.rawCommand, message.command);
         });

         self.ircServer.addListener('message', function(nick, to, text, message) {
            console.log('[%s] <%s> %s', to, nick, text);
         });
      });

      return this;
   };

   return _Class;

})());

// Connect to a socks proxy and initiate a new TCP STREAM connection
var xdccBot = null;
var proxy = net.connect(proxyPort, proxyHost, function() {
   console.log("Connected to the proxy. Lets handshake");
   var listener = function(data) {
      console.log("handshake - received " + data.length);
      for (var b of data) {
         console.log(b.toString(16));
      }

      proxy.removeListener("data", listener);

      // Send a connection request
      listener = function(data) {
         console.log("con req - received " + data.length);
         for (var b of data) {
            console.log(b.toString(16));
         }

         // Check server response
         if (data[0] != 0x05)
            throw new Error("Server responded an invalid SOCKS protocol");

         if (data[1] > 0)
            throw new Error("Server responded that request was denied");

         proxy.removeListener("data", listener);

         console.log("Proxy connection succesful. Setting up irc connection.");
         xdccBot = exports.xdcc_bot.create(proxy);
      };

      proxy.on("data", listener);

      var address = exports.utils.ipToHex("62.210.109.90");
      var reqbuf = new Buffer(10);
      reqbuf[0] = 0x05;
      reqbuf[1] = 0x01;
      reqbuf[2] = 0x00;
      reqbuf[3] = 0x01;
      reqbuf[4] = address[0];
      reqbuf[5] = address[1];
      reqbuf[6] = address[2];
      reqbuf[7] = address[3];
      reqbuf[8] = 0x1a;
      reqbuf[9] = 0x0d;

      proxy.write(reqbuf);
   };

   proxy.on("data", listener);

   // Send a greeting to the server
   var shakebuf = new Buffer(3);
   shakebuf[0] = 0x05;
   shakebuf[1] = 0x01;
   shakebuf[2] = 0x00;

   proxy.write(shakebuf);
});

proxy.on("error", function(str) {
   console.log("Proxy incurred an error: " + str);
   proxy.destroy();
});
