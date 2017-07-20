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
      var whiteList = ['status', 'email', 'username', 'password', 'time', 'phoneNumber', 'fullname']
      if (!utility.inputChecker(ctx.args.data, whiteList))
        return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
      else {
        ctx.args.data.emailVerified = true
        ctx.args.data.status        = userStatus.available
        ctx.args.data.email 				= ctx.args.data.email.toLowerCase()
        ctx.args.data.accountInfo 	= {}
        ctx.args.data.accountInfo.chances 		= 0
        ctx.args.data.accountInfo.roundWins 	= 0
        ctx.args.data.accountInfo.totalPoints = 0
        ctx.args.data.accountInfo.totalEstimates = 0
        return next()
      }
    })
  })

  client.beforeRemote('prototype.__update__accountInfo', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    client.findById(ctx.req.params.id, function (err, result) {
      if (err)
        return next(err)
			if (ctx.args.data.chances)
				ctx.args.data.chances 		+= result.accountInfo.chances
			if (ctx.args.data.roundWins)
				ctx.args.data.roundWins 	+= result.accountInfo.roundWins
			if (ctx.args.data.totalPoints)
        ctx.args.data.totalPoints += result.accountInfo.totalPoints	
			if (ctx.args.data.totalEstimates)
        ctx.args.data.totalEstimates += result.accountInfo.totalEstimates	      		
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


}
