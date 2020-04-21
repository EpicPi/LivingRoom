const mongoose = require('mongoose'),
Schema = mongoose.Schema;

const RoomSchema = new Schema({
      name: String,
      zoom_link: String,
      zoom_age: Date,
      pendings: [String],
      members: [{ number: String, bored_time: Date }],
   });

 mongoose.model('Room',RoomSchema);