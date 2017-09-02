module.exports = function(coach) {

	coach.beforeRemote('create', function (ctx, modelInstance, next) {
		if(Object.prototype.toString.call(ctx.args.data) === '[object Array]') {
			var counter = 0
			for (var i = 0; i < ctx.args.data.length; i++) {
				var model = ctx.args.data[i]
				if (!model.teamId)
					return next()
				var name = model.team + ' - ' + model.name
				model.name = name
				counter++
				if (counter == ctx.args.data.length)
					return next()
			}
		}
		else {
			if (!ctx.args.data.teamId)
				return next()
			var name = ctx.args.data.team + ' - ' + ctx.args.data.name
			ctx.args.data.name = name
			return next()				
		}
	})

}
