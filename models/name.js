const mongoose = require('mongoose'),
Schema = mongoose.Schema;

const NameSchema = new Schema({
        name: String,
        number: String,
    });

 mongoose.model('Name', NameSchema);