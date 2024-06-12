const express = require("express");
const router = express.Router();
// const limiter = require("../index");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "../.env" });
const secretKey = process.env.SECRET_KEY;
const Admin = require("../Models/Admin");

// Function for comparing admin password with the entered given password
const comparePassword = async (admin, password) => {
  try {
    let originalPass = admin.password;

    return await bcrypt.compare(password, originalPass);
  } catch (error) {
    console.log(`Error in Compare Password Function ${error}`);
  }
};

// Function for getting jwt security web token
const getSignedJwt = (admin) => {
  try {
    const data = {
      admin: admin._id,
    };

    const jwtToken = jwt.sign(data, secretKey);
    return jwtToken;
  } catch (error) {
    console.log(`Error In Getting JWT Token : ${error}`);
  }
};

// ROUTE:1
// POST REQUEST:
// Verifying if admin exists and email and password is correct
router.post(
  "/verifyadmin",
  // Validation array
  [
    body("email", "Invalid email").isEmail(),
  ],
  async (req, res) => {
    // Validation check
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { email, password } = req.body;

    try {
      // Checking if an admin exists with that email
      let isAdmin = await Admin.findOne({ email });
      if (!isAdmin) {
        return res
          .status(400)
          .json({ msg: "No admin exists with this email." });
      }
      // Validating password
      const validPass = await comparePassword(isAdmin, password);
      if (!validPass) {
        return res.status(400).json({ msg: "Incorrect Password!" });
      }
      // Sending the token to client side
      res.status(200).json({ token: getSignedJwt(isAdmin) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

module.exports = router;
