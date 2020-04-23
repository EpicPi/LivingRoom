const mongoose = require('mongoose'),
Schema = mongoose.Schema;

const EventSchema = new Schema({
      type: String,
      time: Date,
      room: String,
      member: String,
   });

 mongoose.model('Event',EventSchema);