const jwt = require('jsonwebtoken');
const config = require('./config');
const axios = require('axios').default;
const express = require('express');

//app
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
const port = 3000;

//zoom
const payload = {
  iss: config.ZoomApiKey,
  exp: ((new Date()).getTime() + 5000)
};
const token = jwt.sign(payload, config.ZoomApiSecret);

//twillio
const accountSid = config.TwilioSID;
const authToken = config.TwilioToken;
const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

// mongoose
const mongoose = require('mongoose');
mongoose.connect(config.MongoUrl);
require('./models');
Room = mongoose.model('Room');
Status = mongoose.model('Status');


app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();
  let text = req.body.Body.trim().toLowerCase();

  if (text == 'back') {
    updateStatus(req.body.From, null, null);
    twiml.message("You've got a clean slate now.");
  } else {
    const status = await getStatus(req.body.From);

    const memberRooms = await getRoomsMember(req.body.From);
    const memberRoomNames = memberRooms.map(room => room.name).join(', ');

    const pendingRooms = await getRoomsPending(req.body.From);
    const pendingRoomNames = pendingRooms.map(room => room.name).join(', ');

    const backMessage = "\n\nType 'back' at any point to stop this process.";

    if (status.action != null) {
      switch (status.action) {
        case 'creating': {
          if (!isNameLegal(text)) {
            twiml.message("Not a legal name, try again. Must include only alphanumerics. Cannot be a reserved word." + backMessage);
          } else if (memberRooms.filter(room => room.name == text).length != 0) {
            twiml.message("You're already in a room named " + text + " enter a different name." + backMessage);
          } else {
            const room = await createRoom(text, req.body.From);
            await updateStatus(status.number, 'adding', room._id);
            twiml.message('Who Do you want to add? Comma seperated 10 digit USA numbers.' + backMessage);
          }
          break;
        }
        case 'adding': {
          if (status.room == null) {
            let rooms = memberRooms.filter(room => room.name == text);
            if (rooms.length == 0) {
              twiml.message("You're not in a room named " + text + ".\nYou're in the following rooms: " + memberRoomNames + ".\nChoose one of those to add a member to." + backMessage);
            } else {
              await updateStatus(status.number, status.action, rooms[0]._id);
              twiml.message('Who to add to ' + rooms[0].name + ' ?' + backMessage);
            }
          } else {
            let numbers = convertNumbers(text);
            if(numbers.length == 0){
              twiml.message("I couldn't understand that. Make sure you give me a USA 10 digit number. You can give me multiple by seperating them with commas." + backMessage);
            }else{
              addPendings(status.room, numbers);
              const roomName = memberRooms.filter(room => room._id == status.room)[0].name;
              sendSMSInvites(numbers, roomName, req.body.From);
              twiml.message('Sent invite to ' + numbers + '.\nEach person has to accept before they can participate in ' + roomName);
              updateStatus(req.body.From, null, null);
            }
          }
          break;
        }
        case 'removing': {
          if (status.room == null) {
            let rooms = memberRooms.filter(room => room.name == text);
            if (rooms.length == 0) {
              twiml.message("You're not in a room named " + text + ".\nYou are in the following rooms: " + memberRoomNames + ".\nChoose one of those to remove a member from." + backMessage);
            } else {
              await updateStatus(status.number, status.action, rooms[0]._id);
              twiml.message('Who do you want to remove from ' + rooms[0].name
              + '? \nThe current memebers are: ' + rooms[0].members.map(member => member.number.substring(2)).join(', ') + backMessage);
            }
          } else {
            let numbers = convertNumbers(text);
            if(numbers.length == 0){
              twiml.message("I couldn't understand that. Make sure you give me a USA 10 digit number. You can give me multiple by seperating them with commas." + backMessage);
            }else{
              const roomName = memberRooms.filter(room => room._id == status.room)[0].name;
              removeMembers(status.room, numbers);
              sendSMSRemovals(numbers, roomName, req.body.From);
              twiml.message("Removed " + numbers.join(', ') + " from " + roomName + ".\nThey have been notified you removed them.");
              updateStatus(req.body.From, null, null);
            }
          }
          break;
        }
        case 'accepting': {// room == null
          let rooms = pendingRooms.filter(room => room.name == text);
          if (rooms.length == 0) {
            twiml.message("You're not invited to a room named " + text
              + ".\nYou've been invited to the following rooms: " + pendingRoomNames + ".\nChoose one of those to join." + backMessage);
          } else {
            twiml.message("You've joined the " + rooms[0].name +
              ".\nYou can leave by texting me 'leave'.\nTo see who else is here, text 'status'.\nText 'bored' to get the video chat party rolling.");
            addMember(rooms[0]._id, req.body.From);
            updateStatus(req.body.From, null, null);
          }
          break;
        }
        case 'leaving': {//room == null
          let rooms = memberRooms.filter(room => room.name == text);
          if (rooms.length == 0) {
            twiml.message("You're not in a room named " + text + ".\nYou are a member of the following rooms: " + memberRoomNames + ".\nChoose one of those to leave." + backMessage);
          } else {
            twiml.message("You've left the " + rooms[0].name + " room.");
            removeMembers(rooms[0]._id, [req.body.From]);
            updateStatus(req.body.From, null, null);
          }
          break;
        }
        case 'boreding': {
          if (text == 'all') {
            memberRooms.forEach(room => initiateBoredom(req.body.From, room._id));
            twiml.message("You just marked yourself bored in every room. You'll get a message with a video chat link when someone in a room is also bored.")
            updateStatus(req.body.From, null, null);
          } else {
            let rooms = memberRooms.filter(room => room.name == text);
            if (rooms.length == 0) {
              twiml.message("You're not a member of the " + text + " room.\nChoose one of the following rooms to be bored in: " + memberRoomNames + backMessage);
            } else {
              twiml.message("You just marked yourself bored in " + rooms[0].name + ".\nYou'll get a message with a video chat link when someone in that room is also bored.");
              initiateBoredom(req.body.From, rooms[0]._id);
              updateStatus(req.body.From, null, null);
            }
          }
          break;
        }
        default:
          break;
      }
    } else {
      switch (text) {
        case 'create': {
          await updateStatus(req.body.From, 'creating', null);
          twiml.message("I'm creating your room now.\nWhat do you want to name it?" + backMessage);
          break;
        }
        case 'status': {
          let out = pendingRooms.length > 0 ? "You have been invited to: " + pendingRoomNames + "\n" : "";
          out = "You're in " + memberRooms.length + " rooms" + "\n\n";
          for (let i = 0; i < memberRooms.length; i++) {
            out += "Room: " + memberRooms[i].name + "\n";
            out += "Memebers: " + memberRooms[i].members.map(member => member.number).join(', ') + "\n";
            out += "Pending invites: " + memberRooms[i].pendings.join(', ') + "\n\n";
          }
          twiml.message(out);
          break;
        }
        case 'add': {
          if (memberRooms.length > 1) {
            updateStatus(req.body.From, 'adding', null);
            twiml.message("What room do you want to add someone to? \nYou're in the following rooms: " + memberRoomNames + backMessage);
          } else if (memberRooms.length == 1) {
            updateStatus(req.body.From, 'adding', memberRooms[0]._id);
            twiml.message('Who do you want to add to ' + memberRooms[0].name + '? \nText me the comma seperated 10 digit USA numbers.' + backMessage);
          } else { // memeberRooms == 0
            updateStatus(req.body.From, null, null);
            twiml.message("You're not in any rooms. Text 'create' to create one or 'accept' to accept an invite.");
          }
          break;
        }
        case 'remove': {
          if (memberRooms.length > 1) {
            updateStatus(req.body.From, 'removing', null);
            twiml.message("What room do you want to remove someone from? \nYou're currently in: " + memberRoomNames + backMessage);
          } else if (memberRooms.length == 1) {
            updateStatus(req.body.From, 'removing', memberRooms[0]._id);
            twiml.message('Who do you want to remove from ' + memberRooms[0].name
              + '? \nThe current memebers are: ' + memberRooms[0].members.map(member => member.number.substring(2)).join(', ') + backMessage);
          } else { // memeberRooms == 0
            updateStatus(req.body.From, null, null);
            twiml.message("You're not in any rooms. Text 'create' to create one or 'accept' to accept an invite.");
          }
          break;
        }
        case 'accept': {
          if (pendingRooms.length > 1) {
            updateStatus(req.body.From, 'accepting', null);
            twiml.message("What room do you want to join? \n You've been invited to: " + pendingRoomNames + backMessage);
          } else if (pendingRooms.length == 1) {
            updateStatus(req.body.From, null, null);
            twiml.message("You've joined the " + pendingRooms[0].name +
              ".\nYou can leave by texting me 'leave'.\nTo see who else is here, text 'status'.\nText 'bored' to get the video chat party rolling.");
            addMember(pendingRooms[0]._id, req.body.From);
          } else {// pendingRooms == 0
            updateStatus(req.body.From, null, null);
            twiml.message("You currently have no pending invites. Go ask your friends to add you to one");
          }
          break;
        }
        case 'leave': {
          if (memberRooms.length > 1) {
            updateStatus(req.body.From, 'leaving', null);
            twiml.message("What room do you want to leave? \nYou're currently in: " + memberRoomNames + backMessage);
          } else if (memberRooms.length == 1) {
            updateStatus(req.body.From, null, null);
            twiml.message("You've left the " + memberRooms[0].name + " room.");
            removeMembers(memberRooms[0]._id, [req.body.From]);
          } else {// memberRooms == 0
            updateStatus(req.body.From, null, null);
            twiml.message("You're not in any rooms. Text 'create' to create one or 'accept' to accept an invite.");
          }
          break;
        }
        case 'bored': {
          if (memberRooms.length > 1) {
            updateStatus(req.body.From, 'boreding', null);
            twiml.message("What room do you want to be bored in? (text 'all' for all of them)\nYou're currently in: " + memberRoomNames + backMessage);
          } else if (memberRooms.length == 1) {
            updateStatus(req.body.From, null, null);
            initiateBoredom(req.body.From, memberRooms[0]._id);
            twiml.message("You just marked yourself bored in " + memberRooms[0].name + ".\nYou'll get a message with a video chat link when someone in that room is also bored.");
          } else {// memberRooms == 0
            updateStatus(req.body.From, null, null);
            twiml.message("You're not in any rooms. Text 'create' to create one or 'accept' to accept an invite.");
          }
          break;
        }
        default:
          twiml.message("I couldn't understand that. \nYou can ask me to 'create' a room, display your 'status', 'add' members to a room, 'remove' members from a room, 'accept' an invite, or to mark you 'bored'.\nTake a look at livingroom.trueshape.io for more info.")
          break;
      }
    }
  }
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

//sends an sms invitation to each number 
async function sendSMSInvites(numbers, room_name, by_number) {
  numbers.forEach(async number => {
    const status = await Status.find({ number: number });
    if (status.length == 0) {
      sendMessage(number, "Welcome to the Living Room App. Find more information at livingroom.trueshape.io");
    }
    sendMessage(number, "You've been invited to the "
      + room_name + " room by " + by_number + " .\nType 'accept' to join this room.")
  });
}

//sends an sms removal notifs to each number 
async function sendSMSRemovals(numbers, room_name, by_number) {
  numbers.forEach(number =>
    sendMessage(number, "You've been removed from "
      + room_name + " by " + by_number));
}

// gets the status obj for the number
async function getStatus(number) {
  let status = (await Status.find({ number: number }));
  if (status.length == 0) {
    return await updateStatus(number, null, null);
  }
  return status[0];
}

// checks who's bored in the room and sends zoom_links if necessary
// if zoom_link is less tahn 40 mins old, sends that link instead
async function initiateBoredom(number, room_id) {
  const room = await Room.findById(room_id);
  room.members.forEach(member => {
    if (member.number == number) {
      member.bored_time = Date.now()
    }
  });

  if (getAgeMinutes(room.zoom_age) < 40) {
    sendMessage(number, "Ongoing meeting found! Join: " + room.zoom_link);
  } else {
    const boredMembers = room.members.filter(member => getAgeMinutes(member.bored_time) < 20);
    if (boredMembers.length > 1) {
      room.zoom_link = await makeMeeting();
      room.zoom_age = Date.now();
      boredMembers.forEach(member => sendMessage(member.number, "Meeting starting now in the " + room.name + " room. Join: " + room.zoom_link));
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
async function getRoomsMember(number) {
  return await Room.find({ 'members.number': number });
}

// find all rooms that number has been invited to
async function getRoomsPending(number) {
  return await Room.find({ 'pendings': number });
}

//returns the zoom_link of a meeting
async function makeMeeting() {
  const email = 'piyushgk1@gmail.com';
  var options = {
    url: 'https://api.zoom.us/v2/users/' + email + '/meetings',
    method: 'POST',
    data: {
      type: 2,
      start_time: new Date().toISOString(),
      settings: {
        host_video: true,
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
function getAgeMinutes(date) {
  return (Date.now() - date) / 1000 / 60;
}

// converts str of numbers to an array of qualified numbers 
function convertNumbers(str) {
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
    });
}

//creates a room with the specified name and returns the object
async function createRoom(name, number) {
  const room = Room({
    name: name,
    members: [],
    pendings: [],
    zoom_link: null,
    zoom_age: new Date('February 24, 1999')
  });
  room.members.push({ number: number, bored_time: new Date('February 24, 1999') });
  return await room.save();
}

// true if name is not a reserved word and contains only alphanumerics
function isNameLegal(name) {
  name = name.trim().toLowerCase();
  if (name == 'all' || name == 'create' || name == 'status' || name == 'help'
    || name == 'add' || name == 'remove' || name == 'accept' || name == 'leave'
    || name == 'bored' || name == 'info' || name == 'start' || name == 'stop') {
    return false;
  }
  if (!name.match(/^[a-z0-9]+$/)) {
    return false;
  }
  return true;
}

// Adds Numbers to the pending list of the room
// Only adds numbers that aren't already in the pending or memeber list
async function addPendings(room_id, numbers) {
  const room = await Room.findById(room_id);
  numbers = numbers.filter(number => !checkMembership(room.members, number));
  numbers = numbers.filter(number => !room.pendings.includes(number));
  numbers.forEach(number => room.pendings.push(number));
  await room.save();
  return room;
}

// true is number is contained in the members, false otherwise
function checkMembership(members, number) {
  members = members.filter(member => member.number == number);
  return members.length > 0;
}

// removes number from the pendings list and adds it to the members list
async function addMember(room_id, number) {
  const room = await Room.findById(room_id);
  room.pendings = room.pendings.filter(pend => pend != number);
  room.members.push({ number: number, bored_time: new Date('February 24, 1999') });
  await room.save();
  return room;
}

//removes members from the members list
async function removeMembers(room_id, numbers) {
  const room = await Room.findById(room_id);
  for (let i = 0; i < numbers.length; i++) {
    room.members = room.members.filter(member => member.number != numbers[i]);
  }
  room.save();
  return room;
}

app.listen(port, () => console.log(`LivingRoom listening on port ${port}!`));