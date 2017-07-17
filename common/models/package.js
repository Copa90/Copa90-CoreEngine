var cron = require('cron')
var app = require('../../server/server')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/packageStatus.json')
var offerConfig = require('../../config/packageOffer.json')

module.exports = function(package) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

  var offerList = []
  for (var key in offerConfig) 
    offerList.push(offerConfig[key])

	package.validatesInclusionOf('status', {in: statusList})
	package.validatesInclusionOf('offer', {in: offerList})

	var startPackages = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		package.find({
			where: {
				'status': statusConfig.created
			}
		}, function (err, packageList) {
			if (err)
				console.error(err)
			for (var i = 0; i < packageList.length; i++) {
				if (packageList[i].beginningTime <= time && packageList[i].endingTime >= time) {
					packageList[i].updateAttribute('status', statusConfig.working, function (err, packageInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	var finishPackages = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		package.find({
			where: {
				'status': statusConfig.working
			}
		}, function (err, packageList) {
			if (err)
				console.error(err)
			for (var i = 0; i < packageList.length; i++) {
				if (packageList[i].endingTime <= time) {
					packageList[i].updateAttribute('status', statusConfig.finished, function (err, packageInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	startPackages.start()
	finishPackages.start()

  package.beforeRemote('create', function (ctx, modelInstance, next) {
    var whiteList = ['name', 'beginningTime', 'endingTime', 'chances', 'offer', 'explanation']
    if (!utility.inputChecker(ctx.args.data, whiteList))
      return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
		var time = utility.getUnixTimeStamp()
		if (ctx.args.data.beginningTime && ctx.args.data.endingTime)
			if (ctx.args.data.beginningTime < time || ctx.args.data.endingTime < time || ctx.args.data.beginningTime > ctx.args.data.endingTime)
				return next(new Error('Error in BeginningTime and EndingTime Date Times'))
		ctx.args.data.status = statusConfig.created
    return next()
  })

  package.beforeRemote('replaceById', function (ctx, modelInstance, next) {
    var whiteList = ['name', 'beginningTime', 'endingTime', 'chances', 'offer', 'explanation', 'status']
    if (!utility.inputChecker(ctx.args.data, whiteList))
      return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
		var time = utility.getUnixTimeStamp() - 300000
		if ((ctx.args.data.beginningTime) && !(ctx.args.data.beginningTime >= time))
			return next(new Error('Error in BeginningTime Date Times'))
		if ((ctx.args.data.endingTime) && !(ctx.args.data.endingTime >= time))
			return next(new Error('Error in EndingTime Date Times'))
    return next()
  })
	
}
