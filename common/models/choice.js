var app = require('../../server/server')

var utility	= require('../../public/utility')

var statusConfig = require('../../config/choiceStatus.json')
var choicePriorityConfig = require('../../config/choicePriority.json')
var exactStatusConfig = require('../../config/exactStatus.json')

module.exports = function(choice) {

  choice.beforeRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var exact = app.models.exact
		if (!ctx.args.data.firstOption || !ctx.args.data.secondOption || !ctx.args.data.thirdOption)
			return next(new Error('خطا! شما حتما باید یک انتخاب داشته باشید'))
		var totalCount = 0
		if (ctx.args.data.firstOption.choice)
			totalCount++
		if (ctx.args.data.secondOption.choice)
			totalCount++
		if (ctx.args.data.thirdOption.choice)
			totalCount++
		client.findById(ctx.args.data.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (Number(clientInst.accountInfoModel.chances) <= 0)
				return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی تمام شده‌است'))
			if (Number(clientInst.accountInfoModel.chances) < totalCount)
				return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی کافی‌ نیست'))
			exact.findById(ctx.args.data.exactId.toString(), function(err, exactInst) {
				if (err)
					return next(err)
				var time = utility.getUnixTimeStamp()
				if (!(exactInst.status === exactStatusConfig.working))
					return next(new Error('خطا! این پیش‌بینی دقیق دیگر باز نیست'))
				if (!(time >= Number(exactInst.beginningTime) && time <= Number(exactInst.endingTime)))
					return next(new Error('خطا! دوره زمانی این پیش‌بینی دقیق تمام شده‌است'))
				exactInst.leagueRel(function(err, leagueInst) {
					if (err)
						return next(err)
					exactInst.choices({'clientId': ctx.args.data.clientId}, function(err, userExactChoices) {
						if (err)
							return next(err)
						if (userExactChoices.length == 0) {
							if (!ctx.args.data.firstOption)
								return next (new Error('خطا! شما حتما باید اولین انتخاب خود را پر کنید'))
							if (ctx.args.data.firstOption && !ctx.args.data.secondOption && ctx.args.data.thirdOption)
								return next (new Error('خطا! شما حتما باید دومین انتخاب خود را پر کنید'))
							ctx.args.data.status = statusConfig.open
							ctx.args.data.topic = exactInst.topic
							ctx.args.data.leagueName = leagueInst.name
							for (var i = 0; i < exactInst.selectors.length; i++) {
								var model = exactInst.selectors[i]
								if (ctx.args.data.firstOption.choice && model["priority"] === choicePriorityConfig.high) {
									ctx.args.data.firstOption.point = Number(model.point)
									ctx.args.data.firstOption.status = statusConfig.open
								}
								if (ctx.args.data.secondOption.choice && model["priority"] === choicePriorityConfig.average) {
									ctx.args.data.secondOption.point = Number(model.point)
									ctx.args.data.secondOption.status = statusConfig.open
								}
								if (ctx.args.data.thirdOption.choice && model["priority"] === choicePriorityConfig.low) {
									ctx.args.data.thirdOption.point = Number(model.point)
									ctx.args.data.thirdOption.status = statusConfig.open
								}
							}			
							return next()		
						}
						else 
							return next(new Error('خطا! شما در حال حالضر یک مدل انتخاب برای این پیش‌بینی دقیق دارید'))
					})	
				})
			})
		})
	})

  choice.beforeRemote('replaceById', function (ctx, modelInstance, next) {
		choice.findById(ctx.args.data.id.toString(), function(err, choiceInst) {
			if (err)
				return next(err)
			var client = app.models.client
			var exact = app.models.exact
			client.findById(choiceInst.clientId.toString(), function(err, clientInst) {
				if (err)
					return next(err)
				exact.findById(choiceInst.exactId.toString(), function(err, exactInst) {
					if (err)
						return next(err)
					var time = utility.getUnixTimeStamp()
					if (!(exactInst.status === exactStatusConfig.working))
						return next(new Error('خطا! این پیش‌بینی دقیق دیگر باز نیست'))
					if (!(time >= Number(exactInst.beginningTime) && time <= Number(exactInst.endingTime)))
						return next(new Error('خطا! دوره زمانی این پیش‌بینی دقیق تمام شده‌است'))
	
					if (choiceInst.firstOption.choice && choiceInst.secondOption.choice && choiceInst.thirdOption.choice)
						return next(new Error('خطا! شما انتخاب دیگری نمیتوانید برای این پیش‌بینی دقیق انجام دهید'))

					var totalCount = 0
					if (choiceInst.firstOption.choice) {
						if (choiceInst.firstOption.choice !== ctx.args.firstOption.choice)
							return next(new Error('خطا! شما نمیتوانید انتخاب اول خود را تغییر دهید'))
					}
					if (choiceInst.secondOption.choice) {
						if (choiceInst.secondOption.choice !== ctx.args.secondOption.choice)
							return next(new Error('خطا! شما نمیتوانید انتخاب دوم خود را تغییر دهید'))
						else
							ctx.argd.data.secondOption.byEdit = false
					}
					else {
						if (ctx.args.secondOption.choice) {
							totalCount++							
							for (var i = 0; i < exactInst.selectors.length; i++) {
								var model = exactInst.selectors[i]
								if (ctx.args.data.secondOption.choice && model["priority"] === choicePriorityConfig.average) {
									ctx.args.data.secondOption.point = Number(model.point)
									ctx.args.data.secondOption.status = statusConfig.open
									ctx.argd.data.secondOption.byEdit = true
								}
							}			
						}
					}
					if (choiceInst.thirdOption.choice) {
						if (choiceInst.thirdOption.choice !== ctx.args.thirdOption.choice)
							return next(new Error('خطا! شما نمیتوانید انتخاب سوم خود را تغییر دهید'))
						else 
							ctx.argd.data.thirdOption.byEdit = false
					}
					else {
						if (ctx.args.thirdOption.choice) {
							totalCount++							
							for (var i = 0; i < exactInst.selectors.length; i++) {
								var model = exactInst.selectors[i]
								if (ctx.args.data.thirdOption.choice && model["priority"] === choicePriorityConfig.low) {
									ctx.args.data.thirdOption.point = Number(model.point)
									ctx.args.data.thirdOption.status = statusConfig.open
									ctx.argd.data.thirdOption.byEdit = true
								}
							}			
						}
					}

					if (Number(clientInst.accountInfoModel.chances) <= 0)
						return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی تمام شده‌است'))
					if (Number(clientInst.accountInfoModel.chances) < totalCount)
						return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی کافی‌ نیست'))			

					return next()
				})
			})			
		})
	})

  choice.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var exact = app.models.exact
		client.findById(modelInstance.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			exact.findById(modelInstance.exactId.toString(), function(err, exactInst) {
				if (err)
					return next(err)
				var totalCount = 0
				if (modelInstance.firstOption.choice)
					totalCount++
				if (modelInstance.secondOption.choice)
					totalCount++
				if (modelInstance.thirdOption.choice)
					totalCount++
				var newChances = Number(clientInst.accountInfoModel.chances) - totalCount
				var newTotalChoices = Number(clientInst.accountInfoModel.totalChoices) + totalCount
				clientInst.accountInfo.update({'chances': newChances, 'totalChoices': newTotalChoices}, function(err, instance) {
					if (err)
						return next(err)
					modelInstance.clientRel(clientInst)
					modelInstance.exactRel(exactInst)
					return next()					
				})
			})
		})
	})

  choice.afterRemote('replaceById', function (ctx, modelInstance, next) {
		var client = app.models.client
		var exact = app.models.exact
		client.findById(modelInstance.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			exact.findById(modelInstance.exactId.toString(), function(err, exactInst) {
				if (err)
					return next(err)
				var totalCount = 0
				if (modelInstance.firstOption.choice && modelInstance.firstOption.byEdit)
					totalCount++
				if (modelInstance.secondOption.choice && modelInstance.firstOption.byEdit)
					totalCount++
				if (modelInstance.thirdOption.choice && modelInstance.firstOption.byEdit)
					totalCount++
				var newChances = Number(clientInst.accountInfoModel.chances) - totalCount
				var newTotalChoices = Number(clientInst.accountInfoModel.totalChoices) + totalCount
				clientInst.accountInfo.update({'chances': newChances, 'totalChoices': newTotalChoices}, function(err, instance) {
					if (err)
						return next(err)
					return next()					
				})
			})
		})
	})

}
