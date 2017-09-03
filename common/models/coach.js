module.exports = function(coach) {

	coach.find(function(err, coachList) {
		if (err)
			return console.error(err)
		for (var i = 0; i < coachList.length; i++) {
			var model = coachList[i]
			if (model.name.includes('-')) {
				var res = model.name.split(" - ")
				var newName = res[0]
				console.log(newName)
				// model.updateAttribute('name', newName, function (err) {
				// 	if (err)
				// 		console.error(err)
				// })
			}
			else {
				continue
			}
		}
	})

}
