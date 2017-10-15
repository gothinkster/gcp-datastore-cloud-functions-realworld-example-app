const routeParser = require('route-parser');
const User = require('./User.js');
const Article = require('./Article.js');

module.exports = {

  async route(req, res) {

    var validatedUser = null; // eslint-disable-line no-var
    var validatedUsername = null; // eslint-disable-line no-var
    const token = req.get('Authorization');
    if (token) {
      validatedUser = await User.authenticateToken(token);
      validatedUsername = validatedUser.username;
    }

    if (req.path == '/ping') {
      res.status(200).send({ pong: new Date(), DATASTORE_NAMESPACE: process.env.DATASTORE_NAMESPACE, });
    } else if (req.method == 'POST' && req.path == '/users') {
      res.status(200).send({ user: await User.create(req.body.user) });
    } else if (req.method == 'POST' && req.path == '/users/login') {
      res.status(200).send({ user: await User.login(req.body.user) });
    } else if (req.method == 'GET' && req.path.startsWith('/profiles/')) {
      const matchedPath = (new routeParser('/profiles/:username')).match(req.path);
      res.status(200).send({ profile: await User.getProfile(matchedPath.username, validatedUser) });
    } else if (req.method == 'POST' && req.path.startsWith('/profiles/')) {
      const matchedPath = (new routeParser('/profiles/:username')).match(req.path);
      res.status(200).send({ profile: await User.followUser(validatedUser.username, matchedPath.username) });
    } else if (req.method == 'DELETE' && req.path.startsWith('/profiles/')) {
      const matchedPath = (new routeParser('/profiles/:username')).match(req.path);
      res.status(200).send({ profile: await User.unfollowUser(validatedUser.username, matchedPath.username) });
    } else if (req.method == 'GET' && req.path == '/user') {
      if (!validatedUser) {
        res.status(401).send({ errors: { body: ['Token is required'], }, });
      }
      res.status(200).send({ user: validatedUser });
    } else if (req.method == 'GET' && req.path == '/articles') {
      const articles = await Article.getAll({
        tag: req.query.tag,
        author: req.query.author,
        limit: req.query.limit,
        offset: req.query.offset,
        reader: validatedUsername,
      });
      res.status(200).send({ articles, articlesCount: articles.length });
    } else if (req.method == 'POST' && req.path == '/articles') {
      if (!validatedUser) {
        res.status(401).send({ errors: { body: ['Must be logged in'], }, });
      }
      res.status(200).send({ article: await Article.create(req.body.article, validatedUsername) });
    } else if (req.method == 'GET' && req.path.startsWith('/articles/')) {
      const matchedPath = (new routeParser('/articles/:slug')).match(req.path);
      res.status(200).send({ article: await Article.get(matchedPath.slug, validatedUsername) });
    } else if (req.method == 'DELETE' && req.path.startsWith('/articles/')) {
      if (!validatedUser) {
        res.status(401).send({ errors: { body: ['Must be logged in'], }, });
      }
      const matchedPath = (new routeParser('/articles/:slug')).match(req.path);
      res.status(200).send(await Article.delete(matchedPath.slug, validatedUsername));
    } else {
      res.status(404).send({ errors: { body: [`404 Not found: [${req.method} ${req.path}]`], }, });
    }

  },

};
