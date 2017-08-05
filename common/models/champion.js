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
					var totalPerson = 0
					var personList = []
					for (var j = 0; j < rankingList.length; j++) {
						totalPoint += rankingList[j].points
						if (totalPerson.indexOf(rankingList[j].clientId) <= -1)
							totalPerson.push(rankingList[j].clientId)
					}
					totalPerson = personList.length
					var period = time - champion.beginningTime
					
					var hitRate = totalPoint / (period * totalPerson) * 1000000
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
			if (clientInst.accountInfo.chances < ctx.args.data.reduceChances)
				return next(new Error('You Do not Have That Propper Chances!'))
			if (ctx.args.data.capacity < 5)
				return next(new Error('Capacity Can not be Less than 5!'))
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
				var newChances = clientInst.accountInfoModel.chances - modelInstance.reduceChances
				clientInst.accountInfo.update({'chances': newChances}, function(err, result) {
					if (err)
						return next(err)
					return next()					
				})
			})
		})
	})

	champion.beforeRemote('updateById', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    roleManager.getRolesById(app, ctx.args.options.accessToken.userId, function (err, response) {
      if (err)
        return next(err)
      if (response.roles.length == 0) {
				champion.findById(ctx.args.data.id, function(err, championInst) {
					if (err)
						return next(err)
					if (ctx.args.options.accessToken.userId !== championInst.creatorId)
						return next(new Error('You have not Access to Cahmapion!'))
					var whiteList = ['name', 'capacity', 'reduceChances']
					if (!utility.inputChecker(ctx.args.data, whiteList))
						return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
					if (ctx.args.data.capacity < 5)
						return next(new Error('Capacity Can not be Less than 5!'))
					championInst.clients(function(err, champClientsList) {
						if (err)
							return next(err)
						if (ctx.args.data.capacity < champClientsList.length)
							return next(new Error('Capacity Can not be Less than Current Champion Size!'))
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
					var newChances = clientModel.accountInfoModel.chances + championModel.reduceChances
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
			champion.findById(ctx.args.data.id, function(err, championInst) {
				if (err)
					return next(err)
				var client = app.models.client
				client.findById(championInst.creatorId, function(err, clientInst) {
					if (err)
						return callback(err)
					if (response.roles.length == 0) {
						if (ctx.args.options.accessToken.userId !== championInst.creatorId)
							return next(new Error('You have not Access to Champion!'))							
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
				if (champClientsList.length + 1 > championInst.capacity)
					return callback(new Error('Capacity is Full'))
				for (var i = 0; i < champClientsList.length; i++)
					if (champClientsList[i].id === clientId)
						return callback(new Error('Already Within'))
				var client = app.models.client
				client.findById(clientId, function(err, clientInst) {
					if (err)
						return callback(err)
					if (clientInst.accountInfoModel.chances < championInst.reduceChances)
						return callback(new Error('Not Enough Chances to Join'))
					championInst.clients.add(clientInst, function(err, result) {
						if (err)
							return callback(err)
						var newChances = clientInst.accountInfoModel.chances - championInst.reduceChances
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
			if (ctx.req.accessToken.userId !== championInst.creatorId)
				return callback(new Error('Owner Error'))
			if (ctx.req.accessToken.userId === clientId)
				return callback(new Error('Owner Can not be Kicked'))
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
			if (ctx.req.accessToken.userId === clientId)
				return callback(new Error('Owner Can not left'))
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
