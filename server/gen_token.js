require('dotenv').config({ override: true });
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "test-secret";
const token = jwt.sign({ id: 1, email: "test@example.com", username: "sysadmin", role: "admin" }, secret, { expiresIn: "10y" });
console.log("GENERATED_TOKEN=" + token);
