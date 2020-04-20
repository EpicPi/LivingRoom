const mongoose = require('mongoose'),
Schema = mongoose.Schema;

const StatusSchema = new Schema({
  number: String,
  group: String,
  action: String    
  });

 mongoose.model('Status', StatusSchema);