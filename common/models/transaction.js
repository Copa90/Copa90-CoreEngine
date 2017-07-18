var app = require('../../server/server')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/transactionStatus.json')

module.exports = function(transaction) {
	
  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	transaction.validatesInclusionOf('status', {in: statusList})

  transaction.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var package = app.models.package
		client.findById(ctx.args.data.clientId, function(err, clientInst) {
			if (err)
				return next(err)
			package.findById(ctx.args.data.packageId, function(err, packageInst) {
				if (err)
					return next(err)
				var newChances = client.accountInfoModel.chances + packageInst.chances
				clientInst.accountInfo.update({'chances': newChances}, function(err, instance) {
					if (err)
						return next(err)
					modelInstance.clientRel(clientInst)
					modelInstance.packageRel(packageInst)
					return next()					
				})
			})
		})
	})
}
