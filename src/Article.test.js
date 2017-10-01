var user = require('./User.js');
var Article = require('./Article.js');
var expect = require('chai').expect;
var casual = require('casual');
var mlog = process.env.CI ? { log() {} } : require('mocha-logger');

var authorUser = null;
var readerUser = null;
var createdArticle = null;

describe('Article module', async() => {

  before(async() => {
    var authorUsername = 'author_' + casual.username;
    authorUser = await user.create({
      email: authorUsername + '@mail.com',
      username: authorUsername,
      password: 'a',
    });

    var readerUsername = 'reader_' + casual.username;
    readerUser = await user.create({
      email: readerUsername + '@mail.com',
      username: readerUsername,
      password: 'a',
    });
  });

  it('should create new article', async() => {
    createdArticle = await Article.create({
      title: casual.title,
      description: casual.description,
      body: casual.text,
      tagList: casual.array_of_words(Math.ceil(10 * Math.random())),
    }, authorUser.username);
    // TODO: Assert on Article fields
    mlog.log(`Created article: [${JSON.stringify(createdArticle)}]`);
  });

  it('should create new article wihtout tags', async() => {
    createdArticleNoTags = await Article.create({
      title: casual.title,
      description: casual.description,
      body: casual.text,
    }, authorUser.username);
    expect(createdArticleNoTags.tagList).to.be.an('array').that.is.empty;
  });

  it('should not allow unknown author', async() => {
    await Article.create(null, casual.username).catch(err =>
      expect(err).to.match(/User does not exist/));
  });

  it('should get existing article anonymously', async() => {
    retrievedArticle = await Article.get(createdArticle.slug);
    expect(retrievedArticle.author.following).to.be.false;
  });

  it('should get article by followed author', async() => {
    await user.followUser(readerUser.username, authorUser.username);
    var retrievedArticle = await Article.get(createdArticle.slug, readerUser.username);
    mlog.log(`Retrieved article: [${JSON.stringify(retrievedArticle)}]`);
    expect(retrievedArticle.author.following).to.be.true;
  });

  it('should get article by followed author', async() => {
    await user.unfollowUser(readerUser.username, authorUser.username);
    retrievedArticle = await Article.get(createdArticle.slug, readerUser.username);
    expect(retrievedArticle.author.following).to.be.false;
  });

  it('should error on unknown article', async() => {
    await Article.get(casual.password).catch(err =>
      expect(err).to.match(/Article not found/));
  });

  it('should error on unknown reader', async() => {
    await Article.get(createdArticle.slug, casual.password).catch(err =>
      expect(err).to.match(/User does not exist/));
  });

});
