// src/models/index.js

const sequelize  = require("../database");
const Tenant     = require("./Tenant");
const ApiKey     = require("./ApiKey");
const Template   = require("./Template");
const MessageLog = require("./MessageLog");

module.exports = { sequelize, Tenant, ApiKey, Template, MessageLog };
