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
    await cleanSlate();
    await delay(1000);

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

  after(async() => {
    await cleanSlate();
    await delay(1000);
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

  it('should get article by unfollowed author', async() => {
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

  it('should get all articles', async() => {
    var articles = await Article.getAll();
  });

  it('should get all articles by tag', async() => {
    var articles = await Article.getAll({ tag: createdArticle.tagList[0] });
    expect(articles[0].tagList).to.contain(createdArticle.tagList[0]);
  });

  it('should get all articles by author', async() => {
    var articles = await Article.getAll({ author: authorUser.username });
    expect(articles[0].author.username).to.equal(authorUser.username);
  });

  it('should get all articles with limit/offset', async() => {
    // Create few more articles for pagination
    process.stdout.write('      ');
    for (var i = 1; i <= 10; ++i) {
      process.stdout.write('.');
      await Article.create({
          title: i,
          description: `description ${i}`,
          body: `body ${i}`,
          tagList: ['sometag', `tag${i}`],
        },
        authorUser.username);
      await delay(100);
    }
    console.log('');

    var articles = await Article.getAll({ limit: 3 });
    expect(articles).to.be.an('array').to.have.lengthOf(3);

    var articles = await Article.getAll({ offset: 3 });
    expect(articles).to.be.an('array').to.have.lengthOf(9);
  });

  it('should get all articles with a reader', async() => {
    var articles = await Article.getAll({ reader: 'foobar' });
  });

  it('should get feed', async() => {
    // Create a second user to follow
    var secondAuthorUser = await user.create({
      username: 'second_author',
      email: 'second_author@gmail.com',
      password: 'a',
    });
    var secondAuthorArticle = await Article.create({
      title: 'second_author_article',
      description: 'foo',
      body: 'bar'
    }, secondAuthorUser.username);
    await user.followUser(readerUser.username, secondAuthorUser.username);
    await user.followUser(readerUser.username, authorUser.username);
    var feed = await Article.getFeed(readerUser.username);
    expect(feed).to.be.an('array').to.have.lengthOf(13);
    expect(feed[0].author.username).to.equal('second_author');
    expect(feed[0].title).to.equal('second_author_article');
    for (var article of feed.slice(1)) {
      expect(article.author.username).to.equal(authorUser.username);
    }

    // Verify order of feed is descending by createdAt
    for (var i = 0; i < feed.length-1; ++i) {
      expect(feed[i].createdAt).to.be.above(feed[i+1].createdAt);
    }

    // Unfollow first author, end expect only second author's article
    await user.unfollowUser(readerUser.username, authorUser.username);
    feed = await Article.getFeed(readerUser.username);
    expect(feed).to.be.an('array').to.have.lengthOf(1);

    await Article.getFeed('non-existent_username_' + casual.username).catch(err => {
      expect(err).to.match(/User not found/);
    });
  });

  it('should get feed with limit/offset', async() => {
    await user.followUser(readerUser.username, authorUser.username);
    var feed = await Article.getFeed(readerUser.username, { limit: 3 });
    expect(feed).to.be.an('array').to.have.lengthOf(3);
    feed = await Article.getFeed(readerUser.username, { limit: 4, offset: 2 });
    expect(feed).to.be.an('array').to.have.lengthOf(4);
  });

  it('should create new comment', async() => {
    var commentBody = casual.sentence;
    var createdComment = await Article.createComment(createdArticle.slug, authorUser.username, commentBody);
    mlog.log(`Created comment: [${JSON.stringify(createdComment)}]`);
    // TODO: Assert on created comment
  });

  it('should get all comments', async() => {
    var createdComments = [];
    process.stdout.write('      ');
    for (var i = 1; i <= 10; ++i) {
      process.stdout.write('.');
      createdComments.push(await Article.createComment(createdArticle.slug, authorUser.username, `comment ${i}`));
      await delay(100);
    }
    console.log('');
    var retrievedComments = await Article.getAllComments(createdArticle.slug);
    expect(retrievedComments, JSON.stringify(retrievedComments)).to.be.an('array').to.have.lengthOf(11);
    // Verify comments are in reverse chronological order (newest first)
    for (var i = 0; i < retrievedComments.length - 1; ++i) {
      expect(retrievedComments[i].createdAt).to.be.above(retrievedComments[i + 1].createdAt);
    }

    // Verify following bit is set correctly
    await user.followUser(readerUser.username, authorUser.username);
    retrievedComments = await Article.getAllComments(createdArticle.slug, readerUser.username);
    for (var i = 0; i < retrievedComments.length; ++i) {
      expect(retrievedComments[i].author.following).to.be.true;
    }
  });

});

function delay(time) {
  return new Promise(function(fulfill) {
    setTimeout(fulfill, time);
  });
}

async function cleanSlate() {
  mlog.log('Deleting all users.');
  await user.testutils.__deleteAllUsers();
  mlog.log('Deleting all articles.');
  await Article.testutils.__deleteAll();
  mlog.log('Deleting all comments.');
  await Article.testutils.__deleteAllComments();
}
