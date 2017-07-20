var request = require('request')

function getRequest(url, callback) {
  request.get(url)
    .on('data', function (data) {
      callback(null, JSON.parse(data))
    })
    .on('error', function (err) {
      console.log(err)
      callback(err, null)
    })
}

module.exports = function (trophy) {

	var baseURL = 'http://res.cloudinary.com/dqyiaeoz1/image/upload'

	var farFarColor = 'e_colorize,co_rgb:010101'
	var farColor = 'e_colorize,co_rgb:212121'
	var nameColor = 'e_colorize,co_rgb:313131'

	var rankingFont = ',l_text:BHoma.ttf_50:'
	var namaeFont = ',l_text:BHoma.ttf_100:'

	var rankPosition = ',g_north_east,y_#,x_@'

  trophy.leagueRanking = function (imageName, username, rankings, cb) {
		var str = baseURL

  }

	var infoColor = 'e_colorize,co_rgb:212121'
	var nameColor = 'e_colorize,co_rgb:313131'

	var namaeFont = ',l_text:BHoma.ttf_100:'

	var rankPosition = ',g_north_east,y_#,x_@'

  trophy.userStats = function (imageName, username, information, cb) {
		var str = baseURL

  }

}
