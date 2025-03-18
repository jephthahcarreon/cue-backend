const express = require("express");
const createHandler = require("azure-function-express").createHandler;
const orderDAO = require("../common/database/dao/order-dao");
const { validateApiKey } = require("../common/middleware");
const utility = require("../common/utility");
const app = express();

const ORDER_API_KEY = process.env.ORDER_API_KEY;
app.use(validateApiKey(ORDER_API_KEY));;

app.get("/api/order/list", async(req, res) => {
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    req.context.log(`Get Order List: Status: ${status}, Start Date: ${startDate}, End Date: ${endDate}`);
    try {
        await utility.validator(require("../Order/get-order-list.schema.json"), req.body, req.context);
        const orders = await orderDAO.getOrderList(status, startDate, endDate, req.body.pageNumber, req.body.pageSize, req.context);
        res.status(200).json(orders);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

app.get("/api/order/details/:orderId", async(req, res) => {
    const orderId = req.params.orderId;
    req.context.log('Get Order Details: ', orderId);
    try {
        const orderDetails = await orderDAO.getOrderDetails(orderId, req.context);
        res.status(200).json(orderDetails);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

app.post("/api/order/create", async(req, res) => {
    req.context.log('Create Order');
    try {
        await utility.validator(require("../Order/create-order.schema.json"), req.body, req.context);
        const orderSummary = await orderDAO.createOrder(req.body.customerId, req.body.userId, req.body.items, req.context);
        res.status(200).json(orderSummary);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

module.exports = createHandler(app);