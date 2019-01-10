'use strict';

var request = require('supertest-as-promised');
var StatsD = require('node-statsd');
var expect = require('chai').expect;
var sinon = require('sinon');

// Set up environment vars
process.env['ALLOWED_APPS'] = 'test-app';
process.env['TEST_APP_PASSWORD'] = 'test-pass';
process.env['TEST_APP_TAGS'] = 'default:tag';
var app = require('./app');


describe('Heroku Datadog Drain', function () {
  beforeEach(function () {
    sinon.spy(StatsD.prototype, 'histogram');
    sinon.spy(StatsD.prototype, 'increment');
  });

  afterEach(function () {
    StatsD.prototype.histogram.restore();
    StatsD.prototype.increment.restore();
  });

  it('returns HTTP 401 if credentials are not found in environment', function () {
    return request(app)
      .post('/')
      .auth('invalid-user', 'invalid-pass')
      .expect(401);
  });

  it('sends router response metrics and error count to statsd', function () {
    return request(app)
    .post('/')
    .auth('test-app', 'test-pass')
    .set('Content-type', 'application/logplex-1')
    .send(`255 <158>1 2015-04-02T11:52:34.520012+00:00 host heroku router - at=info method=POST path="/users" host=myapp.com request_id=c1806361-2081-42e7-a8aa-92b6808eac8e fwd="24.76.242.18" dyno=web.1 connect=1ms service=37ms status=201 bytes=828\n
          293 <158>1 2015-04-02T11:52:37.888674+00:00 host heroku router - at=info method=GET path="/users/me/tasks" host=myapp.com request_id=d66b4e46-049f-4592-b0b0-a253dc1b0c62 fwd="24.77.243.44" dyno=web.2 connect=1ms service=64ms status=200 bytes=54414\n
          255 <158>1 2015-04-02T12:52:31.520012+00:00 host heroku router - at=error code=H12 desc="Request timeout" method=GET path="/" host=myapp.com fwd=17.17.17.17 dyno=web.1 connect=6ms service=30001ms status=503 bytes=0`)
    .expect(200)
    .expect('OK')
    .then(function () {
      expect(StatsD.prototype.histogram.args).to.deep.equal([
        ['heroku.router.request.connect', 1, ['dyno:web.1', 'path:/users', 'method:POST', 'status:201', 'host:myapp.com', 'at:info', 'default:tag', 'app:test-app']],
        ['heroku.router.request.service', 37, ['dyno:web.1', 'path:/users', 'method:POST', 'status:201', 'host:myapp.com', 'at:info', 'default:tag', 'app:test-app']],
        ['heroku.router.request.connect', 1, ['dyno:web.2', 'path:/users/me/tasks', 'method:GET', 'status:200', 'host:myapp.com', 'at:info', 'default:tag', 'app:test-app']],
        ['heroku.router.request.service', 64, ['dyno:web.2', 'path:/users/me/tasks', 'method:GET', 'status:200', 'host:myapp.com', 'at:info', 'default:tag', 'app:test-app']],
        ['heroku.router.request.connect', 6, ['dyno:web.1', 'path:/', 'method:GET', 'status:503', 'host:myapp.com', 'code:H12', 'desc:Request timeout', 'at:error', 'default:tag', 'app:test-app']],
        ['heroku.router.request.service', 30001, ['dyno:web.1', 'path:/', 'method:GET', 'status:503', 'host:myapp.com', 'code:H12', 'desc:Request timeout', 'at:error', 'default:tag', 'app:test-app']],
      ]);
      expect(StatsD.prototype.increment.args).to.deep.equal([
        ['heroku.router.error', 1, ['dyno:web.1', 'path:/', 'method:GET', 'status:503', 'host:myapp.com', 'code:H12', 'desc:Request timeout', 'at:error', 'default:tag', 'app:test-app']],
      ]);
    });
  });

  it('sends dyno runtime metrics to statsd', function () {
    return request(app)
    .post('/')
    .auth('test-app', 'test-pass')
    .set('Content-type', 'application/logplex-1')
    .send(`229 <45>1 2015-04-02T11:48:16.839257+00:00 host heroku web.1 - source=web.1 dyno=heroku.35930502.b9de5fce-44b7-4287-99a7-504519070cba sample#load_avg_1m=0.01 sample#load_avg_5m=0.02 sample#load_avg_15m=0.03\n
          329 <45>1 2015-04-02T11:48:16.839348+00:00 host heroku web.1 - source=web.1 dyno=heroku.35930502.b9de5fce-44b7-4287-99a7-504519070cba sample#memory_total=103.50MB sample#memory_rss=94.70MB sample#memory_cache=0.32MB sample#memory_swap=8.48MB sample#memory_pgpgin=36091pages sample#memory_pgpgout=11765pages`)
    .expect(200)
    .expect('OK')
    .then(function () {
      expect(StatsD.prototype.histogram.args).to.deep.equal([
        ['heroku.dyno.load.avg.1m', 0.01, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.load.avg.5m', 0.02, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.load.avg.15m', 0.03, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.memory.total', 103.50, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.memory.rss', 94.70, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.memory.cache', 0.32, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.memory.swap', 8.48, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.memory.pgpgin', 36091, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']],
        ['heroku.dyno.memory.pgpgout', 11765, ['default:tag', 'app:test-app', 'dyno:web.1', 'dynotype:web']]
      ]);
    });
  });
  
  it('sends dyno error metrics to statsd', function () {
    return request(app)
    .post('/')
    .auth('test-app', 'test-pass')
    .set('Content-type', 'application/logplex-1')
    .send(`101 <190>1 2019-01-08T22:54:30.612299+00:00 host heroku web.8 - Error R15 (Memory quota vastly exceeded)\n
          93 <45>1 2019-01-09T02:19:15.183214+00:00 host heroku web.4 - Error R14 (Memory quota exceeded)\n
          153 <190>1 2019-01-09T00:49:05.050339+00:00 host heroku web.4 - Error R10 (Boot timeout) -> Web process failed to bind to $PORT within 120 seconds of launch`)
    .expect(200)
    .expect('OK')
    .then(function () {
      expect(StatsD.prototype.increment.args).to.deep.equal([
        ['heroku.dyno.error', 1, ['default:tag', 'app:test-app', 'dyno:web.8', 'dynotype:web', 'code:R15']],
        ['heroku.dyno.error', 1, ['default:tag', 'app:test-app', 'dyno:web.4', 'dynotype:web', 'code:R14']],
        ['heroku.dyno.error', 1, ['default:tag', 'app:test-app', 'dyno:web.4', 'dynotype:web', 'code:R10']],
      ]);
    });
  });

  it('sends PostgreSQL metrics to statsd', function () {
    return request(app)
    .post('/')
    .auth('test-app', 'test-pass')
    .set('Content-type', 'application/logplex-1')
    .send('542 <134>1 2015-04-02T11:47:55+00:00 host app heroku-postgres - source=HEROKU_POSTGRESQL_TEAL sample#current_transaction=6709 sample#db_size=18032824bytes sample#tables=16 sample#active-connections=4 sample#waiting-connections=0 sample#index-cache-hit-rate=0.99971 sample#table-cache-hit-rate=0.99892 sample#load-avg-1m=0.315 sample#load-avg-5m=0.22 sample#load-avg-15m=0.225 sample#read-iops=25.996 sample#write-iops=1.629 sample#memory-total=15666128kB sample#memory-free=233092kB sample#memory-cached=14836812kB sample#memory-postgres=170376kB')
    .expect(200)
    .expect('OK')
    .then(function () {
      expect(StatsD.prototype.histogram.args).to.deep.equal([
        ['heroku.postgres.current_transaction', 6709, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.db_size', 18032824, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.tables', 16, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.active-connections', 4, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.waiting-connections', 0, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.index-cache-hit-rate', 0.99971, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.table-cache-hit-rate', 0.99892, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.load-avg-1m', 0.315, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.load-avg-5m', 0.22, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.load-avg-15m', 0.225, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.read-iops', 25.996, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.write-iops', 1.629, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.memory-total', 15666128, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.memory-free', 233092, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.memory-cached', 14836812, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']],
        ['heroku.postgres.memory-postgres', 170376, ['source:HEROKU_POSTGRESQL_TEAL', 'default:tag', 'app:test-app']]
      ]);
    });
  });

  it('sends dyno scaling metrics and events to statsd', function () {
    sinon.spy(StatsD.prototype, 'gauge');
    return request(app)
    .post('/')
    .auth('test-app', 'test-pass')
    .set('Content-type', 'application/logplex-1')
    .send('222 <134>1 2015-04-07T16:01:43.517062+00:00 host heroku api - Scale to mailer=1, web=3 by someuser@gmail.com')
    .expect(200)
    .expect('OK')
    .then(function () {
      expect(StatsD.prototype.gauge.args).to.exist;
      expect(StatsD.prototype.gauge.args).to.deep.equal([
        ['heroku.dyno.mailer', 1, ['default:tag', 'app:test-app']],
        ['heroku.dyno.web', 3, ['default:tag', 'app:test-app']]
      ]);
      // TODO: Also send datadog event
    })
    .finally(function () {
      StatsD.prototype.gauge.restore();
    });
  });
});
