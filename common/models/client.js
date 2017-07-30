var cron = require('cron')

var config = require('../../server/config.json')
var path = require('path')

var utility = require('../../public/utility.js')
var app = require('../../server/server')
var roleManager = require('../../public/roleManager')

var PRODUCTION = false

var methodDisabler = require('../../public/methodDisabler.js')
var relationMethodPrefixes = [
  'createChangeStream',
  'upsertWithWhere',
  'patchOrCreate',
  'exists',
  'prototype.patchAttributes'
]

var userStatus = require('../../config/userStatus.json')

module.exports = function(client) {

	var dailyPredict = cron.job("00 00 00 * * 1-7", function () {
    client.find(function(err, clientList) {
      if (err)
        return console.error(err)
      for (var i = 0; i < clientList.length; i++) {
        var newChances = clientList[i].accountInfoModel.chances + 1
        clientList[i].accountInfo.update({'chances': newChances}, function(err, result) {
          if (err)
            return console.error(err)
        })
      }
    })
  })

	dailyPredict.start()

	methodDisabler.disableOnlyTheseMethods(client, relationMethodPrefixes)
	client.validatesLengthOf('password', {min: 6})

  client.beforeRemote('login', function (ctx, modelInstance, next) {
    if (PRODUCTION) {
      var pass1 = utility.base64Decoding(ctx.args.credentials.password).toString()
      var pass2 = utility.base64Decoding(ctx.req.body.password).toString()
      ctx.args.credentials.password = pass1
      ctx.req.body.password 				= pass2
    }
    if (ctx.args.credentials.email || ctx.req.body.email) {
      ctx.args.credentials.email 	= ctx.args.credentials.email.toLowerCase()
      ctx.req.body.email 					= ctx.req.body.email.toLowerCase()
    }
    return next()
  })

  client.beforeRemote('create', function (ctx, modelInstance, next) {
    if (PRODUCTION) {
      var pass1 = utility.base64Decoding(ctx.args.data.password).toString()
      var pass2 = utility.base64Decoding(ctx.req.body.password).toString()
      ctx.args.data.password 	= pass1
      ctx.req.body.password 	= pass2
    }
    var verification = app.models.verification
    verification.checkUserVerification(ctx.args.data.phoneNumber, function(err, result) {
      if (err)
        return next(err)
      if (!result)
        return next(new Error('Not Verified Yet!'))
      var whiteList = ['status', 'email', 'username', 'password', 'time', 'phoneNumber', 'fullname', 'referrer']
      if (!utility.inputChecker(ctx.args.data, whiteList))
        return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
      else {
        function done() {
          ctx.args.data.emailVerified = true
          ctx.args.data.status        = userStatus.available
          ctx.args.data.email 				= ctx.args.data.email.toLowerCase()
          ctx.args.data.sequencerModel = {}
          ctx.args.data.sequencerModel.counter = {}
          ctx.args.data.accountInfoModel 	= {}
          ctx.args.data.accountInfoModel.chances 		    = 10
          ctx.args.data.accountInfoModel.roundWins 	    = 0
          ctx.args.data.accountInfoModel.totalPoints    = 0
          ctx.args.data.accountInfoModel.totalEstimates = 0
          ctx.args.data.referralModel = {}
          ctx.args.data.referralModel.clients = []
          ctx.args.data.trophyModel 	= {}
          ctx.args.data.trophyModel.time    = ctx.args.data.time
          ctx.args.data.trophyModel.level   = 0
          return next()
        }
        if (ctx.args.data.referrer) {
          client.findById(ctx.args.data.referrer, function(err, result) {
            if (err)
              return next(new Error('Referrer Does not Exists'))
            done()
          })
        } else {
          done()
        }
      }
    })
  })

  client.afterRemote('create', function (ctx, modelInstance, next) {
    var option = {}
    option.name = '' + modelInstance.id
    var container = app.models.container
    container.createContainer(option, function (err, container) {
      if (err)
        return next(err)
      container.uploadSampleProImage(modelInstance.id, function(err, result) {
        if (err)
          return next(err)
        if (modelInstance.referrer) {
          client.findById(modelInstance.referrer, function(err, referrerInst) {
            if (err)
              return next(err)
            if (referrerInst.referralModel.clients.length >= 0) {
              return next()
            }
            else {
              var newClients = []
              newClients = referrerInst.referralModel.clients
              newClients.push(modelInstance.id)
              referrerInst.referral.update({'clients': newClients}, function(err, result) {
                if (err)
                  return next(err)
                var newReferrerChances = referrerInst.accountInfoModel.chances + 5
                referrerInst.accountInfo.update({'chances': newReferrerChances}, function(err, result) {
                  if (err)
                    return next(err)
                  var newModelInstanceChances = referrerInst.accountInfoModel.chances + 5
                  modelInstance.accountInfo.update({'chances': newModelInstanceChances}, function(err, result) {
                    if (err)
                      return next(err)
                    return next()
                  })
                })
              })
            }
          })
        } else {
          return next()
        }
      })
    })
  })

  client.beforeRemote('prototype.__update__accountInfo', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    client.findById(ctx.req.params.id, function (err, result) {
      if (err)
        return next(err)
			if (ctx.args.data.chances)
				ctx.args.data.chances 		+= result.accountInfoModel.chances
			if (ctx.args.data.roundWins)
				ctx.args.data.roundWins 	+= result.accountInfoModel.roundWins
			if (ctx.args.data.totalPoints)
        ctx.args.data.totalPoints += result.accountInfoModel.totalPoints	
			if (ctx.args.data.totalEstimates)
        ctx.args.data.totalEstimates += result.accountInfoModel.totalEstimates	      		
      return next()
    })
  })

  client.beforeRemote('changePassword', function (ctx, modelInstance, next) {
    if (PRODUCTION) {
      var pass1 = utility.base64Decoding(ctx.args.data.password).toString()
      var pass2 = utility.base64Decoding(ctx.req.body.password).toString()
      var conf1 = utility.base64Decoding(ctx.args.data.confirmation).toString()
      var conf2 = utility.base64Decoding(ctx.req.body.confirmation).toString()
      ctx.args.data.password 			= pass1
      ctx.req.body.password 			= pass2
      ctx.args.data.confirmation 	= conf1
      ctx.req.body.confirmation 	= conf2
    }
    return next()
  })

  client.beforeRemote('replaceById', function (ctx, modelInstance, next) {
    var whiteList = ['fullname']
    if (utility.inputChecker(ctx.args.data, whiteList))
      return next()
    else
      return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
  })

  client.changePassword = function (data, req, res, cb) {
    if (!req.accessToken)
      return res.sendStatus(401)

    if (!req.body.password || !req.body.confirmation ||
      req.body.password !== req.body.confirmation) {
      return res.sendStatus(400, new Error('Passwords do not match'))
    }

    client.findById(req.accessToken.userId, function (err, user) {
      if (err) return res.sendStatus(404)
      user.updateAttribute('password', req.body.password, function (err, user) {
        if (err) return res.sendStatus(404)
        res.render('response', {
          title: 'Password reset success',
          content: 'Your password has been reset successfully',
          redirectTo: '/',
          redirectToLinkText: 'Log in'
        })
      })
    })
  }

  client.remoteMethod('changePassword', {
    accepts: [{
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      }
    }, {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, {
      arg: 'res',
      type: 'object',
      http: {
        source: 'res'
      }
    }],
    description: 'change password method with accessToken',
    http: {
      path: '/changePassword',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      arg: 'response',
      type: 'string'
    }
  })

  client.on('resetPasswordRequest', function (info) {
    var url = 'http://' + config.host + ':' + config.port + '/reset-password'
    var html = 'Click <a href="' + url + '?access_token=' +
      info.accessToken.id + '">here</a> to reset your password'

    client.app.models.Email.send({
      to: info.email,
      from: info.email,
      subject: 'Password Reset',
      html: html
    }, function (err) {
      if (err) return next(err)
    })
  })


  client.nextObject = function (ctx, clientId, leagueId, callback) {
    if (!ctx.req.accessToken)
      return callback(new Error('AccessToken Required'))

    if (ctx.req.accessToken.userId !== championInst.creatorId)
      return callback(new Error('Owner Error'))

    client.findById(clientId, function(err, clientInst) {
      var index = 0
      if (clientInst.sequencerModel.counter[leagueId])
        index = clientInst.sequencerModel.counter[leagueId]
      clientInst.sequencerModel.counter[leagueId] = index
      var league = app.models.league
      league.findById(leagueId, function(err, leagueInst) {
        if (err)
          return callback(err)
        leagueInst.predicts(function(err, predictsList) {
          if (err)
            return callback(err)
          if (index >= predictsList.length)
            return callback(new Error('end of predication list of this league'))
          var nextPredict = predictsList[index]
          clientInst.sequencerModel.counter[leagueId] += 1
          clientInst.sequencer.update({'counter': clientInst.sequencerModel.counter}, function(err, result) {
            if (err)
              return callback(err)
            return callback(null, nextPredict)
          })
        })
      })
		})
  }

  client.remoteMethod('nextObject', {
    description: 'join to a particular champion',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      }, {
        arg: 'clientId',
        type: 'string',
        required: true,
        http: {
          source: 'query'
        }
      }, {
        arg: 'leagueId',
        type: 'string',
        required: true,
        http: {
          source: 'query'
        }
      }
    ],
    http: {
      path: '/:clientId/nextObject/:leagueId',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
  })
  
}
