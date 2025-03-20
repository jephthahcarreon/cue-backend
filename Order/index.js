const express = require("express");
const Redis = require("ioredis");
const rateLimit = require('express-rate-limit');
const helmet = require("helmet");
const createHandler = require("azure-function-express").createHandler;
const orderDAO = require("../common/database/dao/order-dao");
const { validateApiKey } = require("../common/middleware");
const utility = require("../common/utility");
const authorization = require("../common/authorization");
const constants = require("../common/constants");
const app = express();
const redis = new Redis();
const ORDER_API_KEY = process.env.ORDER_API_KEY;

app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: "Too many requests, please try again later.",
    headers: true
}));
app.use(helmet());
app.use(validateApiKey(ORDER_API_KEY));

app.get("/api/order/list", async(req, res) => {
    const cacheDataKey = "orders";
    const cachePaginationKey = "orderPagination";
    const cachedData = await redis.get(cacheDataKey);
    const cachedPagination = await redis.get(cachePaginationKey);
    const paginationOptions = JSON.stringify({ pageNumber: req.body.pageNumber, pageSize: req.body.pageSize});
    if (cachedData && cachedPagination === paginationOptions) {
        req.context.log("Returning cached Orders data from Redis.");
        return res.status(200).json(JSON.parse(cachedData));
    }
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    req.context.log(`Get Order List: Status: ${status}, Start Date: ${startDate}, End Date: ${endDate}`);
    try {
        await utility.validator(require("../Order/get-order-list.schema.json"), req.body, req.context);
        const orders = await orderDAO.getOrderList(status, startDate, endDate, req.body.pageNumber, req.body.pageSize, req.context);
        req.context.log("Caching Orders data to Redis.");
        await redis.set(cacheDataKey, JSON.stringify(orders), "EX", 300);
        await redis.set(cachePaginationKey, JSON.stringify({ pageNumber: req.body.pageNumber, pageSize: req.body.pageSize}), "EX", 300);
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
        const allowedPermissions = [constants.PERMISSION_CONSTANTS.CREATE_ORDER];
        await authorization.authorize(req.body.customerId, allowedPermissions, req.context);
        const orderSummary = await orderDAO.createOrder(req.body.customerId, req.body.userId, req.body.items, req.context);
        req.context.log("Clearing cached Orders data from Redis.");
        await redis.del("orders");
        res.status(200).json(orderSummary);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

app.post("/api/order/update", async(req, res) => {
    req.context.log('Update Order');
    try {
        await utility.validator(require("../Order/update-order.schema.json"), req.body, req.context);
        const orderSummary = await orderDAO.updateOrder(req.body.orderId, req.body.items, req.context);
        res.status(200).json(orderSummary);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

app.post("/api/order/fulfill", async(req, res) => {
    req.context.log('Fulfill Order');
    try {
        await utility.validator(require("../Order/fulfill-order.schema.json"), req.body, req.context);
        const orderSummary = await orderDAO.fulfullOrder(req.body.orderId, req.context);
        res.status(200).json(orderSummary);
    } catch (err) {
        utility.handleErrorResponse(err, res, req.context);
    }
});

module.exports = createHandler(app);