const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

const router = express.Router();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/callback",
        },
        (accessToken, refreshToken, profile, done) => {
            console.log("User Profile:", profile);
            return done(null, profile);
        }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth/failure" }),
    (req, res) => {
        res.send("Authentication Successful.");
    }
);

router.get("/failure", (req, res) => {
  res.send("Authentication Failed.");
});

module.exports = {
    router,
    authMiddleware: async (req, res, next) => {
        if (req.isAuthenticated()) {
          return next();
        }
        res.status(401).json({ message: "Unauthorized." });
    }
};