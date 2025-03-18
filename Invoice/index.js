const express = require("express");
const session = require("express-session");
const passport = require("passport");
const createHandler = require("azure-function-express").createHandler;
const invoiceDAO = require("../common/database/dao/invoice-dao");
const { authRoutes, authMiddleware } = require("../common/authentication");
const utility = require("../common/utility");
const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true 
}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/auth", authRoutes);

app.post("/api/invoice/create", authMiddleware, async(req, res) => {
    req.context.log('Create Order');
    try {
        await utility.validator(require("../Invoice/create-invoice.schema.json"), req.body, req.context);
        const invoiceSummary = await invoiceDAO.createInvoice(req.body.orderId, req.context);
        res.status(200).json(invoiceSummary);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

module.exports = createHandler(app);