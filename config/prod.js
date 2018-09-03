let dotenv = require("dotenv");
dotenv.load();
/* eslint-disable no-undef*/
module.exports = {
	cookieKey: process.env.COOKIE_KEY,
	jwtKey: process.env.JWT_KEY,
	mongoURI: process.env.MONGO_URI,
	redisHost: process.env.REDIS_HOST,
	redisPort: process.env.REDIS_PORT
	captchaSecretKey: process.env.CAPTCHA_SECRET_KEY,
};
