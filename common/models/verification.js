var statusConfig = require('../../config/verificationStatus.json')

module.exports = function(verification) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	verification.validatesInclusionOf('status', {in: statusList})

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
					return callback(null, result)
				})
			}
			else if (result.status === statusConfig.verified)
				return callback(null, 'already verified')
			else {
				result.updateAttribute('verificationNumber', verification, function(err, result) {
					if (err)
						return callback(err, null)
					return callback(null, result)
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

  }

  verification.remoteMethod('verification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'query'
      },
    }, {
      arg: 'verifyNumber',
      type: 'string',
      http: {
        source: 'query'
      },
    }],
    description: 'send verification sms to user',
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
      },
    }],
    description: 'send verification sms to user',
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

}
