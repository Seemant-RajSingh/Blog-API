const mong = require('mongoose');
const {Schema, model} = mong;



const UserSchema = new Schema({
    username: {type: String, required: true, min: 4, unique: true},
    password: {type: String, required: true},
  });
  
  // creating collection UserModel
  const UserModel = model('User', UserSchema);
  
  module.exports = UserModel;