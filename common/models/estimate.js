var app = require('../../server/server')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/estimateStatus.json')
var predictStatusConfig = require('../../config/predictStatus.json')

module.exports = function(estimate) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	estimate.validatesInclusionOf('status', {in: statusList})

  estimate.beforeRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var predict = app.models.predict
		client.findById(ctx.args.data.clientId, function(err, clientInst) {
			if (err)
				return next(err)
			if (clientInst.accountInfoModel.chances <= 0)
				return next(new Error('Your Chance is Over!'))
			predict.findById(ctx.args.data.predictId, function(err, predictInst) {
				if (err)
					return next(err)
				var time = utility.getUnixTimeStamp()
				if (!(predictInst.status === predictStatusConfig.working))
					return next(new Error('Prediction is not Woking!'))
				if (!(time >= predictInst.beginningTime && time <= predictInst.endingTime))
					return next(new Error('Estimate on This Prediction is Over!'))
				ctx.args.data.status = statusConfig.open
				ctx.args.data.point = Number(predictInst.point)
				return next()	
			})
		})
	})

  estimate.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var predict = app.models.predict
		client.findById(modelInstance.clientId, function(err, clientInst) {
			if (err)
				return next(err)
			predict.findById(modelInstance.predictId, function(err, predictInst) {
				if (err)
					return next(err)
				var newChances = clientInst.accountInfoModel.chances - 1
				var newTotalEstimates = clientInst.accountInfoModel.totalEstimates + 1
				clientInst.accountInfo.update({'chances': newChances, 'totalEstimates': newTotalEstimates}, function(err, instance) {
					if (err)
						return next(err)
					modelInstance.clientRel(clientInst)
					modelInstance.predictRel(predictInst)
					return next()					
				})
			})
		})
	})
}
