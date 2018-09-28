var bcrypt = require("bcrypt");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const passportJWT = require("passport-jwt");
const JWTStrategy = passportJWT.Strategy;
const uuidv4 = require("uuid/v4");
const ExtractJWT = passportJWT.ExtractJwt;
const mongoose = require("mongoose");
const { speakEasyValueGenerator } = require("./speakEasySecret");
const keys = require("../config/keys");
const saltRounds = 10;
const User = mongoose.model("Users");
passport.use(new JWTStrategy(
	{
		jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
		secretOrKey: keys.jwtKey
	},
	async (jwtPayload, done) => {

		try {

			const user = await User.findOne({ _id: jwtPayload.id });

			if (user) {
				return done(null, user);

			}

			return done(null, false);

		} catch (err) {

			done(err, null);

		}

	}
));
export const token = ({ required, roles = ['user', 'admin'] } = {}) => (
	req,
	res,
	next
) => passport.authenticate("jwt", { session: false }, (err, user, info) => {

	if (
		err ||
			required && !user ||
			required && !~roles.indexOf(user.role)
	) {

		return res.status(401).end();

	}
	req.logIn(user, { session: false }, (err) => {

		if (err) {

			return res.status(401).end();

		}
		next();

	});

})(req, res, next);
passport.use(
	"local-signup",
	new LocalStrategy(
		{
			passReqToCallback: true,
			passwordField: "password",
			usernameField: "email"
		},
		/* eslint-disable max-params */

		async (req, email, password, done) => {
				
			try {
				try{
					if(typeof req.body==="undefined"||typeof req.body.email==="undefined"||typeof req.body.password==="undefined"||typeof req.body.role==="undefined")
					return done(null,null);
					
					if(req.body.role!=="admin"&&req.body.role!=="user")
					return done(null,null);
					
				}
				catch(ex)
				{					
					return done(null,null)
				}
				const existingUser = await User.findOne({ email });
				if (existingUser) {

					return done(null, false);

				}
				bcrypt.hash(password, saltRounds, async (err, hash) => {

					if (err) {

						return done(err, null);

					}
					let speakEasyObj = speakEasyValueGenerator(email);
					const emailVerificationKey = uuidv4();
					let newUser = {
						email,
						emailVerificationKey,
						role:req.body.role,
						otpAuthUrl: speakEasyObj.otpAuthURL,
						password: hash,
						twofaSecret: speakEasyObj.value,
						verified: false
					};
					return done(null, await new User(newUser).save());

				});

			} catch (err) {

				return done(err, null);

			}

		}
	)
);

passport.use(
	"local-login",
	new LocalStrategy(
		{
			passReqToCallback: true,
			passwordField: "password",
			usernameField: "email"
		},
		async (req, email, password, done) => {

			try {

				const existingUser = await User.findOne({ email });
				
				if (existingUser) {
					console.log(process.env.NODE_ENV)
					if (process.env.NODE_ENV==='production'&&!existingUser.verified) {

						return done(null, false);

					}
					bcrypt.compare(password, existingUser.password, (err, res) => {

						if (err) {

							return done(err, null);

						}
						if (!res) {

							return done(null, false);

						}

						return done(null, existingUser);

					});

				} else {

					return done(null, false);

				}

			} catch (err) {

				done(err, null);

			}

		}
	)
);
