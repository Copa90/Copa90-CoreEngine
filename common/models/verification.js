var utility	= require('../../public/utility')

var statusConfig = require('../../config/verificationStatus.json')

var request = require('request')

function requestToBackend(url, verb, payload, callback) {
  var options = {
    method: verb,
    url: url,
    preambleCRLF: true,
    postambleCRLF: true,
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify(payload)
  }

  request(options, function (error, response, body) {
    if (error || response.statusCode >= 400)
      return callback(error, null)
    return callback(null, JSON.parse(body))
  })
}

function postRequest (url, body, callback) {
	requestToBackend(url, 'POST', body, function (err, result) {
		if (err)
			return callback(err, null) 
		return callback(null, result)
	})
}

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

module.exports = function(verification) {

	var baseURL = 'https://api.kavenegar.com/v1/@/verify/lookup.json'
	var token = '33434D58303256744D72316F674A54755734616176413D3D	'

	var begURL = baseURL.replace('@', token)

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	verification.validatesInclusionOf('status', {in: statusList})

	function getRandomInt(min, max) {
		min = Math.ceil(min)
		max = Math.floor(max)
		return Math.floor(Math.random() * (max - min)) + min
	}

	function sendSMS(phoneNumber, randNumb, callback) {
		var data = {
			'receptor': phoneNumber,
			'token': sendVerificationAlgorithm,
			'template': 'VerificationNo1'
		}

		var url = begURL + '?' + utility.generateQueryString(data)

		getRequest(url, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}

	function sendPasswordSMS(phoneNumber, message, callback) {
		var base = 'https://api.kavenegar.com/v1/@/sms/send.json'
		var beg = base.replace('@', token)
		var data = {
			'receptor': phoneNumber,
			'message': message
		}

		var url = beg + '?' + utility.generateQueryString(data)

		getRequest(url, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}
	
	function checkExistance(phoneNumber, callback) {
		verification.find({'where':{'phoneNumber': phoneNumber}}, function(err, result) {
			if (err)
				return callback(err, null)
			if (result.length <= 0)
				return callback(null, null)
			else
				return callback(null, result[0])
		})
	}

	function sendVerificationAlgorithm(phoneNumber, verification, callback) {
		checkExistance(phoneNumber, function(err, result) {
			if (err)
				return callback(err, null)
			if (!result) {
				createVerification(phoneNumber, verification, function(err, result) {
					if (err)
						return callback(err, null)
					sendSMS(phoneNumber, verification, function(err, result) {
						if (err)
							return callback(err, null)
						return callback(null, result)
					})
				})
			}
			else if (result.status === statusConfig.verified)
				return callback(null, 'already verified')
			else {
				result.updateAttribute('verificationNumber', verification, function(err, result) {
					if (err)
						return callback(err, null)
					sendSMS(phoneNumber, verification, function(err, result) {
						if (err)
							return callback(err, null)
						return callback(null, result)
					})
				})
			}
		})
	}

	function createVerification(phoneNumber, verification, callback) {
		verification.create({'phoneNumber': phoneNumber, 'verificationNumber': verification, 'status': statusConfig.pending}, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}

	function doVerificationAlgorithm(phoneNumber, verification, callback) {
		checkExistance(phoneNumber, function(err, result) {
			if (err)
				return callback(err, null)
			if (!result) 
				return callback(null, 'should start')
			else if (result.status === statusConfig.verified)
				return callback(null, 'already verified')
			else {
				if (result.verificationNumber === verification) {
					result.updateAttribute('status', statusConfig.verified, function(err, result) {
						if (err)
							return callback(err, null)
						return callback(null, result)
					})					
				}
			}
		})
	}

  verification.sendVerification = function (phoneNumber, cb) {
		var rand = getRandomInt(1250, 9999)
		sendVerificationAlgorithm(phoneNumber, rand, function(err, response) {
			if (err)
				return callback(err, null)
			return callback(null, response)
		})
  }

  verification.remoteMethod('sendVerification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'send verification sms to user',
    http: {
      path: '/sendVerification/:phoneNumber',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'string',
      root: true
    }
  })

  verification.verification = function (phoneNumber, verifyNumber, cb) {
		doVerificationAlgorithm(phoneNumber, verifyNumber, function(err, response) {
			if (err)
				return callback(err, null)
			return callback(null, response)			
		})
  }

  verification.remoteMethod('verification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'verifyNumber',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'verify user phone number by sent verification number',
    http: {
      path: '/verification/:phoneNumber/:verifyNumber',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'string',
      root: true
    }
  })

	verification.checkUserVerification = function (phoneNumber, cb) {
		checkExistance(phoneNumber, function(err, result) {
			if (err)
				return callback(err, null)
			if (!result)
				return callback(null, false)
			else {
				if (result.status === statusConfig.pending)
					return callback(null, false)
				else if (result.status === statusConfig.verified)
					return callback(null, true)
			}
		})
  }

  verification.remoteMethod('checkUserVerification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'check user verification latest status',
    http: {
      path: '/checkUserVerification/:phoneNumber',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'Boolean',
      root: true
    }
  })

	verification.sendPassword = function(phoneNumber, password, callback) {
		var string = 'پسورد شما در کوپا۹۰:' + '\n' + password
		sendPasswordSMS(phoneNumber, string, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)			
		})
	}

}
