const { connectionPool, sql } = require("../../pool-manager");
const orderModel = require("../model/order-model");

module.exports = {
    createOrder: async (customerId, userId, items, context) => {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("CUSTOMER_ID", sql.Int, customerId)
                .input("USER_ID", sql.Int, userId);
            for (const item in items) {
                request.input(`PRODUCT_ID_${index}`, sql.Int, item.productId);
                request.input(`PRODUCT_QUANTITY_${index}`, sql.Int, item.quantity)
            }
            const productValues = items.map(item => `(PRODUCT_ID_${index}, PRODUCT_QUANTITY_${index})`).join(",");
            const query = `
                BEGIN TRANSACTION;
                DECLARE @ORDER_ID INT;
                DECLARE @ORDER_TOTAL FLOAT;
                DECLARE @ORDER_ITEMS TABLE (PRODUCT_ID INT, QUANTITY INT, PRICE FLOAT, ITEM_TOTAL FLOAT);
                BEGIN TRY
                    INSERT INTO dbo.[ORDER] (CUSTOMER_ID, USER_ID, DATE_CREATED, ORDER_STATUS)
                    VALUES (@CUSTOMER_ID, @USER_ID, GETDATE(), 'Pending');
                    SET @ORDER_ID = SCOPE_IDENTITY();
                    INSERT INTO @ORDER_ITEMS (PRODUCT_ID, QUANTITY)
                    VALUES ${productValues};
                    UPDATE OI
                    SET OI.PRICE = P.PRICE, 
                        OI.ITEM_TOTAL = OI.QUANTITY * P.PRICE
                    FROM @ORDER_ITEMS OI
                    INNER JOIN dbo.PRODUCT P ON OI.PRODUCT_ID = P.PRODUCT_ID;
                    INSERT INTO dbo.ORDER_DETAILS (ORDER_ID, PRODUCT_ID, QUANTITY, PRICE)
                    SELECT @ORDER_ID, PRODUCT_ID, QUANTITY, ITEM_TOTAL FROM @ORDER_ITEMS;
                    SELECT @ORDER_TOTAL = SUM(ITEM_TOTAL) FROM @ORDER_ITEMS;
                    SELECT 
                        O.ORDER_ID orderId
                        ,O.ORDER_STATUS status
                        ,@ORDER_TOTAL totalCost
                    FROM dbo.[ORDER] O
                    WHERE O.ORDER_ID = @ORDER_ID;
                    COMMIT TRANSACTION;
                END TRY
                BEGIN CATCH
                    ROLLBACK TRANSACTION;
                    THROW;
                END CATCH;
            `;
            const result = request.query(query)
                .catch(err => {
                    context.log(err);
                    throw err
                });
            const orderSummary = orderModel.mapOrderSummary(result.recordset);
            return orderSummary;
        } catch (err) {
            context.log(err);
            throw err;
        }
    },
    getOrderList: async (status, startDate, endDate) => {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("STATUS", sql.VarChar(10), status ?? null)
                .input("START_DATE", sql.DateTime, startDate ?? null)
                .input("END_DATE", sql.DateTime, endDate ?? null);
            const query = `
                WITH OrderList AS (
                    SELECT
                        O.ORDER_ID orderId
                        ,O.ORDER_STATUS status
                        ,O.CUSTOMER_ID customerId
                        ,SUM(OD.PRICE) totalCost 
                        ,O.DATE_CREATED createdDate
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE 
                        (@STATUS IS NULL OR O.ORDER_STATUS = @STATUS)
                        AND (@START_DATE IS NULL OR O.DATE_CREATED >= @START_DATE)
                        AND (@END_DATE IS NULL OR O.DATE_CREATED <= @END_DATE)
                    GROUP BY
                        O.ORDER_ID
                        ,ORDER_STATUS
                        ,CUSTOMER_ID
                        ,DATE_CREATED
                )
                SELECT
                    orderId
                    ,status
                    ,customerId
                    ,totalCost 
                    ,createdDate
                FROM OrderList
                ORDER BY orderId
                OFFSET (@OFFSET * @LIMIT) ROWS
                FETCH NEXT @LIMIT ROWS ONLY;
            `;
            const result = await request.query(query).catch(err => {
                context.log(err);
                throw err;
            });
            const orders = orderModel.mapOrders(result.recordset);
            return orders;
        } catch (err) {
            context.log(err);
            throw err;
        }
    },
    getOrderDetails: async (orderId) => {
        try {
            const pool = await connectionPool;
            const request = pool.request()
                .input("ORDER_ID", sql.Int, orderId);
            const query = `
                WITH OrderSum AS (
                    SELECT
                        O.ORDER_ID
                        ,SUM(OD.PRICE) totalCost
                    FROM dbo.[ORDER] O
                    INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                    WHERE O.ORDER_ID = @ORDER_ID
                    GROUP BY O.ORDER_ID
                )
                SELECT
                    O.ORDER_ID orderId
                    ,O.ORDER_STATUS status
                    ,O.CUSTOMER_ID customerId
                    ,OS.totalCost
                    ,O.DATE_CREATED createdDate
                    ,OD.PRODUCT_ID AS productId
                    ,OD.QUANTITY AS quantity
                    ,OD.PRICE AS price
                FROM dbo.[ORDER] O
                INNER JOIN dbo.[ORDER_DETAILS] OD ON O.ORDER_ID = OD.ORDER_ID
                INNER JOIN OrderSum OS ON O.ORDER_ID = OS.ORDER_ID
                ORDER BY O.ORDER_ID;
            `;
            const result = await request.query(query).catch(err => {
                context.log(err);
                throw err;
            });
            const orderDetails = orderModel.mapOrderDetails(result.recordset);
            return orderDetails;
            
        } catch (err) {
            context.log(err);
            throw err;
        }
    }
}