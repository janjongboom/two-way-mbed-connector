/**
 * Simple web application that shows how to connect to mbed connector.
 * Run `npm install` first, then run `TOKEN=xxx node connector-web.js`.
 * This server needs to be accessible from the web for connector to send notifications.
 */
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');

var app = express();
app.use(bodyParser.json());

var server = require('http').Server(app);
var io = require('socket.io')(server);

// All APIs in connector are async, therefore we use a simple event emitter to communicate
var ee = new EventEmitter();

app.get('/', function (req, res) {
  res.send('Hello from connector-web!');
});

if (!process.env.TOKEN) {
  throw 'Need to pass in TOKEN as env. variable (TOKEN=xxx node connector-web.js)';
}

/**
 * Get the status of a device (on the /3200/0/5501 endpoint, which is number of button clicks)
 */
app.get('/status/:id', function (req, res, next) {
  // first, we make a request to connector to get the status. This is an async request.
  request({
    uri: 'https://api.connector.mbed.com/endpoints/' + req.params.id + '/3200/0/5501',
    json: true,
    headers: {
      'Authorization': 'Bearer ' + process.env.TOKEN
    }
  }, function (err, resp, body) {
    // when the response comes in the actual value is not retrieved, but we get an asyncResponseId.
    // The actual value is posted to /notification below. So we need to wait until that
    // message comes in via the eventbus.
    if (err) return next(err);
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      return next('Unexpected statusCode from connector: ' + resp.statusCode + ' ' + body);
    }

    var timedOut = false;
    var to = setTimeout(function() {
      timedOut = true;
      next('No response within 5s. Connector lost us, need to wait 30(?) seconds before we get notifications again...');
    }, 5000);

    // once the message is in, we'll respond with the value posted
    ee.once(body['async-response-id'], function (payload) {
      if (timedOut) return;

      clearTimeout(to);

      // we load the HTML file with the UI
      fs.readFile('./ui.html', 'utf-8', function(err, data) {
        if (err) return next(err);

        // Fill the fields in with data from connector
        data = data.replace(/\{\{name\}\}/g, req.params.id);
        data = data.replace(/\{\{count\}\}/g, (payload[0] << 8) + payload[1]);

        // And render!
        res.set('Content-Type', 'text/html');
        res.send(data);

        request.put({
          uri: 'https://api.connector.mbed.com/subscriptions/' + req.params.id + '/3200/0/5501',
          json: true,
          headers: {
            'Authorization': 'Bearer ' + process.env.TOKEN
          }
        }, function (aErr, aResp, aBody) {
          console.log('Made subscription', aErr, aResp.statusCode, aBody);
        });
        // '
      });
    });
  });
});

/**
 * This is where connector sends notifications.
 * You'll need to register this via:
 *    curl -X PUT -v -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_AUTH_TOKEN' -d '{ "url": "http://YOUR_URL/notification" }' https://api.connector.mbed.com/notification/callback
 */
app.put('/notification', function (req, res, next) {
  // just pretend everythign is always OK otherwise connector becomes one big @&* bia@&*#&
  res.send('OK');

  if (req.body['async-responses']) {
    console.log('received async response', JSON.stringify(req.body));

    // this is the async-responses triggered from /status/:id
    req.body['async-responses'].forEach(function(asyncResp) {
      if (!asyncResp.payload) return;
      // we decode the body (was base64) and post a message on the eventbus
      var body = new Buffer(asyncResp.payload, 'base64');
      ee.emit(asyncResp.id, body);
    });

  }
  else if (req.body['notifications']) {
    console.log('received notification', JSON.stringify(req.body));

    // a notification comes in, we can now act upon this
    req.body['notifications'].forEach(function(notification) {
      if (!notification.payload) return;
      // log it
      console.log('New event for', notification.ep, notification.path,
        new Buffer(notification.payload, 'base64'));
      // and send to socket
      var payload = new Buffer(notification.payload, 'base64');
      io.sockets.emit(notification.ep, (payload[0] << 8) + payload[1]);
    });

  }
});

/**
 * We can set the color through a socket connection!
 */
function setColor(id, color) {
  request.put({
    uri: 'https://api.connector.mbed.com/endpoints/' + id + '/Test5/0/D',
    body: color,
    headers: {
      'Authorization': 'Bearer ' + process.env.TOKEN
    }
  }, function(err, res, body) {
    console.log('setColor response', err, res.statusCode, body);
    io.sockets.emit(id, color);
  });
}

io.on('connection', function (socket) {
  socket.on('color', function (data) {
    setColor(data.id, data.color);
  });
  socket.on('blink', function(data) {
    request.post({
      uri: 'https://api.connector.mbed.com/endpoints/' + data.id + '/3201/0/5850',
      headers: {
        'Authorization': 'Bearer ' + process.env.TOKEN
      }
    }, function(err, res, body) {
      console.log('blink response', err, res.statusCode, body);
    });
  });
  socket.on('change-blink', function(data) {
    request.put({
      uri: 'https://api.connector.mbed.com/endpoints/' + data.id + '/3201/0/5853',
      body: data.pattern,
      headers: {
        'Authorization': 'Bearer ' + process.env.TOKEN
      }
    }, function(err, res, body) {
      console.log('change-blink response', err, res.statusCode, body);
    });
  });
});

/**
 * We listen on port 6500, or override by setting PORT env variable!
 */
server.listen(process.env.PORT || 6500, process.env.IP || '0.0.0.0', function () {
  console.log('Listening on port', process.env.PORT || 6500);

  request.put({
    uri: 'https://api.connector.mbed.com/notification/callback',
    json: true,
    body: { 'url' : 'http://two-way-mbed-connector-janjongboom1.c9users.io/notification' },
    headers: {
      'Authorization': 'Bearer ' + process.env.TOKEN
    }
  }, function (err, res, body) {
    console.log('Registered notification', err, res.statusCode, body);
  });

});
