//include required modules
const jwt = require('jsonwebtoken');
const config = require('./config');
const rp = require('request-promise');

const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
var email, userid, resp;
const port = 3000;

const payload = {
    iss: config.ZoomApiKey,
    exp: ((new Date()).getTime() + 5000)
};
const token = jwt.sign(payload, config.ZoomApiSecret);

function makeMeeting(){
  email = 'piyushgk1@gmail.com';
  var options = {
    uri: 'https://api.zoom.us/v2/users/'+email+'/meetings', 
    method: 'POST',
    qs: {
        status: 'active' 
    },
    auth: {
        'bearer': token
    },
    body: {
        type: 1,
    },
    headers: {
        'User-Agent': 'Zoom-api-Jwt-Request',
        'content-type': 'application/json'
    },
    json: true
  }

  rp(options)
    .then(function (response) {
        console.log('User has', response);
        resp = response;
        var result = resp.join_url;
    })
    .catch(function (err) {
        // API call failed...
        console.log('API call failed, reason ', err);
    });
}

// Download the helper library from https://www.twilio.com/docs/node/install
// Your Account Sid and Auth Token from twilio.com/console
// DANGER! This is insecure. See http://twil.io/secure
const accountSid = config.TwilioSID;
const authToken = config.TwilioToken;
const client = require('twilio')(accountSid, authToken);

client.messages
  .create({
     body: 'This is the ship that made the Kessel Run in fourteen parsecs?',
     from: '+15109397642',
     to: '+14049605772'
   })
  .then(message => console.log(message.sid));


// app.listen(port, () => console.log(`Example app listening on port ${port}!`));