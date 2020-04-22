const jwt = require('jsonwebtoken');
const config = require('./config');
const axios = require('axios').default;

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


app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();

  if(req.body.Body == 'cancel'){
    updateStatus(req.body.From, null, null);
    twiml.message("You've got a clean slate now.");
  }

  const status = await getStatus(req.body.From);
  let text = req.body.Body.trim().toLowerCase();  
  
  const memberRooms = await getRoomsMember(req.body.From);
  const memberRoomNames = memberRooms.map( room => room.name).toString;

  const pendingRooms = await getRoomsPending(req.body.From);
  const pendingRoomNames = pendingRooms.map( room => room.name).toString;
  
  if(status.action != null){
    switch(status.action){
      case 'creating':{
        if(!isNameLegal(text)){
          twiml.message("Not a legal name, try again. Must include only alphanumerics. Cannot be a reserved word.");
        }else if( memberRooms.filter( room => room.name == text).length != 0){
          twiml.message("You're already in a room named " + text + " enter a different name.");
        } else {
          const room = await createRoom(text, req.body.From);
          await updateStatus(status.number, 'adding', room._id);
          twiml.message('Who Do you want to add? Comma seperated 10 digit USA numbers.');
        }
        break;
      }
      case 'adding':{
        if(status.room == null){
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
      }
      case 'removing':{
        if(status.room == null){
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
      }
      case 'accepting': {// room == null
        let rooms  = pendingRooms.filter(room => room.name == text);
        if( rooms.length == 0){
          twiml.message("You're not invited to a room named " + text + ". You have been invited to the following rooms: " + pendingRoomNames + ". Choose one of those to join.");
        } else {
          twiml.message("You've joined the " + rooms[0].name + 
          ". You can leave by texting me 'leave'. To see who else is here, text 'status'. Text 'bored' whenever you feel bored ot get teh video chat party started.");
          addMember(rooms[0]._id,req.body.From);
          updateStatus(req.body.From, null, null);
        }
        break;
      }
      case 'leaving': {//room == null
        let rooms = memberRooms.filter(room => room.name == text);
        if( rooms.length == 0){
          twiml.message("You're not in a room named " + text + ". You are a member in the following rooms: " + memberRoomNames + ". Choose one of those to leave.");
        } else {
          twiml.message("you've left the " + rooms[0].name + "room.");
          removeMembers(rooms[0]._id,req.body.From);
          updateStatus(req.body.From, null, null);
        }
        break;
      }
      case 'boreding':{
        if(text == 'all'){
          memberRooms.forEach(room => intiateBoredom(req.body.From, room._id));
          twiml.message("You just marked yourself bored in every room. You'll get a message with a video chat link when someone in a room is also bored.")
          updateStatus(req.body.From, null, null);
        }else {
          let rooms = memberRooms.filter(room => room.name == text);
          if( rooms.length == 0){
            twiml.message("You're not a member of the" + text + " room. Choose one of the following rooms to be bored in: " + memberRoomNames);
          } else {
            twiml.message("You just marked yourself bored in " + rooms[0].name + ". You'll get a message with a video chat link when someone in that room is also bored.");
            intiateBoredom(req.body.From, rooms[0]._id);
            updateStatus(req.body.From, null, null);
          }
        }
        break;
      }
      default:
        break;
    }
  }else{
    switch(text){
      case 'create':{
        await updateStatus(req.body.From, 'create', null);
        twiml.message("I'm creating your room now. What do you want to name it?");
        break;
      }
      case 'status':{
        let out = pendingRooms.length > 0 ? "You have been invited to:" + pendingRoomNames : "";
        out = "You are in " + memberRooms.length + " rooms";
        for(let i =0; i< memberRooms.length; i++){
          out += "Room: " + memberRooms[i].name;
          out += "Memebers: " + memberRooms[i].members.map(member => member.number).toString();
          out += "Pending invites: " + memberRooms[i].pendings.toString();    
        }
        twiml.message(out);
        break;
      }
      // case 'info':
      //   twiml.message('Take a look at: livingroom.trueshape.io');
      //   break;
      case 'add':{
        if(memberRooms.length > 1){
          updateStatus(req.body.From, 'adding', null);
          twiml.message("What room do you want to add someone to?");
        } else if(memberRooms.length == 1){
          updateStatus(req.body.From, 'adding', memberRooms[0]);
          twiml.message('Who Do you want to add? Comma seperated 10 digit USA numbers.');
        } else{ // memeberRooms == 0
          updateStatus(req.body.From, null, null);
          twiml.message("You're not in any rooms. Text 'create' to create one or 'accept' to accept an invite.")
        }
        break;
      }
      case 'remove':{
        if(memberRooms.length > 1){
          updateStatus(req.body.From, 'removing', null);
          twiml.message("What room do you want to remove someone to?");
        } else if(memberRooms.length == 1){
          updateStatus(req.body.From, 'removing', memberRooms[0]);
          twiml.message('Who do you want to remove? 10 digit number of the member you want to remove.');
        } else{ // memeberRooms == 0
          updateStatus(req.body.From, null, null);
          twiml.message("You're not in any rooms. Text 'create' to create one or 'accept' to accept an invite.")
        }
        break;
      }
      case 'accept':{
        if(pendingRooms.length > 1){
          updateStatus(req.body.From, 'accepting', null);
          twiml.message("What room's invite do you want to accept?");
        } else if (pendingRooms.length == 1){
          updateStatus(req.body.From, null, null);
          twiml.message("You've joined the " + pendingRooms[0].name + 
          ". You can leave by texting me 'leave'. To see who else is here, text 'status'. Text 'bored' whenever you feel bored ot get teh video chat party started.");
          addMember(pendingRooms[0]._id,req.body.From);
        } else {// pendingRooms == 0
          updateStatus(req.body.From, null, null);
          twiml.message("You have no pending invites currently. Go ask your friends to add you or you can create your own room by texting 'create'");
        }
        break;
      }
      case 'leave':{
        if(memberRooms.length > 1){
          updateStatus(req.body.From, 'leaving', null);
          twiml.message("What room do you want to leave?");
        } else if (memberRooms.length == 1){
          updateStatus(req.body.From, null, null);
          twiml.message("You've left the " + memberRooms[0].name + "room.");
          removeMembers(memberRooms[0]._id,req.body.From);
        } else {// memberRooms == 0
          updateStatus(req.body.From, null, null);
          twiml.message("You aren't currently in any rooms. Go ask your friends to add you or you can create your own room by texting 'create'");
        }
        break;
      }
      case 'bored':{
        if(memberRooms.length > 1){
          updateStatus(req.body.From, 'boreding', null);
          twiml.message("What room do you want to be bored in? (text 'all' for all of them)");
        } else if (memberRooms.length == 1){
          updateStatus(req.body.From, null, null);
          initiateBoredom(req.body.From, memberRooms[0]._id);
        } else {// memberRooms == 0
          updateStatus(req.body.From, null, null);
          twiml.message("You aren't currently in any rooms. Go ask your friends to add you or you can create your own room by texting 'create'");
        }
        break;
      }
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

// gets the status obj for the number
async function getStatus(number){
  let status = (await Status.find({number:number}))[0];
  if(status.length == 0){
    return await updateStatus(number, null, null);
  }
  return status;
}

// checks who's bored in the room and sends zoom_links if necessary
// if zoom_link is less tahn 40 mins old, sends that link instead
async function intiateBoredom(number, room_id){
  const room = await Room.findById(room_id);
  room.members.forEach( member => {
    if(member.number == number) {
      member.bored_time = Date.now()
    }
  });

  if(getAgeMinutes(room.zoom_age) < 40 ){
    sendMessage(number,"Ongoing meeting found! Join: "+ room.zoom_link);
  }else{
    const boredMembers = room.members.filter(member => getAgeMinutes(member.bored_time) < 20);
    if(boredMembers.length > 1){
      room.zoom_link = await makeMeeting();
      room.zoom_age = Date.now();
      boredMembers.forEach(member => sendMessage(member.number, "Meeting starting now in the " + room.name + " room. Join: "+ room.zoom_link));      
    }
  }
  room.save();
}

// updates the Status for that number with the action and room
async function updateStatus(number, action, room) {
  const res = await Status.updateOne(
    { number: number },
    { $set: { action: action, room: room } },
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

//returns the zoom_link of a meeting
async function makeMeeting(){
  const email = 'piyushgk1@gmail.com';
  var options = {
    url: 'https://api.zoom.us/v2/users/'+email+'/meetings', 
    method: 'POST',
    data: {
        type: 2,
        start_time: new Date().toISOString(),
        settings: {
          host_video:true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: false,
          approval_type: 3,
          audio: 'both',
          auto_recording: 'none',
          enforce_login: false,
          waiting_room: false,
          meeting_authentication: false,
        },
    },
    headers: {
        'User-Agent': 'Zoom-api-Jwt-Request',
        'content-type': 'application/json',
        'Authorization': `bearer ${token}`,
    },
  }

  const response = await axios(options);
  return response.data.join_url;
}

// age of the specified date object in minutes
function getAgeMinutes(date){
  return (Date.now() - date)/1000/60;
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
async function createRoom(name, number){
  const room =  Room({
    name: name,
    members: [],
    pendings: [],
    zoom_link: null,
    zoom_age: new Date('February 24, 1999')
    });
  room.members.push({number: number, bored_time: new Date('February 24, 1999')});
  return await room.save();
}

// true if name is not a reserved word and contains only alphanumerics
function isNameLegal(name){
  name = name.trim().toLowerCase();
  if(name == 'all' || name == 'create' || name == 'status' || name == 'help' 
    || name == 'add' || name == 'remove' || name == 'accept' || name == 'leave' 
    || name == 'bored' || name == 'info' || name == 'start' || name == 'stop'){
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
  // let room = await Room.find( { name: 'kancha' });
  // makeMeeting();
  // room  = room[0]
  // console.log((Date.now()-room.zoom_age)/1000/60);
  // room.members = [];
  // console.log(room._id);
  // let room2 = await Room.findById(room._id);
  // console.log(room2);
  // room[0].members = [];
  // room[0].members.push({number:'+14049605772', bored_time: Date.now()});
  // room[0].save();
  // await updateStatus('+14049605772', 'creating',null);
  // createRoom('kancha', '+14049605772');
}
test();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));