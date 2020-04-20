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


//get the form 
app.get('/', (req,res) => res.send(req.body));

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


app.listen(port, () => console.log(`Example app listening on port ${port}!`));