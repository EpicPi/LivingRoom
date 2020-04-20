const env = 'production'

//insert your API Key & Secret for each environment, keep this file local and never push it to a public repo for security purposes.
const config = {
	development :{
		ZoomApiKey : '',
        ZoomApiSecret : '',
        TwilioSID: '',
        TwilioToken: ''
	},
	production:{	
		ZoomApiKey : '',
        ZoomApiSecret : '',
        TwilioSID: '',
        TwilioToken: ''
	}
};

module.exports = config[env]