const jwt = require('jsonwebtoken');
const config = require('./config');
const rp = require('request-promise');

const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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


app.get('/', )

app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();

  if(req.body.Body == 'cancel'){
    //status.action = null
    //group name, pending names,
  }
  const status = getStatus(req.body.From)[0];
  const memberRooms = getRoomsMember(req.body.From);
  const pendingRooms = getRoomsPending(req.body.From);
  let text = req.body.Body.trim().toLowerCase();
  if(status.action != null){
    switch(status.action){
      case 'creating':
        if(!isNameLegal(text)){
          twiml.message("Not a legal name, try again. Must inclide only alphanumerica and no spaces.");
        }else if( memberRooms.filter((room)=> room.name == text).length != 0){
          twiml.message("You're already in a group named " + text +" enter a name");
        }
        const room = await createRoom(text);
        await updateAction(status.number, 'adding', room._id);
        twiml.message('Who to add?');
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
          updateAction(req.body.From, null, null);
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
          updateAction(req.body.From, null, null);
        }
        break;
      case 'accepting': // group == null
        //check if user is in pending named that name
        // else name not found, try again options are
        // accepted group name
        // add Member
        updateAction(req.body.From, null, null);
        break;
      case 'leaving': //group == null
        //check if user is in member named that name
        // else name not found, try again options are
        // left group name
        // remove member self
        updateAction(req.body.From, null, null);
        break;
      case 'boreding':
        if(text == 'all'){
          //for each group memeber, intiate boredom
          updateAction(req.body.From, null, null);
        }else {
          //check if user is in member named that name
            // else name not found, try again options are
          updateAction(req.body.From, null, null);
        }
        break;
      default:
        break;
    }
  }else{
    switch(text){
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
        if(memberRooms.length > 1){
          //update action adding, null group,
          //ask which group
        } else {
          // update action adding, group
          // ask who to add 
        }
        break;
      case 'remove':
        if(memberRooms.length > 1){
          //update action removing, null group,
          //ask which group
        } else {
            // update action removing, group
          // ask who to remove
        }
        break;
      case 'accept':
        if(pendingRooms.length > 1){
          //update action accepting, null group
          //ask which group
        } else {
          // accepted group name
          // add Member
        }
        break;
      case 'leave':
        if(memberRooms.length > 1){
          //update action leaving
          // ask which group
        } else {
          // left group group
          // removeMember self
        }
        break;
      case 'bored':
        if(memberRooms.length > 1){
          //update action boreding
          // ask which group
        } else {
          // initiate boredom (number, room)
        }
        break;
      default:
        break;
    }
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
  const email = 'piyushgk1@gmail.com';
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
        let resp = response;
        let result = resp.join_url;
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
//creates a room with the specified name and returns the object
async function createRoom(name){
  return await Room({
    name: name,
    members: [],
    pendings: [],
    zoom_link: null
    }).save();
}

function isNameLegal(name){
  name = name.trim().toLowerCase();
  if(name == 'all'){
    return false;
  }
  //if name includes non alphanumeric - false
  // if name == create, status, remove, leave, etc - false
  return true;
}

// Adds Numbers to the pending list of the room
// Only adds numbers that aren't already in the pending or memeber list
async function addPendings(room_id, numbers){
  const room = await Room.findById(room_id);
  numbers = numbers.filter( number => !checkMembership(room.members, number)); 
  numbers = numbers.filter( number => !room.pendings.includes(number));
  numbers.forEach(number => room.pendings.push({number: number}));
  await room.save();
  return room;
}

// true is number is contained in the members, false otherwise
function checkMembership(members, number){
  members = members.filter(member => member.number == number);
  return members.length > 0;
}

// removes number from the pendings list and adds it to the members list
async function addMember(room_id, number){
  const room = await Room.findById(room_id);
  room.pendings = room.pendings.filter( pend => pend != number);
  room.members.push({number: number, bored_time: new Date('February 24, 1999')});
  await room.save();
  return room;
}

//removes member from the members list
async function removeMember(room_id, number){
  const room = await Room.findById(room_id);
  room.members = room.members.filter(member => member.number != number);
  room.save();
  return room;
}

async function test(){
  let room = await Room.find( { name: 'abc' });
  room  = room[0]
  // room.members = [];
  console.log(room._id);
  let room2 = await Room.findById(room._id);
  console.log(room2);
  // room[0].members = [];
  // room[0].members.push({number:'+14049605772', bored_time: Date.now()});
  // room[0].save();
  // await updateAction('+14049605772', 'creating',null);
  // let groups = await getGroups('+14049605772');
  // console.log(groups);
}
test();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));