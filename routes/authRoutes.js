const Path = require("path-parser").default;
const { URL } = require("url");
const qrGenerator = require("../services/2fa");
const jwt = require("jsonwebtoken");
const keys = require("../config/keys");
const requireCaptcha = require("../middleware/requireCaptcha");
const request = require("request");
const { speakEasyVerifier } = require("../services/speakEasySecret");
const Mailer = require("../services/Mailer");
const mongoose = require("mongoose");
const User = mongoose.model("Users");
const verifyTemplate = require("../services/emailTemplates/verifyTemplates");
const passwordTemplate = require("../services/emailTemplates/passwordTemplates");
/* eslint-disable max-lines-per-function */
module.exports = (app, passport) => {

	app.post(
		"/login",
		requireCaptcha,
		passport.authenticate("local-login", { session: false }),
		(req, res) => {

			let currUser = {
				email: req.user.email,
				/* eslint-disable */
				id: req.user._id
				/* eslint-enable */
			};
			const token = jwt.sign(currUser, keys.jwtKey, {
				// define time here.
				expiresIn: 48 * 60 * 60
			});
			res.json({
				token,
				user: currUser
			});

		}
	);
	app.post(
		"/signup",
		requireCaptcha,
		passport.authenticate("local-signup", { session: false }),
		(req, res) => {

			const userId = req.user._id.toString();
			try {

				request.post({
					form: {
						emailVerificationKey: req.user.emailVerificationKey,
						userEmail: req.user.email,
						userId
					},
					url: `${keys.redirectClickUrl}/verifyEmail`
				});

			} catch (ex) {

				console.log("req exception in signup");
				res.json({ responseError: ex });

			}
			res.json({ success: true });

		}
	);
	app.post("/verify_2fa", (req, res) => {

		let userToken = req.body.googleToken;
		let secret = req.user.twofaSecret;

		var authObj = {
			encoding: "base32",
			secret,
			token: userToken
		};
		if (speakEasyVerifier(authObj)) {

			res.status(200).send("successful");

		} else {

			res.status(403).send("failed");

		}

	});
	app.get("/api/verifyemail/:userId/:hash", (req, res) => {

		res.send("Your email has been verified.");

	});
	app.get("/api/changePassword/:token", (req, res) => {

		try {

			let decoded = jwt.verify(req.params.token, keys.jwtKey);
			console.log(decoded);

		} catch (ex) {

			res.status(403).send({ responseError: "wrong jwt token." });

		}

	});
	/* eslint-disable max-statements,max-len*/
	app.post("/api/sendgrid/webhooks", async (req, res) => {

		if (req.body !== undefined || req.body[0].url !== undefined) {

			const url = req.body[0].url;

			const regEmailPath = new Path("/api/verifyemail/:userId/:hash");
			//const regPasswordPath = new Path("/api/changepassword/:hash");
			const matchEmail = regEmailPath.test(new URL(url).pathname);
			//const matchPassword = regPasswordPath.test(new URL(url).pathname);
			if (matchEmail) {

				let verifiedUser = await User.findOne({ _id: matchEmail.userId });
				if (verifiedUser.emailVerificationKey === matchEmail.hash) {

					verifiedUser.verified = true;
					verifiedUser.save();

				}

			}
			res.send({});

		}
		res.send({});

	});
	/* eslint-enable max-statements */
	app.post("/verifyEmail", async (req, res) => {

		const verifier = {
			body: "Please click the link below to complete registration.",
			dateSent: Date.now(),
			recipients: [req.body.userEmail],
			subject: "Action needed for your account at Binance",
			title: "Verify email for Binance."
		};

		const mailer = new Mailer(
			verifier,
			verifyTemplate(req.body.userId, req.body.emailVerificationKey)
		);
		try {

			await mailer.send();

		} catch (err) {

			console.log("error", err.response.body);
			res.status(422).send(err);

		}

	});
	/* eslint-disable max-statements*/
	app.post("/changepassword", async (req, res) => {

		const changer = {
			body: "Please click the link below to change your password.",
			dateSent: Date.now(),
			recipients: [req.body.userEmail],
			subject: "Action needed for your account at Binance",
			title: "Password change request for your account on Binance."
		};
		const currUser = await User.findOne({ email: req.body.userEmail });
		if (currUser === undefined || currUser === null) {

			return res.status(404).send({ responseError: "user does not exist" });

		}
		const token = jwt.sign({ currUser: currUser._id.toString() }, keys.jwtKey, {
			// define time here.
			expiresIn: 48 * 60 * 60
		});
		const mailer = new Mailer(changer, passwordTemplate(token));
		try {

			await mailer.send();
			res.status(200).send({ response: "reset password mail sent." });

		} catch (err) {

			console.log("error", err.response.body);
			res.status(422).send(err);

		}

	});
	app.get(
		"/get_twofaqr",
		passport.authenticate("jwt", { session: false }),
		requireCaptcha,
		(req, res) => {

			qrGenerator(
				req.user.otpAuthUrl,
				req.user.twofaSecret,
				(err, imgsrc, otpAuthSecretKey) => {

					if (err) {

						res.sendStatus(500).send("error");

					}
					res.send({
						imgsrc,
						otpAuthSecretKey
					});

				}
			);

		}
	);

};
