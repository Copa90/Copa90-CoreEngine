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
				var model = challengeList[i]
				if (Number(model.endingTime) <= time) {
					model.updateAttribute('status', statusConfig.finished, function (err, challengeInst) {
						if (err)
							console.error(err)
						var competition = app.models.competition
						competition.find({'where':{'challengeId': challengeInst.id.toString()}}, function(err, competitionsList) {
							if (err)
								console.error(err)
							if (competitionsList.length == 1)
								return console.error('challenge does not exist')
							function compare(a, b){
								return Number(b.points) - Number(a.points)
							}
							competitionsList.sort(compare)
							if (competitionsList.length == 1)
								return console.error('finishing challenge by one user without award')
							var client = app.models.client
							client.findById(competitionsList[0].clientId.toString(), function(err, clientInst) {
								if (err)
									console.error(err)
								var award = (Number(challengeInst.reduceChances) * 2) + Number(clientInst.accountInfoModel.chances)
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
		client.findById(ctx.args.data.creatorId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (Number(clientInst.accountInfoModel.chances) < Number(ctx.args.data.reduceChances))
				return next(new Error('خطا! شما به اندازه کافی شانس برای ایجاد چالش ندارید'))
			if (Number(ctx.args.data.period) < 259200000)
				return next(new Error('خطا! طول مدت زمان چالش نباید کمتر از ۳ روز باشد'))
			ctx.args.data.beginningTime = time
			ctx.args.data.endingTime = time + Number(ctx.args.data.period)
			ctx.args.data.capacity = 2
			ctx.args.data.status = statusConfig.working
			return next()
		})
	})

	challenge.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		client.findById(modelInstance.creatorId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			modelInstance.clients.add(clientInst, function(err, result) {
				if (err)
					return next(err)
				var newChances = Number(clientInst.accountInfoModel.chances) - Number(modelInstance.reduceChances)
				clientInst.accountInfo.update({'chances': newChances}, function(err, result) {
					if (err)
						return next(err)
					return next(null, 'Successfuly Joined')							
				})
			})
		})
	})

	challenge.beforeRemote('replaceById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    roleManager.getRolesById(app, ctx.args.options.accessToken.userId.toString(), function (err, response) {
      if (err)
        return next(err)
      if (response.roles.length == 0) {
				challenge.findById(ctx.req.params.id.toString(), function(err, challengeInst) {
					if (err)
						return next(err)
					if (ctx.args.options.accessToken.userId.toString() !== challengeInst.creatorId.toString())
						return next(new Error('خطا! شما برای اعمال تغییرات دسترسی ندارید'))
					var whiteList = ['name']
					if (!utility.inputChecker(ctx.args.data, whiteList))
						return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
					ctx.args.data.creatorId = challengeInst.creatorId.toString()
					ctx.args.data.reduceChances = Number(challengeInst.reduceChances)
					ctx.args.data.period = Number(challengeInst.period)
					ctx.args.data.beginningTime = Number(challengeInst.beginningTime)
					ctx.args.data.endingTime = Number(challengeInst.endingTime)
					ctx.args.data.status = challengeInst.status
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
					var newChances = Number(clientModel.accountInfoModel.chances) + Number(challengeModel.reduceChances)
					clientModel.accountInfo.update({'chances': newChances}, function(err, result) {
						if (err)
							return next(err)
						challengeModel.clients.destroyAll(function(err, result) {
							if (err)
								return next(err)
							return next()							
						})
					})
				}
				else 
					return next()
			})
		}
		roleManager.getRolesById(app, ctx.args.options.accessToken.userId.toString(), function (err, response) {
      if (err)
				return next(err)
			challenge.findById(ctx.req.params.id.toString(), function(err, challengeInst) {
				if (err)
					return next(err)
				var client = app.models.client
				client.findById(challengeInst.creatorId.toString(), function(err, clientInst) {
					if (err)
						return callback(err)
					if (response.roles.length == 0) {
						if (ctx.args.options.accessToken.userId.toString() !== challengeInst.creatorId.toString())
							return next(new Error('خطا! شما برای حذف این چالش دسترسی ندارید'))							
						returnChances(challengeInst, clientInst)
					}
					else 
						returnChances(challengeInst, clientInst)
				})
			})
		})
	})

  challenge.joinChallenge = function (ctx, challengeId, clientId, callback) {
		challenge.findById(challengeId.toString(), function(err, challengeInst) {
			if (err)
				return callback(err)
			challengeInst.clients(function(err, challengeClientsList) {
				if (err)
					return callback(err)
				if (Number(challengeClientsList.length) + 1 > Number(challengeInst.capacity))
					return callback(new Error('خطا! ظرفیت چالش تکمیل است'))
				for (var i = 0; i < challengeClientsList.length; i++)
					if (challengeClientsList[i].id.toString() === clientId.toString())
						return callback(new Error('خطا! شما در حال حاضر در این چالش حضور دارید'))
				var client = app.models.client
				client.findById(clientId.toString(), function(err, clientInst) {
					if (err)
						return callback(err)
					if (Number(clientInst.accountInfoModel.chances) < Number(challengeInst.reduceChances))
						return callback(new Error('خطا! شما به اندازه کافی شانس برای پیوستن به این چالش ندارید'))
					challengeInst.clients.add(clientInst, function(err, result) {
						if (err)
							return callback(err)
						var newChances = Number(clientInst.accountInfoModel.chances) - Number(challengeInst.reduceChances)
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
          source: 'path'
        }
      },
      {
        arg: 'clientId',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      }
    ],
    http: {
      path: '/:challengeId/joinChallenge/:clientId',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
	})
	
  challenge.leaveChallenge = function (ctx, challengeId, clientId, callback) {
		challenge.findById(challengeId.toString(), function(err, challengeInst) {
			if (err)
				return callback(err)
			if (ctx.req.accessToken.userId.toString() === challengeInst.creatorId.toString())
				return callback(new Error('خطا! سازنده چالش نمی‌تواند از آن خارج شود'))
			var client = app.models.client
			client.findById(clientId.toString(), function(err, clientInst) {
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
          source: 'path'
        }
      },
      {
        arg: 'clientId',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      }
    ],
    http: {
      path: '/:challengeId/leaveChallenge/:clientId',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
  })
	
}
