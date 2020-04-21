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

  if(req.body.Body == 'cancel'){
    //group name, pending names,
  }

  switch(status.action){
    case 'creating':
      if(status.group == null){
      //validate alphanumeric no spaces
      //check if user is in room named that name
      // else try again
      const room = await createRoom(req.body.Body);
      await updateAction(status.number, 'adding', room._id);
      twiml.message('Who to add?');
      }
      break;
    case 'adding':
      if(status.group == null){
        //find room based on req.body.Body
        //else status.action = null
        await updateAction(status.number, status.action, room._id);
        twiml.message('Who to add?');
      } else{
        //numbers = req.body.Body
        //members = validate members
        //addPendings
        // sendInviteSms
        // sent invite to members, each person has to accept before they can participate
        //status.action = null
      }
      break;
    case 'removing':
      if(status.group == null){
        //find room based on req.body.Body
        //else status.action = null
        await updateAction(status.number, status.action, room._id);
        twiml.message('Who to remove?');
      } else{
        //numbers = req.body.Body
        //members = validate members
        // removeMemebersOrPending
        // sendRemovalSms
        // removed members, each person has been notified you removed them
        //status.action = null
      }
      break;
    case 'accepting': // group == null
      //check if user is in pending named that name
      // else name not found, try again options are
      // accepted group name
      // add Member
      //status.action = null
      break;
    case 'leaving': //group == null
      //check if user is in member named that name
      // else name not found, try again options are
      // left group name
      // remove member self
      // status.action == null
      break;
    case 'boreding':
      //check if 'all'
        //for each group memeber, intiate boredom
        //status.action = null
      //else
        //check if user is in member named that name
          // else name not found, try again options are
        //status.action = null
      break;
    default:
      break;
  }

  switch(req.body.Body.trim().toLowerCase()){
    case 'create':
      await updateAction(req.body.From, 'create', null);
      twiml.message('What to name?');
      break;
    case 'status':
      //get groupsMember
      //send groups
      // send get groupsPending
      break;
    case 'help':
      twiml.message('figure it out');
      break;
    case 'add':
      //get groupsMember
      // if multiple
        //update action adding, null group,
        //ask which group
      // if single
          // update action adding, group
          // ask who to add 
      break;
    case 'remove':
      //get groupsMember
      // if multiple
        //update action removing, null group,
        //ask which group
      // if single
          // update action removing, group
        // ask who to remove
      break;
    case 'accept':
      //get groupsPending
      // if multiple
        //update action accepting, null group
        //ask which group
      // if single
        // accepted group name
        // add Member
      break;
    case 'leave':
      // get GroupsMember
      // if multiple
        //update action leaving
        // ask which group
      // if single 
        // left group group
        // removeMember self
      break;
    case 'bored':
      // get GroupsMember
      // if multiple
        //update action boreding
        // ask which group
      // if single 
        // initiate boredom (number, room)
    break;
    default:
      break;
  }
  
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

async function sendSMSInvites(memebers){
  //foreach memeber, 
    // send sms "type accept to accept "
}

async function getStatus(number){
  return await Status.find({number:number});
}

async function intiateBoredom(number, room){
  // get room from id
  // number set bored_time now

  // if zoom_age < 40mins
    //send message number , zoom_link
    // save room
  //else
  // boredMembers = foreach member. filter date < 20 mins
  //if  boreMembers.count() > 1
    // createMeeting
    // foreach member send sms meeting link
    // zoom_link = meeting link
    // zoom_age = Date.now()
    //save room

}
async function updateAction(number, action, group) {
  const res = await Status.updateOne(
    { number: number },
    { $set: { action: action, group: group } },
    { upsert: true } 
  );
}

async function getRoomsMember(number){
  return await Room.find({'members.number': number});
}
async function getRoomsPending(number){
  return await Room.find({'pendingss.number': number});
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
async function addPendings(room_id, members){
  const room = (await Room.findById(room_id))[0];
  // if number not in room.members
  members.forEach((member) => room.pendings.push({number: member}));
  await room.save();
  return room;
}

async function addMember(room_id, member){
  const room = (await Room.findById(room_id))[0];
  //room.pendings.remove({number: member}));
  //room.members.push number
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


app.listen(port, () => console.log(`Example app listening on port ${port}!`));