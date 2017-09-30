var ds = require('./Datastore.js');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');

/* istanbul ignore next */
var tokenSecret = process.env.SECRET ? process.env.SECRET : 'secret';

/* istanbul ignore next */
var namespace = process.env.DATASTORE_NAMESPACE ? process.env.DATASTORE_NAMESPACE : 'dev';

module.exports = {

  async create(aUserData) {

    // Verify username is not taken
    var userKey = ds.key({
      namespace,
      path: ['User', aUserData.username],
    });
    var result = await ds.get(userKey);
    if (result[0]) {
      throw new Error(`Username already taken: [${aUserData.username}]`);
    }

    // Verify email is not taken
    var usersWithThisEmail = await ds.runQuery(
      ds.createQuery(namespace, 'User').filter('email', '=', aUserData.email));
    if (usersWithThisEmail[0].length) {
      throw new Error(`Email already taken: [${aUserData.email}]`);
    }

    // Add user
    var encryptedPassword = await bcrypt.hash(aUserData.password, 5);
    var userRecord = {
      email: aUserData.email,
      password: encryptedPassword,
      bio: '',
      image: '',
    };
    await ds.upsert({
      key: userKey,
      data: userRecord
    });
    delete userRecord.password;
    userRecord.token = this.mintToken(aUserData.username);
    userRecord.username = aUserData.username;
    return userRecord
  },

  async login(aUserData) {

    // Get user with this email
    var queryResult = await ds.runQuery(
      ds.createQuery(namespace, 'User').filter('email', '=', aUserData.email));
    var foundUser = queryResult[0][0];
    if (!foundUser) {
      throw new Error(`Email not found: [${aUserData.email}]`);
    }
    foundUser.username = foundUser[ds.KEY].name;
    var passwordCheckResult = await bcrypt.compare(aUserData.password, foundUser.password);
    if (!passwordCheckResult) {
      throw new Error('Incorrect password');
    }
    return {
      email: foundUser.email,
      token: this.mintToken(foundUser.username),
      username: foundUser.username,
      bio: foundUser.bio,
      image: foundUser.image
    };
  },

  async authenticateToken(aToken) {
    var decoded = jwt.decode(aToken, tokenSecret);
    var username = decoded.username;
    var result = await ds.get(ds.key({
      namespace,
      path: ['User', decoded.username],
    }));
    var foundUser = result[0];
    return {
      username,
      token: aToken,
      email: foundUser.email,
      bio: foundUser.bio,
      image: foundUser.image,
    };
  },

  mintToken(aUsername) {
    return jwt.encode({
      username: aUsername,
      exp: (Date.now() + 2 * 24 * 60 * 60 * 1000) / 1000, // expires in 2 days
    }, tokenSecret);
  },

};
