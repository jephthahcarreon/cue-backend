const express = require("express");
const rateLimit = require('express-rate-limit');
const helmet = require("helmet");
const createHandler = require("azure-function-express").createHandler;
const invoiceDAO = require("../common/database/dao/invoice-dao");
const { validateApiKey } = require("../common/middleware");
const utility = require("../common/utility");
const app = express();
const INVOICE_API_KEY = process.env.INVOICE_API_KEY

app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: "Too many requests, please try again later.",
    headers: true
}));
app.use(helmet());
app.use(validateApiKey(INVOICE_API_KEY));

app.post("/api/invoice/create", async(req, res) => {
    req.context.log('Create Invoce');
    try {
        await utility.validator(require("../Invoice/create-invoice.schema.json"), req.body, req.context);
        const invoiceSummary = await invoiceDAO.createInvoice(req.body.orderId, req.context);
        res.status(200).json(invoiceSummary);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

module.exports = createHandler(app);