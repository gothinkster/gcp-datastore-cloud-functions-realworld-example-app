const routeParser = require('route-parser');
const User = require('./User.js');
const Article = require('./Article.js');

module.exports = {

  async route(req, res) {

    var validatedUser = null; // eslint-disable-line no-var
    var validatedUsername = null; // eslint-disable-line no-var
    const rawToken = req.get('Authorization');
    if (rawToken) {
      const matchedToken = rawToken.match(/Token (.*)/);
      if (matchedToken && matchedToken[1]) {
        console.log(`matchedToken = ${matchedToken}`);
        validatedUser = await User.authenticateToken(matchedToken[1]);
        validatedUsername = validatedUser.username;
      }
    }

    // Define routes that can be handled
    const routes = [

      // Helpers
      ['GET', '/ping', async() => res.status(200).send({
        pong: new Date(),
        DATASTORE_NAMESPACE: process.env.DATASTORE_NAMESPACE ? process.env.DATASTORE_NAMESPACE : '',
      })],

      // Users
      ['POST', '/users/login', async() => res.status(200).send({ user: await User.login(req.body.user) })],
      ['POST', '/users', async() => res.status(200).send({ user: await User.create(req.body.user) })],
      ['GET', '/user', async() => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Token is required'], }, });
        }
        res.status(200).send({ user: validatedUser });
      }],

      // Profiles
      ['GET', '/profiles/:username', async(matchedPath) => res.status(200).send({
        profile: await User.getProfile(matchedPath.username, validatedUser)
      })],
      ['POST', '/profiles/:username/follow', async(matchedPath) => res.status(200).send({
        profile: await User.followUser(validatedUser.username, matchedPath.username)
      })],
      ['DELETE', '/profiles/:username/follow', async(matchedPath) => res.status(200).send({
        profile: await User.unfollowUser(validatedUser.username, matchedPath.username)
      })],

      // Articles
      ['GET', '/articles', async() => {
        const articles = await Article.getAll({
          tag: req.query.tag,
          author: req.query.author,
          limit: req.query.limit,
          offset: req.query.offset,
          reader: validatedUsername,
        });
        res.status(200).send({ articles, articlesCount: articles.length });
      }],
      ['POST', '/articles', async() => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
        }
        res.status(200).send({ article: await Article.create(req.body.article, validatedUsername) });
      }],
      ['GET', '/articles/:slug', async(matchedPath) => res.status(200).send({
        article: await Article.get(matchedPath.slug, validatedUsername)
      })],
      ['DELETE', '/articles/:slug', async(matchedPath) => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
        }
        res.status(200).send(await Article.delete(matchedPath.slug, validatedUsername));
      }],

    ];

    // Match route and call handler
    for (let i = 0; i < routes.length; ++i) {
      if (req.method !== routes[i][0]) {
        continue;
      }
      const matchedPath = (new routeParser(routes[i][1])).match(req.path);
      if (matchedPath) {
        await routes[i][2](matchedPath);
        return;
      }
    }

    // No routes were matched, respond with 404
    res.status(404).send({ errors: { body: [`404 Not found: [${req.method} ${req.path}]`], }, });

  },

};
