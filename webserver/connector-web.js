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
 * Get the status of a device (on the /Test/0/D endpoint)
 */
app.get('/status/:id', function (req, res, next) {
  // first, we make a request to connector to get the status. This is an async request.
  request({
    uri: 'https://api.connector.mbed.com/endpoints/' + req.params.id + '/Test/0/D',
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
      next('No response within 5s. probably need to re-register the notification channel');
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
        data = data.replace(/\{\{count\}\}/g, payload.toString('utf-8'));

        // And render!
        res.set('Content-Type', 'text/html');
        res.send(data);
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
  // uncomment this to debug:
  // console.log('received a notification', JSON.stringify(req.body));

  if (req.body['async-responses']) {

    // this is the async-responses triggered from /status/:id
    req.body['async-responses'].forEach(function(asyncResp) {
      // we decode the body (was base64) and post a message on the eventbus
      var body = new Buffer(asyncResp.payload, 'base64');
      ee.emit(asyncResp.id, body);
    });

  }
  else if (req.body['notifications']) {
    // a notification comes in, we can now act upon this
    req.body['notifications'].forEach(function(notification) {
      // log it
      console.log('New event for', notification.ep, notification.path,
        new Buffer(notification.payload, 'base64').toString('utf-8'));
      // and send to socket
      io.sockets.emit(notification.ep, new Buffer(notification.payload, 'base64').toString('utf-8'));
    });

  }

  res.send('OK');
});

/**
 * We can set the color through a socket connection!
 */
function setColor(id, color) {
  request.put({
    uri: 'https://api.connector.mbed.com/endpoints/' + id + '/Test/0/D',
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
});

/**
 * We listen on port 6500, or override by setting PORT env variable!
 */
server.listen(process.env.PORT || 6500, process.env.IP || '0.0.0.0', function () {
  console.log('Listening on port', process.env.PORT || 6500);
});
