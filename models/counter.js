const mongoose = require('mongoose'),
Schema = mongoose.Schema;

const CounterSchema = new Schema({
      name: String,
      value: Number
   });

 mongoose.model('Counter',CounterSchema);