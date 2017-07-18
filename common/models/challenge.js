var cron = require('cron')
var app = require('../../server/server')
var roleManager = require('../../public/roleManager')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/challengeStatus.json')

module.exports = function(challenge) {

	var finishChallenges = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		challenge.find({
			where: {
				'status': statusConfig.working
			}
		}, function (err, challengeList) {
			if (err)
				console.error(err)
			for (var i = 0; i < challengeList.length; i++) {
				if (challengeList[i].endingTime <= time) {
					challengeList[i].updateAttribute('status', statusConfig.finished, function (err, challengeInst) {
						if (err)
							console.error(err)
						var competition = app.models.competition
						competition.find({'where':{'challengeId': challengeInst.id}, 'Order': 'Points DESC'}, function(err, competitionsList) {
							if (err)
								console.error(err)
							var client = app.models.client
							client.find({'where':{'id': competitionsList[0].clientId}}, function(err, clientInst) {
								if (err)
									console.error(err)
								var award = (challengeInst.reduceChances * 2) + clientInst.accountInfoModel.chances
								clientInst.accountInfo.update({'chances': award}, function(err, result) {
									if (err)
										console.error(err)
									console.log('successful rewarding')
								})
							})
						})
					})
				}
			}
		})
	})

	finishChallenges.start()

	challenge.beforeRemote('create', function (ctx, modelInstance, next) {
		var time = utility.getUnixTimeStamp()
		var client = app.models.client
		client.findById(ctx.args.data.creatorId, function(err, clientInst) {
			if (err)
				return next(err)
			if (clientInst.accountInfo.chances < ctx.args.data.reduceChances)
				return next(new Error('You Do not Have That Propper Chances!'))
			if (ctx.args.data.period < 259200000)
				return next(new Error('Period Can not be Less then 3 Days'))
			ctx.args.data.beginningTime = time
			ctx.args.data.endingTime = time + ctx.args.data.period
			ctx.args.data.capacity = 2
			ctx.args.data.status = statusConfig.working
			return next()
		})
	})

	challenge.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		client.findById(modelInstance.creatorId, function(err, clientInst) {
			if (err)
				return next(err)
			modelInstance.clients.add(clientInst, function(err, result) {
				if (err)
					return next(err)
				return next()
			})
		})
	})

	challenge.beforeRemote('updateById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    roleManager.getRolesById(app, ctx.args.options.accessToken.userId, function (err, response) {
      if (err)
        return next(err)
      if (response.roles.length == 0) {
				challenge.findById(ctx.args.data.id, function(err, challengeInst) {
					if (err)
						return next(err)
					if (ctx.args.options.accessToken.userId !== challengeInst.creatorId)
						return next(new Error('You have not Access to Challenge!'))
					var whiteList = ['name']
					if (!utility.inputChecker(ctx.args.data, whiteList))
						return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
					return next()
				})
			}
			else 
				return next()
		})
	})

	challenge.beforeRemote('deleteById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
		function returnChances(challengeModel, clientModel) {
			challengeModel.clients(function(err, challengeClientsList) {
				if (err)
					return next(err)
				if (challengeClientsList.length == 1) {
					var newChances = clientModel.accountInfoModel.chances + challengeModel.reduceChances
					clientModel.accountInfo.update({'chances': newChances}, function(err, result) {
						if (err)
							return next(err)
						return next()
					})
				}
				else 
					return next()
			})
		}
		roleManager.getRolesById(app, ctx.args.options.accessToken.userId, function (err, response) {
      if (err)
				return next(err)
			challenge.findById(ctx.args.data.id, function(err, challengeInst) {
				if (err)
					return next(err)
				var client = app.models.client
				client.findById(challengeInst.creatorId, function(err, clientInst) {
					if (err)
						return callback(err)
					if (response.roles.length == 0) {
						if (ctx.args.options.accessToken.userId !== challengeInst.creatorId)
							return next(new Error('You have not Access to Challenge!'))							
						returnChances(challengeInst, clientInst)
					}
					else 
						returnChances(challengeInst, clientInst)
				})
			})
		})
	})

  challenge.joinChallenge = function (ctx, challengeId, clientId, callback) {
		challenge.findById(challengeId, function(err, challengeInst) {
			if (err)
				return callback(err)
			challengeInst.clients(function(err, challengeClientsList) {
				if (err)
					return callback(err)
				if (challengeClientsList.length + 1 > challengeInst.capacity)
					return callback(new Error('Capacity is Full'))
				var client = app.models.client
				client.findById(clientId, function(err, clientInst) {
					if (err)
						return callback(err)
					if (clientInst.accountInfoModel.chances < challengeInst.reduceChances)
						return callback(new Error('Not Enough Chances to Join'))
					challengeInst.clients.add(clientInst, function(err, result) {
						if (err)
							return callback(err)
						var newChances = clientInst.accountInfoModel.chances - challengeInst.reduceChances
						clientInst.accountInfo.update({'chances': newChances}, function(err, result) {
							if (err)
								return callback(err)
							return callback(null, 'Successfuly Joined')							
						})
					})
				})
			})
		})
  }

  challenge.remoteMethod('joinChallenge', {
    description: 'join to a particular challenge',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      },
      {
        arg: 'challengeId',
        type: 'string',
        required: true,
        http: {
          source: 'query'
        }
      },
      {
        arg: 'clientId',
        type: 'string',
        required: true,
        http: {
          source: 'query'
        }
      }
    ],
    http: {
      path: '/:challengeId/joinChallenge/:clientId',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
	})
	
  challenge.leaveChallenge = function (ctx, challengeId, clientId, callback) {
		challenge.findById(challengeId, function(err, challengeInst) {
			if (err)
				return callback(err)
			if (ctx.req.accessToken.userId !== challengeInst.creatorId)
				return callback(new Error('Owner Error'))
			if (ctx.req.accessToken.userId === clientId)
				return callback(new Error('Owner Can not Leave'))
			var client = app.models.client
			client.findById(clientId, function(err, clientInst) {
				if (err)
					return callback(err)
				challengeInst.clients.remove(clientInst, function(err, result) {
					if (err)
						return callback(err)
					return callback(null, 'Successfuly Left')	
				})
			})
		})
  }

  challenge.remoteMethod('leaveChallenge', {
    description: 'leave from a particular challenge',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      },
      {
        arg: 'challengeId',
        type: 'string',
        required: true,
        http: {
          source: 'query'
        }
      },
      {
        arg: 'clientId',
        type: 'string',
        required: true,
        http: {
          source: 'query'
        }
      }
    ],
    http: {
      path: '/:challengeId/leaveChallenge/:clientId',
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
