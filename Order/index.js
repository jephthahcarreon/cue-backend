const express = require("express");
const session = require("express-session");
const passport = require("passport");
const createHandler = require("azure-function-express").createHandler;
const orderDAO = require("../common/database/dao/order-dao");
const { authRoutes, authMiddleware } = require("../common/authentication")
const utility = require("../common/utility");
const app = express();

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use("/auth", authRoutes);

app.get("/api/order/list", authMiddleware, async(req, res) => {
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    req.context.log(`Get Order List: Status: ${status}, Start Date: ${startDate}, End Date: ${endDate}`);
    try {
        await orderDAO.getOrderList(status, startDate, endDate, req.context);
    } catch {

    }
});

app.get("/api/order/details/:orderId", authMiddleware, async(req, res) => {
    const orderId = req.params.orderId;
    req.context.log('Get Order Details: ', orderId);
    try {
        await orderDAO.getOrderDetails(orderId, req.context);
    } catch {

    }
});

app.post("/api/order/create", authMiddleware, async(req, res) => {
    req.context.log('Create Order');
    try {
        await utility.validator(require("../Order/create-order.schema.json"), req.body, req.context);
        await orderDAO.createOrder(req.body.customerId, req.body.userId, req.body.items, req.context);
        res.status(200).json("Create Order Successful.")
    } catch {

    }
});

module.exports = createHandler(app);