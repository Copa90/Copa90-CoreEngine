var cron = require('cron')
var app = require('../../server/server')
var roleManager = require('../../public/roleManager')

var utility	= require('../../public/utility')

module.exports = function(champion) {

	var hitRateCalculator = cron.job("0 */5 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		champion.find(function(err, championsList) {
			if (err)
				return console.error(err)
			for (var i = 0; i < championsList.length; i++) {
				var championInst = championsList[i]
				var ranking = app.models.ranking
				ranking.find({where:{'leagueId': champion.id}}, function(err, rankingList) {
					if (err)
						return console.error(err)
					var totalPoint = 0
					var totalPerson = []
					var personList = []
					for (var j = 0; j < rankingList.length; j++) {
						totalPoint += Number(rankingList[j].points)
						if (totalPerson.indexOf(rankingList[j].clientId.toString()) <= -1)
							totalPerson.push(rankingList[j].clientId)
					}
					totalPerson = personList.length
					var period = time - Number(champion.beginningTime)
					var hitRate = (totalPoint / (period * totalPerson) * 1000000) || 0
					championInst.updateAttribute('hitRate', hitRate, function(err, result) {
						if (err)
							return console.error(err)
					})
				})
			}
		})
	})

	hitRateCalculator.start()

	champion.beforeRemote('create', function (ctx, modelInstance, next) {
		var time = utility.getUnixTimeStamp()
		var client = app.models.client
		client.findById(ctx.args.data.creatorId, function(err, clientInst) {
			if (err)
				return next(err)
			if (Number(clientInst.accountInfoModel.chances) < Number(ctx.args.data.reduceChances))
				return next(new Error('خطا! شما به اندازه کافی شانس برای ایجاد لیگ خصوصی ندارید'))
			if (ctx.args.data.capacity < 5)
				return next(new Error('خطا! ظرفیت لیگ خصوصی نباید کمتر از ۵ نفر باشد'))
			ctx.args.data.beginningTime = time
			ctx.args.data.hitRate = 0
			return next()
		})
	})

	champion.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		client.findById(modelInstance.creatorId, function(err, clientInst) {
			if (err)
				return next(err)
			modelInstance.clients.add(clientInst, function(err, result) {
				if (err)
					return next(err)
				var newChances = Number(clientInst.accountInfoModel.chances) - Number(modelInstance.reduceChances)
				clientInst.accountInfo.update({'chances': newChances}, function(err, result) {
					if (err)
						return next(err)
					return next()					
				})
			})
		})
	})

	champion.beforeRemote('replaceById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    roleManager.getRolesById(app, ctx.args.options.accessToken.userId, function (err, response) {
      if (err)
        return next(err)
      if (response.roles.length == 0) {
				champion.findById(ctx.req.params.id, function(err, championInst) {
					if (err)
						return next(err)
					if (ctx.args.options.accessToken.userId.toString() !== championInst.creatorId.toString())
						return next(new Error('خطا! شما برای اعمال تغییرات دسترسی ندارید'))
					var whiteList = ['name', 'capacity', 'reduceChances']
					if (!utility.inputChecker(ctx.args.data, whiteList))
						return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
					ctx.args.data.creatorId = championInst.creatorId.toString()
					if (Number(ctx.args.data.capacity) < 5)
						return next(new Error('خطا! ظرفیت لیگ خصوصی نباید کمتر از ۵ نفر باشد'))
					championInst.clients(function(err, champClientsList) {
						if (err)
							return next(err)
						if (Number(ctx.args.data.capacity) < Number(champClientsList.length))
							return next(new Error('خطا! ظرفیت لیگ خصوصی نمی‌تواند کمتر از تعداد افراد آن باشد'))
						return next()
					})
				})
			}
			else 
				return next()
		})
	})

	champion.beforeRemote('deleteById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
		function returnChances(championModel, clientModel) {
			championModel.clients(function(err, champClientsList) {
				if (err)
					return next(err)
				if (champClientsList.length == 1) {
					var newChances = Number(clientModel.accountInfoModel.chances) + Number(championModel.reduceChances)
					clientModel.accountInfo.update({'chances': newChances}, function(err, result) {
						if (err)
							return next(err)
						championModel.clients.destroyAll(function(err, result) {
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
		roleManager.getRolesById(app, ctx.args.options.accessToken.userId, function (err, response) {
      if (err)
				return next(err)
			champion.findById(ctx.req.params.id, function(err, championInst) {
				if (err)
					return next(err)
				var client = app.models.client
				client.findById(championInst.creatorId, function(err, clientInst) {
					if (err)
						return callback(err)
					if (response.roles.length == 0) {
						if (ctx.args.options.accessToken.userId.toString() !== championInst.creatorId.toString())
							return next(new Error('خطا! شما برای حذف این لیگ خصوصی دسترسی ندارید'))							
						returnChances(championInst, clientInst)
					}
					else 
						returnChances(championInst, clientInst)
				})
			})
		})
	})

  champion.joinChampion = function (ctx, championId, clientId, callback) {
		champion.findById(championId, function(err, championInst) {
			if (err)
				return callback(err)
			championInst.clients(function(err, champClientsList) {
				if (err)
					return callback(err)
				if (Number(champClientsList.length) + 1 > Number(championInst.capacity))
					return callback(new Error('خطا! ظرفیت لیگ‌ خصوصی تکمیل است'))
				for (var i = 0; i < champClientsList.length; i++)
					if (champClientsList[i].id.toString() === clientId.toString())
						return callback(new Error('خطا! شما در حال حاضر در این لیگ خصوصی حضور دارید'))
				var client = app.models.client
				client.findById(clientId, function(err, clientInst) {
					if (err)
						return callback(err)
					if (Number(clientInst.accountInfoModel.chances) < Number(championInst.reduceChances))
						return callback(new Error('خطا! شما به اندازه کافی شانس برای پیوستن به این لیگ خصوصی ندارید'))
					championInst.clients.add(clientInst, function(err, result) {
						if (err)
							return callback(err)
						var newChances = Number(clientInst.accountInfoModel.chances) - Number(championInst.reduceChances)
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

  champion.remoteMethod('joinChampion', {
    description: 'join to a particular champion',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      },
      {
        arg: 'championId',
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
      path: '/:championId/joinChampion/:clientId',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
  })

  champion.kickUser = function (ctx, championId, clientId, callback) {
		champion.findById(championId, function(err, championInst) {
			if (err)
				return callback(err)
			if (ctx.req.accessToken.userId.toString() !== championInst.creatorId.toString())
				return callback(new Error('خطا! شما برای اخراج کاربر از این لیگ خصوصی دسترسی ندارید'))
			if (ctx.req.accessToken.userId.toString() === clientId.toString())
				return callback(new Error('خطا! سازنده لیگ خصوصی نمی‌تواند از آن اخراج شود'))
			var client = app.models.client
			client.findById(clientId, function(err, clientInst) {
				if (err)
					return callback(err)
				championInst.clients.remove(clientInst, function(err, result) {
					if (err)
						return callback(err)
					return callback(null, 'Successfuly Kicked')	
				})
			})
		})
  }

  champion.remoteMethod('kickUser', {
    description: 'join to a particular champion',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      },
      {
        arg: 'championId',
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
      path: '/:championId/kickUser/:clientId',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
	})
	
  champion.leaveChampion = function (ctx, championId, clientId, callback) {
		champion.findById(championId, function(err, championInst) {
			if (err)
				return callback(err)
			if (ctx.req.accessToken.userId.toString() === championInst.creatorId.toString())
				return callback(new Error('خطا! سازنده لیگ خصوصی نمی‌تواند از آن خارج شود'))
			var client = app.models.client
			client.findById(clientId, function(err, clientInst) {
				if (err)
					return callback(err)
				championInst.clients.remove(clientInst, function(err, result) {
					if (err)
						return callback(err)
					return callback(null, 'Successfuly Left')	
				})
			})
		})
  }

  champion.remoteMethod('leaveChampion', {
    description: 'user left from a particular champion',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      },
      {
        arg: 'championId',
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
      path: '/:championId/leaveChampion/:clientId',
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
