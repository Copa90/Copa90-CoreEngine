var app = require('../../server/server')
var roleManager = require('../../public/roleManager')

var utility	= require('../../public/utility')

module.exports = function(champion) {

	champion.beforeRemote('create', function (ctx, modelInstance, next) {
		var time = utility.getUnixTimeStamp()
		var client = app.models.client
		client.findById(ctx.args.data.creatorId, function(err, clientInst) {
			if (err)
				return next(err)
			if (clientInst.accountInfo.chances < ctx.args.data.reduceChances)
				return next(new Error('You Do not Have That Propper Chances!'))
			if (ctx.args.data.capacity < 3)
				return next(new Error('Capacity Can not be Less than 3!'))
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
					if (ctx.args.data.capacity < 3)
						return next(new Error('Capacity Can not be Less than 3!'))
					return next()
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
      verb: 'GET',
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
