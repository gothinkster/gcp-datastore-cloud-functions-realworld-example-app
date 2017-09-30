var datastore = require('./Datastore.js');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var tokenSecret = process.env.SECRET ? process.env.SECRET : 'secret';

module.exports = {

  async create(aUserData) {

    // Verify username is not taken
    var userKey = datastore.key(['User', aUserData.username]);
    var result = await datastore.get(userKey);
    if (result[0]) {
      throw new Error(`Username already taken: [${aUserData.username}]`);
    }

    // Verify email is not taken
    var usersWithThisEmail = await datastore.runQuery(
      datastore.createQuery('User').filter('email', '=', aUserData.email));
    if (usersWithThisEmail[0].length) {
      throw new Error(`Email already taken: [${aUserData.email}]`);
    }

    // Add user
    var encryptedPassword = await bcrypt.hash(aUserData.password, 5);
    var userRecord = {
      email: aUserData.email,
      epassword: encryptedPassword,
      bio: '',
      image: '',
    };
    await datastore.upsert({
      key: userKey,
      data: userRecord
    });
    delete userRecord.epassword;
    userRecord.token = this.mintToken(aUserData.username);
    userRecord.username = aUserData.username;
    return userRecord
  },

  async login(aUserData) {

    // Get user with this email
    var userWithThisEmail = await datastore.runQuery(
      datastore.createQuery('User').filter('email', '=', aUserData.email));
    console.log(userWithThisEmail);
    if (!userWithThisEmail[0].length) {
      throw new Error(`Email not found: [${aUserData.email}]`);
    }

  },

  mintToken(aUsername) {
    return jwt.encode({
      username: aUsername,
      exp: (Date.now() + 2 * 24 * 60 * 60 * 1000) / 1000, // expires in 2 days
    }, tokenSecret);
  },

};
