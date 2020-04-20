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

const accountSid = config.TwilioSID;
const authToken = config.TwilioToken;
const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const mongoose = require('mongoose');
mongoose.connect(config.MongoUrl);
require('./models');
Room = mongoose.model('Room');
Status = mongoose.model('Status');

app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();

  if (req.body.Body == 'create') {
    twiml.message('hi');
  } else if (req.body.Body == 'bye') {
    twiml.message('Goodbye');
  } else {
    twiml.message(
      'No Body param match, Twilio sends this in the request to your server.'
    );
  }
  
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

async function updateAction(number, action, group) {
  const res = await Status.updateOne(
    { number: number },
    { $set: { action: 'creating', group: null } },
    { upsert: true } 
  );
}

async function getGroups(number){
  return await Room.find({'members.number': '+14049605772'});
}

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

function createMessage(to, body) {
  client.messages
    .create({
      body: body,
      from: '+15109397642',
      to: to
    })
    .then(message => console.log(message.sid));
}
async function createRoom(name){
  return await Room({
    name: name,
    members: [],
    pendings: [],
    zoom_link: null
    });
}
async function inviteMembers(room_id, members){
  const room = (await Room.findById(room_id))[0];
  members.forEacch((member) => room.pendings.push({number: member}));
  await room.save();
  return room;
}

async function addMember(room_id, member){
  const room = (await Room.findById(room_id))[0];
  members.forEacch((member) => room.pendings.push({number: member}));
  await room.save();
  return room;
}
async function test(){
  const room = await Room.find( { name: 'abc' });
  // room.members = [];
  console.log(room[0]);
  room[0].members = [];
  room[0].members.push({number:'+14049605772', bored_time: Date.now()});
  room[0].save();
  // await updateAction('+14049605772', 'creating',null);
  let groups = await getGroups('+14049605772');
  console.log(groups);
}

test();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));