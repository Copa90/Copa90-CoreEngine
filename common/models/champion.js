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
				ranking.find({where:{'leagueId': championInst.id.toString()}}, function(err, rankingList) {
					if (err)
						return console.error(err)
					if (rankingList.length == 1)
						return console.error('champion does not exist')
					var totalPoint = 0
					var totalPerson = []
					var personList = []
					for (var j = 0; j < rankingList.length; j++) {
						var rankModel = rankingList[j]
						totalPoint += Number(rankModel.points)
						if (totalPerson.indexOf(rankModel.clientId.toString()) <= -1)
							totalPerson.push(rankModel.clientId.toString())
					}
					totalPerson = personList.length
					var period = time - Number(championInst.beginningTime)
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
		client.findById(ctx.args.data.creatorId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (!clientInst)
				return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			if (ctx.args.data.capacity < 2)
				return next(new Error('خطا! ظرفیت لیگ خصوصی نباید کمتر از ۲ نفر باشد'))
			ctx.args.data.beginningTime = time
			ctx.args.data.hitRate = 0
			return next()
		})
	})

	champion.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		client.findById(modelInstance.creatorId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (!clientInst)
				return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			modelInstance.clients.add(clientInst, function(err, result) {
				if (err)
					return next(err)
				return next()					
			})
		})
	})

	champion.beforeRemote('replaceById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    roleManager.getRolesById(app, ctx.args.options.accessToken.userId.toString(), function (err, response) {
      if (err)
        return next(err)
      if (response.roles.length == 0) {
				champion.findById(ctx.req.params.id.toString(), function(err, championInst) {
					if (err)
						return next(err)
					if (!championInst)
						return callback(new Error('خطا! لیگ خصوصی با این کد وجود ندارد'))		
					if (ctx.args.options.accessToken.userId.toString() !== championInst.creatorId.toString())
						return next(new Error('خطا! شما برای اعمال تغییرات دسترسی ندارید'))
					var whiteList = ['name', 'capacity']
					if (!utility.inputChecker(ctx.args.data, whiteList))
						return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
					ctx.args.data.creatorId = championInst.creatorId.toString()
					if (Number(ctx.args.data.capacity) < 2)
						return next(new Error('خطا! ظرفیت لیگ خصوصی نباید کمتر از ۲ نفر باشد'))
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
				championModel.clients.destroyAll(function(err, result) {
					if (err)
						return next(err)
					return next()							
				})
			})
		}
		roleManager.getRolesById(app, ctx.args.options.accessToken.userId.toString(), function (err, response) {
      if (err)
				return next(err)
			champion.findById(ctx.req.params.id.toString(), function(err, championInst) {
				if (err)
					return next(err)
				if (!championInst)
					return callback(new Error('خطا! لیگ خصوصی با این کد وجود ندارد'))	
				var client = app.models.client
				client.findById(championInst.creatorId.toString(), function(err, clientInst) {
					if (err)
						return callback(err)
					if (!clientInst)
						return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))		
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
		champion.findById(championId.toString(), function(err, championInst) {
			if (err)
				return callback(err)
			if (!championInst)
				return callback(new Error('خطا! لیگ خصوصی با این کد وجود ندارد'))
			championInst.clients(function(err, champClientsList) {
				if (err)
					return callback(err)
				if (Number(champClientsList.length) + 1 > Number(championInst.capacity))
					return callback(new Error('خطا! ظرفیت لیگ‌ خصوصی تکمیل است'))
				for (var i = 0; i < champClientsList.length; i++)
					if (champClientsList[i].id.toString() === clientId.toString())
						return callback(new Error('خطا! شما در حال حاضر در این لیگ خصوصی حضور دارید'))
				var client = app.models.client
				client.findById(clientId.toString(), function(err, clientInst) {
					if (err)
						return callback(err)
					if (!clientInst)
						return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))		
					championInst.clients.add(clientInst, function(err, result) {
						if (err)
							return callback(err)
						return callback(null, 'Successfuly Joined')							
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
		champion.findById(championId.toString(), function(err, championInst) {
			if (err)
				return callback(err)
			if (!championInst)
				return callback(new Error('خطا! لیگ خصوصی با این کد وجود ندارد'))
			if (ctx.req.accessToken.userId.toString() !== championInst.creatorId.toString())
				return callback(new Error('خطا! شما برای اخراج کاربر از این لیگ خصوصی دسترسی ندارید'))
			if (ctx.req.accessToken.userId.toString() === clientId.toString())
				return callback(new Error('خطا! سازنده لیگ خصوصی نمی‌تواند از آن اخراج شود'))
			var client = app.models.client
			client.findById(clientId.toString(), function(err, clientInst) {
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
		champion.findById(championId.toString(), function(err, championInst) {
			if (err)
				return callback(err)
			if (!championInst)
				return callback(new Error('خطا! لیگ خصوصی با این کد وجود ندارد'))
			if (ctx.req.accessToken.userId.toString() === championInst.creatorId.toString())
				return callback(new Error('خطا! سازنده لیگ خصوصی نمی‌تواند از آن خارج شود'))
			var client = app.models.client
			client.findById(clientId.toString(), function(err, clientInst) {
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
