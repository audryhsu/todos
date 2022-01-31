const config = require("./config")
const { Client } = require('pg');

const logQuery = (statement, parameters) => {
  let timeStamp = new Date();
  let formattedTimeStamp = timeStamp.toString().substring(4, 24)
  console.log(">> ", formattedTimeStamp, statement, parameters);
};

const isProduction = (config.NODE_ENV === "production"); // check environment variable from Heroku
const CONNECTION = {
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
};

module.exports = {
  async dbQuery(queryText, ...parameters) {
    let client = new Client(CONNECTION);

    await client.connect();
    logQuery(queryText, parameters);
    let result = await client.query(queryText, parameters); // client.query method takes a list of parameter values as second arg
    await client.end();

    return result;
  }
};
