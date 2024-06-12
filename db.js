const mongoose = require('mongoose');

async function connectToDB(connectionURI) {
    try {
        await mongoose.connect(connectionURI);
    } catch (error) {
        console.error(error)
    }
  

  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}

module.exports = connectToDB;