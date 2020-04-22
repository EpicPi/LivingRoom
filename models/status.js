const mongoose = require('mongoose'),
Schema = mongoose.Schema;

const StatusSchema = new Schema({
  number: String,
  room: String,
  action: String    
  });

 mongoose.model('Status', StatusSchema);