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
  const memberRoomNames = memberRooms.map( room => room.name).toString;
  const pendingRooms = getRoomsPending(req.body.From);
  let text = req.body.Body.trim().toLowerCase();

  if(status.action != null){
    switch(status.action){
      case 'creating':
        if(!isNameLegal(text)){
          twiml.message("Not a legal name, try again. Must include only alphanumerics. Cannot be a reserved word.");
        }else if( memberRooms.filter( room => room.name == text).length != 0){
          twiml.message("You're already in a group named " + text + " enter a different name.");
        } else {
          const room = await createRoom(text);
          await updateStatus(status.number, 'adding', room._id);
          twiml.message('Who Do you want to add? Comma seperated 10 digit USA numbers.');
        }
        break;
      case 'adding':
        if(status.group == null){
          let rooms = memberRooms.filter( room => room.name == text);
          if( rooms.length == 0){
            twiml.message("You're not in a room named " + text + ". You are in the following rooms: " + memberRoomNames  + ". Choose one of those to add a member to.")
          }else{
            await updateStatus(status.number, status.action, rooms[0]._id);
            twiml.message('Who to add?');
          }
        } else{
          let numbers = convertNumbers(text);
          addPendings(status.room, numbers);
          const addingRoomName = memberRooms.filter(room => room._id == status.room)[0].name;
          sendSMSInvites(numbers, addingRoomName, req.body.From);
          twiml.message('Sent invite to' + numbers + ' each person has to accept before they can participate in ' + addingRoomName);  
          updateStatus(req.body.From, null, null);
        }
        break;
      case 'removing':
        if(status.group == null){
          let rooms = memberRooms.filter( room => room.name == text);
          if( rooms.length == 0){
            twiml.message("You're not in a room named " + text + ". You are in the following rooms: " + memberRoomNames + ". Choose one of those to remove a member from.");
          } else {
            await updateStatus(status.number, status.action, rooms[0]._id);
            twiml.message('Who to remove?');
          }
        } else{
          let numbers = convertNumbers(text);
          const removingRoomName = memberRooms.filter(room => room._id == status.room)[0].name;
          removeMembers(status.room, numbers);
          sendSMSRemovals(numbers, removingRoomName, req.body.From);
          twiml.message("Removed " + numbers + " from " + removingRoomName + ". They have been notified you removed them.");
          updateStatus(req.body.From, null, null);
        }
        break;
      case 'accepting': // group == null
        //check if user is in pending named that name
        // else name not found, try again options are
        // accepted group name
        // add Member
        updateStatus(req.body.From, null, null);
        break;
      case 'leaving': //group == null
        //check if user is in member named that name
        // else name not found, try again options are
        // left group name
        // remove member self
        updateStatus(req.body.From, null, null);
        break;
      case 'boreding':
        if(text == 'all'){
          //for each group memeber, intiate boredom
          updateStatus(req.body.From, null, null);
        }else {
          //check if user is in member named that name
            // else name not found, try again options are
          updateStatus(req.body.From, null, null);
        }
        break;
      default:
        break;
    }
  }else{
    switch(text){
      case 'create':
        await updateStatus(req.body.From, 'create', null);
        twiml.message('What to name?');
        break;
      case 'status':
        //get groupsMember
        //send groups
        // send get groupsPending
        break;
      case 'help':
        twiml.message('livingroom.trueshape.io');
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
        } else if (pendingRooms.length == 1){
          // accepted group name
          // add Member
        } else {
          //you don't have any pending invites
        }
        break;
      case 'leave':
        if(memberRooms.length > 1){
          //update action leaving
          // ask which group
        } else if (memberRooms.length == 1){
          // left group group
          // removeMember self
        } else {
          //send message youre not in any rooms
        }
        break;
      case 'bored':
        if(memberRooms.length > 1){
          //update action boreding
          // ask which group
        } else if (memberRooms.length == 1){
          // initiate boredom (number, room)
        } else {
          //send message youre not in any rooms
        }
        break;
      default:
        break;
    }
  }
  
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

//sends an sms invitation to each number 
async function sendSMSInvites(numbers, room_name, by_number){
  numbers.forEach(number => 
    sendMessage(number, "You've been invited to " 
    + room_name + " by " + by_number + " .Type 'accept' to join this room.") );
}

//sends an sms removal notifs to each number 
async function sendSMSRemovals(numbers, room_name, by_number){
  numbers.forEach(number => 
    sendMessage(number, "You've been removed from " 
    + room_name + " by" + by_number) );
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

// updates the Status for that number with the action aand group
async function updateStatus(number, action, group) {
  const res = await Status.updateOne(
    { number: number },
    { $set: { action: action, group: group } },
    { upsert: true } 
  );
}

// find all rooms that number is a member of
async function getRoomsMember(number){
  return await Room.find({'members.number': number});
}

// find all rooms that number has been invited to
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
        console.log(response);
        let resp = response;
        let result = resp.join_url;
    })
    .catch(function (err) {
        // API call failed...
        console.log('API call failed, reason ', err);
    });
}

// converts str of numbers to an array of qualified numbers 
function convertNumbers(str){
  let numbers = str.split(',');
  numbers = numbers.map(number => number.trim().replace(/[^0-9]/gi, ''));
  numbers = numbers.filter(number => number.length == 10);
  numbers = numbers.map(number => '+1' + number);
  return numbers;
}

// sends message to number with body
function sendMessage(to, body) {
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

// true if name is not a reserved word and contains only alphanumerics
function isNameLegal(name){
  name = name.trim().toLowerCase();
  if(name == 'all' || name == 'create' || name == 'status' || name == 'help' 
    || name == 'add' || name == 'remove' || name == 'accept' || name == 'leave' 
    || name == 'bored'){
    return false;
  }
  if(!name.match(/^[a-z0-9]+$/)){
    return false;
  }
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

//removes members from the members list
async function removeMembers(room_id, numbers){
  const room = await Room.findById(room_id);
  for(let i =0; i< numbers.length; i++){
    room.members = room.members.filter(member => member.number != numbers[i]);
  }
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
  // await updateStatus('+14049605772', 'creating',null);
  // let groups = await getGroups('+14049605772');
  // console.log(groups);
}
test();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));