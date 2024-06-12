const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWTSecretKey = process.env.SECRET_KEY;

const authMiddleware = (req, res, next) =>{
    const token = req.header("auth-token");
    if (!token) {
        return res.status(401).send("No token provided");
    }
    try {
        const data = jwt.verify(token, JWTSecretKey);
        req.user = data.user;
        next();
    } catch (err) {
        console.log(err)
        return res.status(401).send("Token is not valid");
    }
}

module.exports = authMiddleware;