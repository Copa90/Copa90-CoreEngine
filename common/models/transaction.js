var utility	= require('../../public/utility')
var statusConfig = require('../../config/transactionStatus.json')

module.exports = function(transaction) {
	
  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	transaction.validatesInclusionOf('status', {in: statusList})

  transaction.beforeRemote('create', function (ctx, modelInstance, next) {
		ctx.args.data.clientId = ctx.args.options.accessToken.userId
    return next()
  })	
}
